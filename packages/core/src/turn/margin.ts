import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { holdingValue, totalAssets, priceOf, fee, tax } from './accounting'

/**
 * 신용거래(대출·이자·반대매매). 1차 슬라이스에서는 이 모듈을 부르는 화면이 없어
 * 플레이어가 스스로 빚을 질 수 없었다(최종 리뷰 M2, Ruling 71로 보류). 사용자 결정으로
 * 그 보류가 풀렸다 — **계좌 화면이 `takeLoan`/`repayLoan`/`maxLoan`을 부른다**(화면 쪽은
 * 이 작업과 같은 묶음의 다른 몫이다). 따라서 `st_margin_after` 이벤트와 '신용·미수 사용 중
 * −8' 멘탈 항(mental.ts)은 더 이상 도달 불가능이 아니고, 칭호 '빚 없이'도 100% 부여되지
 * 않는다(`takeLoan`이 `trackers.usedMargin`을 세운다).
 * 로직 자체는 advanceTurn 4단계에 연결돼 있다(advance.test.ts의 T-B8/T-B9가 고정한다).
 *
 * 마진콜은 **한 주 유예**를 준다: 담보가 무너진 그 주에는 경고(`player.marginCallDueTurn`)만
 * 서고, 다음 주에도 회복하지 못했을 때 비로소 전량 청산된다. 화면은 경고가 서 있는 동안
 * 배너를 띄워 "다음 주까지 담보를 못 채우면 전량 청산됩니다"를 알린다.
 */

export function maxLoan(state: GameState): number {
  if (state.player.tier < BALANCE.loan.minTier) return 0
  return Math.max(0, Math.floor(totalAssets(state) * BALANCE.loan.maxRatio) - state.player.loan)
}

export function takeLoan(state: GameState, amount: number): GameState {
  if (!Number.isInteger(amount) || amount <= 0) throw new GameError('BAD_AMOUNT')
  if (state.player.tier < BALANCE.loan.minTier) throw new GameError('TIER_LOCKED')
  if (amount > maxLoan(state)) throw new GameError('LOAN_LIMIT')
  return {
    ...state,
    player: { ...state.player, cash: state.player.cash + amount, loan: state.player.loan + amount },
    trackers: { ...state.trackers, usedMargin: true },
  }
}

export function repayLoan(state: GameState, amount: number): GameState {
  if (!Number.isInteger(amount) || amount <= 0) throw new GameError('BAD_AMOUNT')
  if (amount > state.player.loan || amount > state.player.cash) throw new GameError('BAD_AMOUNT')
  return { ...state, player: { ...state.player, cash: state.player.cash - amount, loan: state.player.loan - amount } }
}

export function accrueInterest(state: GameState): GameState {
  if (state.player.loan <= 0) return state
  const interest = Math.round(state.player.loan * BALANCE.loan.rate)
  return { ...state, player: { ...state.player, loan: state.player.loan + interest } }
}

/** 담보 = 현금 + 보유 평가액. 대출이 요구하는 최소 담보는 `loan × callRatio`다.
 *  이 두 값의 비교가 마진콜의 유일한 판정식이고, 아래 세 소비자(경고 세우기·회복 판정·
 *  화면용 부족액)가 전부 여기를 통해서만 읽는다 — 같은 식을 두 번 적으면 두 사본이 어긋난다. */
function collateralOf(state: GameState): number {
  return state.player.cash + holdingValue(state)
}
function requiredCollateral(state: GameState): number {
  return state.player.loan * BALANCE.loan.callRatio
}
function isHealthy(state: GameState): boolean {
  return collateralOf(state) >= requiredCollateral(state)
}

/**
 * 담보가 요구치에 **얼마나 모자란가**(원 단위, 올림). 모자라지 않으면 0이고, 대출이
 * 없어도 0이다. 계좌 화면의 마진콜 배너가 "얼마를 더 채워야 하는가"를 그리는 값이다 —
 * 화면이 `loan × callRatio` 공식을 다시 적지 않게 하려고 여기서 내보낸다.
 * `marginShortfall(s) > 0`인 것과 이번 신용 단계에서 경고/청산이 걸리는 것은 같은 뜻이다.
 */
export function marginShortfall(state: GameState): number {
  if (state.player.loan <= 0) return 0
  return Math.max(0, Math.ceil(requiredCollateral(state) - collateralOf(state)))
}

/**
 * 신용 단계(advanceTurn 4단계)의 담보 판정. **한 주 유예**가 있어서 세 갈래다:
 *
 * 1. 빚이 없다 → 위험도 없다. 서 있던 경고는 여기서 내린다(다 갚고 나서 다음 주에
 *    청산당하는 일이 없어야 한다).
 * 2. 담보가 무너졌는데 경고가 **없다** → `marginCallDueTurn = 이번 턴 + 1`로 경고만 세우고
 *    **청산하지 않는다**. 이 함수는 advanceTurn이 `turn`을 올리기 전에 불리므로(맨 끝의
 *    `turn: s.turn + 1`), `+1`은 정확히 **다음 advanceTurn 호출**을 가리킨다 —
 *    플레이어는 그 사이 한 주 동안 팔거나 갚아서 담보를 채울 수 있다.
 * 3. 경고가 서 있고 그 주가 **왔다**(`turn >= dueTurn`) → 담보가 회복됐으면 경고만 내리고,
 *    아니면 전량 청산한다. 경고는 청산 후에도 내린다(청산이 끝난 자리에 예고가 남아 있으면
 *    화면이 이미 일어난 일을 예고로 다시 띄운다).
 *
 * 경고가 서 있는데 아직 그 주가 오지 않았으면 아무것도 하지 않는다.
 */
export function checkMarginCall(state: GameState): GameState {
  const { loan, marginCallDueTurn } = state.player
  const clearWarning = (s: GameState): GameState =>
    s.player.marginCallDueTurn === null ? s
      : { ...s, player: { ...s.player, marginCallDueTurn: null } }

  // 1. 빚이 없으면 청산할 이유도 없다 — 서 있던 경고를 내린다.
  if (loan <= 0) return clearWarning(state)

  // 2. 경고가 아직 없다 — 무너졌으면 다음 주로 예고만 세운다.
  if (marginCallDueTurn === null) {
    if (isHealthy(state)) return state
    return { ...state, player: { ...state.player, marginCallDueTurn: state.turn + 1 } }
  }
  // 경고는 서 있지만 아직 그 주가 아니다 — 유예 중이므로 아무것도 하지 않는다.
  if (state.turn < marginCallDueTurn) return state
  // 3. 유예가 끝났다 — 회복했으면 경고만 내리고 살려 보낸다.
  if (isHealthy(state)) return clearWarning(state)

  let proceeds = 0
  let lossCutCount = 0
  // 최종 리뷰 m3 — 강제청산도 수수료·거래세를 **실제로 뗀다**(바로 아래 proceeds
  // 계산이 그 증거다). 그런데 그 금액이 트래커에 안 잡혀서, 잔고증명서(§5)의
  // '수수료·세금' 합계가 강제청산분만큼 조용히 모자랐다. 반대매매는 플레이어가 낸
  // 주문이 아니지만 **돈은 똑같이 나간다** — 나간 돈을 적는 자리가 트래커다.
  // (`tradeCount`는 올리지 않는다. 그건 '플레이어가 몇 번 매매했는가'를 세는 값이고,
  //  강제청산은 플레이어의 매매가 아니다 — sell()과 달리 여기서는 그 축이 다르다.)
  let feesTotal = 0
  let taxTotal = 0
  for (const h of state.player.holdings) {
    const gross = h.qty * priceOf(state, h.stockId)
    const feeAmt = fee(gross)
    const taxAmt = tax(gross)
    proceeds += gross - feeAmt - taxAmt
    feesTotal += feeAmt
    taxTotal += taxAmt
    const price = priceOf(state, h.stockId)
    if (price < h.avgCost) lossCutCount++
  }
  const cash = state.player.cash + proceeds
  const repaid = Math.min(cash, loan)
  return {
    ...state,
    // 청산으로 예고는 집행됐다 — marginCallDueTurn을 내리지 않으면 화면이 이미 끝난 일을
    // 다음 주 예고로 다시 띄우고, 다음 턴 판정도 곧바로 3번 갈래로 들어가 유예 없이 또 판다.
    player: { ...state.player, holdings: [], cash: cash - repaid, loan: loan - repaid, marginCallDueTurn: null },
    trackers: {
      ...state.trackers,
      lossCuts: state.trackers.lossCuts + lossCutCount,
      feesPaid: state.trackers.feesPaid + feesTotal,
      taxPaid: state.trackers.taxPaid + taxTotal,
    },
    flags: { ...state.flags, marginCalled: true },
  }
}

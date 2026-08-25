import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { holdingValue, totalAssets, priceOf, fee, tax } from './accounting'

/**
 * 신용거래(대출·이자·반대매매). **1차 슬라이스에서는 UI가 연결돼 있지 않다** —
 * `takeLoan`/`repayLoan`을 부르는 화면이 없어 플레이어는 스스로 빚을 질 수 없다
 * (최종 리뷰 M2, Ruling 71로 보류: 대출 UI 신설은 수정 파동이 아니라 새 기능이다).
 * 그 결과로 `st_margin_after` 이벤트와 '신용·미수 사용 중 −8' 멘탈 항은 현재 도달
 * 불가능하고, 칭호 '빚 없이'는 100% 부여된다. 여기 로직 자체는 정상 동작하며
 * advanceTurn 4단계에 연결돼 있다(advance.test.ts의 T-B8/T-B9가 고정한다).
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

/** 담보(현금+평가액)가 대출의 callRatio 배 아래로 내려가면 전량 강제청산 후 상환. */
export function checkMarginCall(state: GameState): GameState {
  const { loan } = state.player
  if (loan <= 0) return state
  const collateral = state.player.cash + holdingValue(state)
  if (collateral >= loan * BALANCE.loan.callRatio) return state

  let proceeds = 0
  let lossCutCount = 0
  for (const h of state.player.holdings) {
    const gross = h.qty * priceOf(state, h.stockId)
    const feeAmt = fee(gross)
    const taxAmt = tax(gross)
    proceeds += gross - feeAmt - taxAmt
    const price = priceOf(state, h.stockId)
    if (price < h.avgCost) lossCutCount++
  }
  const cash = state.player.cash + proceeds
  const repaid = Math.min(cash, loan)
  return {
    ...state,
    player: { ...state.player, holdings: [], cash: cash - repaid, loan: loan - repaid },
    trackers: { ...state.trackers, lossCuts: state.trackers.lossCuts + lossCutCount },
    flags: { ...state.flags, marginCalled: true },
  }
}

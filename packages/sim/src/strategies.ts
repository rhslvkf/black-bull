import {
  type GameState, type SlotCard, buy, sell, canSell, canBuy, maxBuyQty, totalAssets,
  loadCards, isCardAvailable, Rand, createRng, priceOf, actionPoints, cardApCost, gradeOfSlot,
  rerollSlots, playCard, BALANCE, maxLoan, takeLoan, repayLoan, marginShortfall,
} from '@bb/core'

/**
 * 전략 이름은 게이트 제목·CLI 출력·README 표에 그대로 드러난다. 이름이 실제 동작과
 * 다르면 게이트의 의미도 같이 거짓이 된다(재리뷰 §6).
 *
 * - `cash`     **스스로는** 매매하지 않는다. 월급만 받는 '거의 무매매' 기준선 (Ruling 52).
 *              완전한 무매매는 아니다 — `buyStockPct` 이벤트가 강제로 사게 하는 경로가
 *              남아 평균 노출이 7%쯤 된다(Ruling 72, 200판 실측 6.8%). 전략 코드로는
 *              막을 수 없다. (Ruling 72 당시 함께 지목됐던 '물타기 카드'는 스펙 §2.4에서
 *              종목 상세의 버튼으로 옮겨가 카드 풀에 없다 — 남은 원인은 이벤트뿐이다.)
 *              이 잔여 노출은 `seedhold > cash × 1.03` 게이트를 오히려 **통과하기
 *              어렵게** 만들므로 게이트의 정당성은 훼손되지 않는다.
 * - `seedhold` 턴 1에 **시드머니의 90%만** 넣고 156턴 방치. 이후 들어오는 월급은
 *              영원히 현금으로 둔다 → 총 투입 자본이 최종 자산의 8% 남짓이다.
 *              "얇은 노출로도 파산하지 않는가"를 재는 자다. (이전 이름이 `buyhold`였다)
 * - `buyhold`  **진짜 존버.** 매 턴 현금의 90%를 넣고 절대 팔지 않는다(정액분할매수).
 *              월급이 그대로 시장에 들어가므로 노출이 `panic`·`momentum`과 비교 가능하다.
 * - `momentum` 최근 3턴 상승률 1등으로 갈아탄다
 * - `random`   무작위 매매
 * - `panic`    오르면 사고 내리면 판다 — 전형적인 흑우
 * - `labor`    **노동 특화 무매매.** 주식은 한 주도 사지 않고 야근만 판다.
 *              `cash`와 매매는 같고(하지 않는다) 카드 정책만 다르다.
 *
 *              **이 전략이 존재하는 이유는 오직 하나 — "노동이 투자를 이기지 못한다"를
 *              게이트로 고정하기 위해서다.** Task 8이 `BALANCE.grade.cashMul`을 새로
 *              들여 야근 S를 576,000원에서 180,000원으로 내린 것이 이 태스크의 헤드라인
 *              주장인데, Fix Round 1 리뷰가 `cashMul`을 옛 `grade.mul`로 되돌려도
 *              sim 24/24가 전부 그린인 것을 실측했다. 성질을 만들어 놓고 고정하지
 *              않으면 다음 사람이 한 줄로 되돌려도 아무도 모른다.
 * - `leverage` **빚을 져서 판을 키운다.** 이 저장소에서 유일하게 `takeLoan`을 부르는
 *              전략이다 — 나머지 일곱은 `marginRate`가 정확히 0이다.
 *
 *              **왜 필요한가:** 신용거래는 core에 완전히 구현돼 있었지만 그것을 부르는
 *              곳이 없어서, 조사 3,560판에서 `legend`(파산)·`fire`·`super`가 한 판도
 *              나오지 않았다(최종 리뷰 M4/M5). 레버리지 없이 3년 만에 5억에 닿는 경로가
 *              없고, 빚이 없으면 총자산이 0 이하로 내려갈 수도 없기 때문이다. 이 전략은
 *              그 세 엔딩이 **실제로 도달 가능한지**를 판정하기 위해 존재한다.
 *
 *              세 가지가 다른 일곱과 구분한다(수치는 balance.test.ts의 게이트가 고정한다):
 *              ① 티어 3(1억)에 닿는 순간 한도(`maxLoan`)를 남김없이 끌어 쓴다.
 *              ② 마진콜 **경고**가 서면 그 유예 한 주 안에 전량 매도 → 전액 상환한다.
 *                 (담보는 파는 것으로 채워지지 않는다 — 현금과 보유평가액은 1:1이라
 *                  담보 합계가 그대로다. 요구 담보를 낮추는 유일한 수단이 상환이다.)
 *              ③ 인맥 카드를 맨 뒤로 민다. `kimheir`(인맥 8 + 김실장 방)가 `fire`·`super`
 *                 **보다 우선**해서, 인맥을 키우면 상단 엔딩을 스스로 덮어버린다.
 */
export type Strategy =
  | 'cash' | 'seedhold' | 'buyhold' | 'momentum' | 'random' | 'panic' | 'labor' | 'leverage'

const tradable = (s: GameState) => s.stockDefs.filter(d => canBuy(s, d.id).ok)

function trendOf(s: GameState, id: string): number {
  const h = s.stocks.find(x => x.id === id)!.history
  if (h.length < 4) return 0
  return h[h.length - 1]! / h[h.length - 4]! - 1
}

function sellAll(s: GameState): GameState {
  for (const h of [...s.player.holdings]) {
    if (canSell(s, h.stockId).ok) { try { s = sell(s, h.stockId, h.qty) } catch { /* 봉인 */ } }
  }
  return s
}

/**
 * `leverage` 전용 — 지금 살 수 있는 종목 중 **변동성이 가장 큰** 것.
 *
 * 추세(`trendOf`)로 고르면 `momentum`·`panic`과 매매가 겹쳐 전략이 이름만 달라진다.
 * 레버리지 플레이어의 목표는 "평균적으로 좋은 수익"이 아니라 **멀리 있는 문턱(티어 3의
 * 1억)에 닿는 것**이고, 먼 문턱에 닿을 확률을 올리는 것은 기대값이 아니라 분산이다.
 * 티어가 오를수록 더 사나운 종목이 열리므로(무쇠정밀 0.095는 티어 2 게이트) 이 규칙
 * 하나로 티어를 따라 위험이 올라간다. 동률이면 id 순으로 잘라 결정론을 지킨다.
 */
function wildest(pool: readonly { id: string; volatility: number }[]) {
  return [...pool].sort((a, b) => b.volatility - a.volatility || (a.id < b.id ? -1 : 1))[0]!
}

/**
 * 신용을 새로 일으키는 최소 단위. 한도가 열릴 때마다 몇 원씩 빌리면 판을 키우지도
 * 못하면서 이자만 붙고, `trackers.usedMargin`만 세워 '빚 없이' 칭호를 지운다.
 * 리터럴이 아니라 **대출이 열리는 티어의 자산선에서 유도한다**(1억의 1% = 100만원) —
 * 티어 문턱을 다시 튜닝하면 이 단위도 따라 움직인다.
 */
const LOAN_MIN_DRAW = Math.floor((BALANCE.tierMins[BALANCE.loan.minTier] ?? 0) * 0.01)

/**
 * 마진콜 **경고**에 대한 응답. core가 준 유예 한 주 안에 담보를 되살리는 유일한 방법이다.
 *
 * 파는 것만으로는 담보가 채워지지 않는다 — 담보는 `현금 + 보유평가액`이라 매도는 그
 * 합계를 (수수료·세금만큼) **줄인다**. 요구 담보(`loan × callRatio`)를 낮추는 수단은
 * 상환뿐이므로, 순서는 반드시 **팔아서 현금을 만들고 → 갚는다**여야 한다.
 * 흔들림 + 포지션 손실 20% 이상이면 `canSell`이 매도를 봉인하므로(SELL_BLOCKED)
 * 이 대응은 실패할 수 있다 — 그 실패가 곧 다음 턴의 강제청산이고, 파산 경로다.
 */
function deleverage(s: GameState): GameState {
  s = sellAll(s)
  const repay = Math.floor(Math.min(s.player.cash, s.player.loan))
  if (repay > 0) { try { s = repayLoan(s, repay) } catch { /* 잔고가 어긋나면 다음 턴에 다시 */ } }
  return s
}

function investPct(s: GameState, id: string, pct: number): GameState {
  const budget = s.player.cash * pct
  const qty = Math.min(maxBuyQty(s, id), Math.floor(budget / priceOf(s, id)))
  if (qty <= 0) return s
  try { return buy(s, id, qty) } catch { return s }
}

/** 이번 턴에 뽑힌 카드 전부 — 행동 3칸 + 회복 1칸. 카드 선택의 유일한 출처다.
 *  (Task 6부터 core가 슬롯 밖 카드를 NOT_IN_SLOTS로 하드 거부한다. 예전 sim은
 *   `loadCards()` 11장 전체에서 골랐고, advance.ts의 관대한 조회를 로컬에 복제한
 *   `gradeInSlots`로 등급을 메웠다 — 둘 다 이 태스크에서 없앴다.) */
const slotCards = (s: GameState): SlotCard[] => [...s.slots.action, s.slots.recovery]

/** 슬롯에서 지금 실제로 낼 수 있는 카드(잠기지 않은 카드)만 남긴다. */
function usableSlotCards(s: GameState): SlotCard[] {
  const defs = loadCards()
  return slotCards(s).filter(sl => {
    const def = defs.find(c => c.id === sl.cardId)
    return def !== undefined && isCardAvailable(s, def)
  })
}

/**
 * 카드 목록이 실제로 태우는 행동력. 리포트의 `avgApSpent`가 이 값을 쓴다 —
 * 예산이 남아도는지(= 선택이 만들어지지 않는지)를 재는 자다.
 *
 * 등급은 core의 `gradeOfSlot`으로 읽는다. 슬롯 밖 id면 그 함수가 NOT_IN_SLOTS로
 * **던진다** — 조용히 걸러내면 sim이 슬롯 밖에서 카드를 고르기 시작해도 아무 데서도
 * 터지지 않고 결과만 소리 없이 움직인다(리뷰 Minor 1: 카드 선택을 loadCards() 전체로
 * 되돌려도 통과했고 panic 중앙값만 32.9M→34.7M로 이동했다).
 *
 * **예산 판정은 여기 없다.** 예산은 `chooseCards` 한 곳에서만 건다(Fix Round 1
 * Minor 5): 예전에는 `chooseCards`가 예산을 건 결과에 runner가 `withinApBudget`을
 * 한 번 더 걸어 실질 no-op이었고, 판정이 두 군데 있으면 나중에 한쪽만 고쳐 어긋난다.
 * 최종 방어선은 core의 `advanceTurn`이다 — 예산을 넘기면 NO_AP로 던진다.
 */
export function apCostOf(state: GameState, cardIds: string[]): number {
  return cardIds.reduce((sum, id) => sum + cardApCost(id, gradeOfSlot(state, id)), 0)
}

/**
 * 회복 슬롯을 집는 임계. 회복 카드는 행동력을 **소모하지 않으므로**(BALANCE.action)
 * 아껴야 할 자원이 아니다 — 사람 플레이어라면 게이지가 내려간 순간 집는다.
 * 그렇다고 '매 턴 무조건'으로 두면 멘탈·컨디션이 늘 만렙이라 흔들림 시스템이 통째로
 * 죽는다(`멘탈 시스템이 살아 있다` 게이트가 그 붕괴를 잡는다). 그래서 임계를 둔다.
 *
 * 두 값 다 리터럴이 아니라 **BALANCE에서 유도**한다 — 문턱을 다시 튜닝해도 sim이 따라간다.
 * 아래 여유폭은 Task 8에서 실측으로 좁힌 값이다(처음에는 +15 / ×2였는데, 그러면 회복을
 * 너무 일찍 집어 멘탈이 늘 만렙이 되고 흔들림 시스템이 통째로 죽었다 — buyhold 흔들림
 * 6.0%로 '멘탈 시스템이 살아 있다' 게이트의 하한 10% 아래였다):
 * - 멘탈: 흔들림 문턱(`mental.shakenMax` = 29)보다 **+6**. 신용을 쓰지 않는 판의 한 턴
 *   낙폭은 `lossHold`(−5) × 노출 × 저항이 상한이므로 +6이면 한 턴 앞서 반응한다.
 *   흔들림에 빠진 **뒤에** 반응하면 이성 카드가 잠긴 채로 손실 감소분을 계속 맞는다.
 * - 컨디션: 강제 스킵 문턱(`condition.forcedSkipBelow` = 20) **+10**. 턴 드레인(−4)에
 *   야근이 겹치지 않는 한 한 턴에 10을 넘겨 떨어지지 않는다.
 */
export interface RecoveryThresholds { mental: number; condition: number }

/** `recoveryAt`이 읽는 밸런스의 최소 형태. `BALANCE`가 이 형태를 만족하고, 테스트는
 *  가짜 밸런스를 넣어 결과가 **따라 움직이는지**를 본다. */
export interface RecoveryBalanceShape {
  mental: { shakenMax: number }
  condition: { forcedSkipBelow: number }
}

/**
 * 회복 임계를 **밸런스에서 계산하는 순수 함수.** 상수가 아니라 함수인 이유는
 * Fix Round 2 리뷰가 잡은 것 때문이다: 상수와 기대값을 `toBe`로 맞대면 **틀린 리터럴만**
 * 잡히고 "우연히 지금 유도값과 같은 리터럴"(`{ mental: 35, condition: 30 }`)은 그대로
 * 통과한다 — 고정해야 하는 건 값이 아니라 **BALANCE와의 연결**이다. 입력을 받는 함수로
 * 두면 테스트가 가짜 밸런스를 밀어 넣어 결과가 따라 움직이는지 볼 수 있고, 리터럴 구현은
 * 그 테스트를 **통과할 수 없다**.
 */
export function recoveryAt(balance: RecoveryBalanceShape): RecoveryThresholds {
  return {
    mental: balance.mental.shakenMax + 6,
    condition: balance.condition.forcedSkipBelow + 10,
  }
}

export const RECOVERY_AT: RecoveryThresholds = recoveryAt(BALANCE)

/**
 * 전략별 행동 카드 취향. **이 표가 "전략이 행동력을 어떻게 쓰는가"의 전부다.**
 * 앞에 있을수록 먼저 집고, 예산이 닿는 데까지 채운다.
 *
 * - `cash`·`seedhold`는 **같은 표를 공유한다.** 둘은 `seedhold > cash × 1.03` 게이트의
 *   대조쌍이라 매매 말고는 달라선 안 된다 — 한쪽만 야근을 하면 그 게이트가 재는 것이
 *   "시장이 투자를 보상하는가"가 아니라 "누가 더 일했는가"가 된다.
 * - 두 표에서 야근이 **맨 뒤**인 것도 같은 이유다. 노동 소득은 두 판에 같은 절대액을
 *   더해 상대 마진(통과선 +3%)을 희석시키기만 하므로, 다른 카드가 하나도 없을 때의
 *   마지막 수단으로만 남긴다.
 * - `buyhold`는 야근이 1순위다 — 매 턴 현금의 90%를 넣는 적립식이라 현금이 곧 탄약이다.
 * - `panic`도 야근을 위쪽에 둔다. `panic < buyhold × 0.85` 게이트가 재려는 건
 *   **뇌동매매의 처벌**이지 노동 소득의 차이가 아니므로, 비교쌍의 현금 채널을 맞춘다
 *   (보고서 §뮤테이션: 카드를 한 장도 안 쓰는 변형과 비율이 어긋나지 않는지 실측했다).
 * - `momentum`은 정보·분석으로 흐름을 쫓고, `panic`은 커뮤니티에 휩쓸린다(멘탈 −6).
 * - `random`은 취향이 없다 — 뽑힌 순서를 섞어 예산이 닿는 대로 낸다.
 */
export const CARD_PREF = {
  cash:     ['study', 'analyze', 'news', 'report', 'forum', 'community', 'overtime'],
  seedhold: ['study', 'analyze', 'news', 'report', 'forum', 'community', 'overtime'],
  buyhold:  ['overtime', 'analyze', 'report', 'study', 'news', 'forum', 'community'],
  momentum: ['news', 'report', 'analyze', 'overtime', 'forum', 'study', 'community'],
  panic:    ['overtime', 'community', 'forum', 'news', 'study', 'analyze', 'report'],
  // 노동 특화. `cash`와 매매는 같고(하지 않는다) 야근이 1순위인 것만 다르다 —
  // 그래서 `labor − cash`가 **순수한 노동 소득**이 된다.
  labor:    ['overtime', 'study', 'analyze', 'news', 'report', 'forum', 'community'],
  // 레버리지. 인맥 카드(forum·study)가 **맨 뒤**인 것이 이 표의 핵심이다 — `kimheir`는
  // 인맥 8 + 김실장 방이면 자산과 무관하게 `fire`·`super`를 덮어쓰므로(endings.ts의
  // pickEnding 순서), 인맥을 키우는 레버리지 플레이어는 상단 엔딩을 스스로 막는다.
  // 앞쪽은 기업분석 → 커뮤니티 → 뉴스다. 커뮤니티(멘탈 −6)를 위에 두는 것은 취향이
  // 아니라 대가다: 빚을 진 판은 멘탈이 곧 매도 가능 여부이므로(흔들림 + 손실 20%면
  // SELL_BLOCKED) 정보를 싸게 사려다 마진콜 대응 수단을 잃는다.
  leverage: ['analyze', 'community', 'news', 'report', 'overtime', 'study', 'forum'],
  random:   [],
} as const satisfies Record<Strategy, readonly string[]>

/** 취향 순위. 표에 없는 카드는 맨 뒤로 보낸다. */
const prefIdx = (strategy: Strategy, cardId: string): number => {
  const list: readonly string[] = CARD_PREF[strategy]
  const i = list.findIndex(x => x === cardId)
  return i < 0 ? list.length : i
}

/** 리롤을 쓰는 규칙: 이번 턴 행동 슬롯에 **취향 상위 두 장**이 하나도 없으면 다시 굴린다.
 *  '아무 카드나 있으면 만족'으로 두면 리롤이 영영 0이 되고, '1순위가 나올 때까지'로 두면
 *  매 턴 리롤을 전부 태워 리롤이 사실상 슬롯 뽑기를 무력화한다(뽑기 운을 완화하는
 *  수단이지 없애는 수단이 아니다 — slots.ts 주석). 둘 사이가 2다.
 *  `random`은 취향이 없으므로 리롤도 쓰지 않는다. */
const REROLL_TOP_N = 2

function wantsReroll(s: GameState, strategy: Strategy): boolean {
  if (strategy === 'random') return false
  const top: readonly string[] = CARD_PREF[strategy].slice(0, REROLL_TOP_N)
  return !s.slots.action.some(sl => top.some(x => x === sl.cardId))
}

/** 리롤을 만족할 때까지(또는 다 쓸 때까지) 굴린다. 소비한 리롤 횟수를 함께 돌려준다. */
function useRerolls(s: GameState, strategy: Strategy): { state: GameState; rerolls: number } {
  let used = 0
  while (s.rerollsLeft > 0 && wantsReroll(s, strategy)) {
    const next = rerollSlots(s)
    if (next === s) break            // 방어: 리롤이 상태를 못 바꾸면 무한 루프가 된다
    s = next
    used++
  }
  return { state: s, rerolls: used }
}

/** 무작위 순열 — rand를 정확히 n−1번 소비한다(피셔-예이츠). */
function shuffled<T>(items: readonly T[], rand: Rand): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand.int(0, i)
    const t = a[i]!; a[i] = a[j]!; a[j] = t
  }
  return a
}

/**
 * 이번 턴 낼 카드를 고른다 — 행동력 예산과 **카드 사이의 잠금 연쇄**를 둘 다 지킨다.
 *
 * 1. 행동 슬롯: 취향 순서(또는 random이면 무작위 순서)로, 예산이 닿는 데까지.
 * 2. 회복 슬롯은 **맨 뒤**다. 행동력을 안 쓰므로 순서가 예산에 영향을 주지 않고,
 *    뒤에 두면 그 현금 비용('최존버와 소주')이 앞 카드를 잠글 일이 없다.
 *    (회복 카드 자신은 스펙 §3.3 불변식상 어떤 상태에서도 잠기지 않는다.)
 *
 * **왜 미리 내보는가:** `advanceTurn`은 넘긴 카드를 순서대로 실제로 낸다. 앞 카드가
 * 현금을 깎아 뒤 카드가 잠기면 `CARD_LOCKED`로 판이 통째로 터진다 — 실측으로 실제
 * 발생했다(소주 → 스터디). 그 규칙을 sim에 다시 구현하면 core와 두 사본이 어긋나므로,
 * core의 `playCard`를 그대로 불러 **가상으로 낸 상태**에 다음 카드를 물어본다.
 * `playCard`는 rng를 쓰지 않는 순수 함수라 이 미리보기가 결정론을 건드리지 않는다.
 */
export function chooseCards(s: GameState, strategy: Strategy, rand: Rand): string[] {
  const defs = loadCards()
  const usable = usableSlotCards(s)
  const recId = s.slots.recovery.cardId
  const action = usable.filter(c => c.cardId !== recId)
  const ordered = strategy === 'random'
    ? shuffled(action, rand)
    : [...action].sort((a, b) => prefIdx(strategy, a.cardId) - prefIdx(strategy, b.cardId))

  const wantsRecovery = s.player.mental <= RECOVERY_AT.mental
    || s.player.condition <= RECOVERY_AT.condition
  const queue = [...ordered.map(c => c.cardId)]
  if (wantsRecovery && usable.some(c => c.cardId === recId)) queue.push(recId)

  const budget = actionPoints(s)
  let spent = 0
  let sim = s
  const picks: string[] = []
  for (const id of queue) {
    const grade = gradeOfSlot(s, id)
    const cost = cardApCost(id, grade)
    if (spent + cost > budget) continue
    const def = defs.find(c => c.id === id)
    if (def === undefined || !isCardAvailable(sim, def)) continue
    sim = playCard(sim, id, grade)
    spent += cost
    picks.push(id)
  }
  return picks
}

/** 전략별 매매 + 리롤 + 카드 선택. rand는 호출자가 소유한다. */
export function act(
  s: GameState, strategy: Strategy, rand: Rand,
): { state: GameState; cards: string[]; rerolls: number } {
  const pool = tradable(s)
  if (pool.length > 0) {
    switch (strategy) {
      case 'seedhold':
        // 턴 1에 한 번만 산다. 이후 월급은 현금으로 쌓인다.
        if (s.player.holdings.length === 0) s = investPct(s, pool[0]!.id, 0.9)
        break
      case 'buyhold':
        // 매 턴 현금의 90%를 같은 종목에 넣고 팔지 않는다 — 노출을 계속 유지하는 존버.
        s = investPct(s, pool[0]!.id, 0.9)
        break
      case 'panic': {
        // 오르면 사고 내리면 판다 — 전형적인 흑우
        s = sellAll(s)
        const hot = [...pool].sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0]!
        s = investPct(s, hot.id, 0.95)
        break
      }
      case 'momentum': {
        const hot = [...pool].sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0]!
        if (!s.player.holdings.some(h => h.stockId === hot.id)) { s = sellAll(s); s = investPct(s, hot.id, 0.8) }
        break
      }
      case 'random': {
        if (rand.chance(0.3)) s = sellAll(s)
        if (rand.chance(0.5)) s = investPct(s, pool[rand.int(0, pool.length - 1)]!.id, 0.5)
        break
      }
      case 'leverage': {
        // ① 경고가 서 있으면 이번 턴은 오직 담보 복구에만 쓴다. 새로 사지 않는다 —
        //    유예는 한 주뿐이고, 여기서 또 사면 다음 턴 판정에서 전량청산당한다.
        if (s.player.marginCallDueTurn !== null) { s = deleverage(s); break }
        // ② 담보가 이미 무너져 있으면(이번 턴 신용 단계에서 경고가 설 상태) 미리 줄인다.
        //    경고가 서기 **전에** 반응하는 것이 전략의 유일한 선제 행동이다.
        if (marginShortfall(s) > 0) { s = deleverage(s); break }
        // ③ 한도가 열려 있으면 남김없이 끌어 쓴다. 티어 3 미만이면 maxLoan이 0이라
        //    이 줄은 아무 일도 하지 않는다 — 그래서 판의 전반부는 무차입 몰빵이다.
        const room = maxLoan(s)
        if (room >= LOAN_MIN_DRAW) { try { s = takeLoan(s, room) } catch { /* 한도 경합 */ } }
        // ④ 현금 전부를 가장 사나운 종목에 태운다. 다른 종목을 들고 있으면 갈아탄다.
        const target = wildest(pool)
        if (s.player.holdings.some(h => h.stockId !== target.id)) s = sellAll(s)
        s = investPct(s, target.id, 1)
        break
      }
      case 'cash':
      case 'labor':
        // 스스로는 아무 주문도 내지 않는다 — 월급만 받는 '거의 무매매' 기준선 (Ruling 52).
        // 카드·이벤트가 강제하는 매수까지는 막지 못한다(Ruling 72, 평균 노출 5%).
        break
    }
  }
  // 카드는 **이번 턴 슬롯**에서만 고른다 — 플레이어가 실제로 마주하는 선택지와 같다.
  // 리롤을 먼저 태우고(행동 슬롯만 다시 굴린다) 그 결과에서 고른다.
  const { state, rerolls } = useRerolls(s, strategy)
  return { state, cards: chooseCards(state, strategy, rand), rerolls }
}

export { createRng, Rand, totalAssets }

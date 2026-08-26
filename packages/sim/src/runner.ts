import {
  initGame, advanceTurn, resolveChoice, loadEvents, totalAssets, moodOf, isShaken,
  GRADES, BALANCE, createRng, Rand, type Mood,
} from '@bb/core'
import { act, apCostOf, withinApBudget, type Strategy } from './strategies'

/** 등급을 숫자로 — E=0 … S=5. 후반 등급 상승을 재려면 순서가 있는 축이 필요하다. */
const gradeIdx = (g: string): number => GRADES.findIndex(x => x === g)

/** 초반/후반의 경계 턴. 156턴의 절반이다. `<= half`가 초반, 나머지가 후반. */
const HALF_TURN = Math.floor(BALANCE.totalTurns / 2)

export interface RunResult {
  ending: string; titles: string[]; assets: number
  shakenTurns: number; bankrupt: boolean; turns: number
  /** 홈 화면 캐릭터 표정별 턴 수. 표정 축이 상수로 붕괴했는지는 이 값으로만 보인다 —
   *  최종 리뷰 C1에서 실제로 붕괴해 있었고(월급만으로 턴 4부터 영구 joy) 스위트는 조용했다. */
  moodTurns: Record<Mood, number>
  /** 종목별 최종가 / 초기가. 시장이 종목에 무슨 짓을 했는지는 자산 분위수로는 안 보인다. */
  priceMul: Record<string, number>
  /** 이 판에서 실제로 태운 행동력의 합과, 그것을 나눌 턴 수. */
  apSpent: number
  /** 이 판에서 쓴 리롤 횟수의 합. */
  rerolls: number
  /** 초반(1..HALF_TURN)/후반에 **플레이어가 마주한 슬롯 카드**(행동 3칸 + 회복 1칸)의
   *  등급 인덱스 합과 장수. 낸 카드가 아니라 뽑힌 카드를 세는 이유는, 낸 카드만 세면
   *  전략 취향이 등급 분포에 섞여 들어와 "스탯이 등급을 민다"는 설계를 못 재기 때문이다. */
  gradeSumEarly: number; gradeCountEarly: number
  gradeSumLate: number; gradeCountLate: number
  /** 흔들림에 한 번이라도 들어갔는가 / 마지막 상태가 흔들림인가. */
  everShaken: boolean; endedShaken: boolean
  /** 카드 id별 사용 횟수. 전략이 실제로 서로 다른 카드를 쓰는지는 이걸로만 보인다. */
  cardUse: Record<string, number>
}
export interface BatchReport {
  runs: number; strategy: Strategy
  endingCounts: Record<string, number>
  bankruptRate: number; assetsMedian: number; assetsP10: number; assetsP90: number
  avgShakenTurns: number
  /** 흔들림을 한 턴이라도 겪은 판의 비율. 평균만 보면 "한 판이 148턴"과
   *  "전 판이 1턴씩"을 구분하지 못한다 — 멘탈 시스템이 죽었는지는 이 값으로 본다. */
  shakenRate: number
  /** 종목별 최종가 배율의 중앙값. 특정 종목이 시드와 무관하게 확정 전멸하는지가 여기서 보인다. */
  priceMulMedian: Record<string, number>
  /** 종목별로 최종가가 초기가 이상으로 끝난 판의 비율. 중앙값 하나로는 "항상 진다"를 놓친다. */
  priceUpRate: Record<string, number>
  /** 칭호별 부여 비율. 100%에 붙어 있으면 수집 축이 아니라 상수다. */
  titleRate: Record<string, number>
  /** 표정별 턴 점유율(합 1). 한 표정이 100%에 붙어 있으면 표정 축도 상수다. */
  moodShare: Record<Mood, number>
  /** 한 판에서 그 표정을 한 번이라도 본 판의 비율. */
  moodReach: Record<Mood, number>
  /** 턴당 실제로 태운 행동력의 평균. 예산이 남아도는 설계는 선택을 만들지 못한다 —
   *  `BALANCE.action.base`와 비교해서 읽는다. */
  avgApSpent: number
  /** 초반/후반 슬롯 등급 인덱스(E=0…S=5)의 평균. 스탯이 등급 확률을 민다는 설계가
   *  실제 플레이에서 성립하면 후반이 초반보다 확실히 높아야 한다. */
  avgGradeIdxEarly: number
  avgGradeIdxLate: number
  /** 턴당 사용한 리롤 횟수의 평균. 게이트는 없고 튜닝 근거로 읽는다 —
   *  0에 붙어 있으면 리롤이 죽은 자원이고, `BALANCE.reroll` 상한에 붙어 있으면
   *  리롤이 슬롯 뽑기의 운을 통째로 지워버린 것이다. */
  rerollUse: number
  /**
   * **멘탈 교착률.** 흔들림(멘탈 ≤ `BALANCE.mental.shakenMax`)에 **한 번이라도 들어간
   * 판 중**, 끝내 빠져나오지 못하고 흔들림 상태로 끝난 판의 비율이다.
   *
   * 브리프의 권장 정의는 '전체 판 중 종료 시점에 흔들림인 판'이었는데, 그 정의는
   * 흔들림에 아무도 안 들어가는 판(멘탈 시스템이 죽은 상태)에서 **0으로 통과한다** —
   * 회복 슬롯이 일했다는 증거가 아니라 시스템이 없다는 증거인데도 그린이 된다.
   * 조건부로 바꾸면 "들어간 판이 나올 수 있는가"라는 원래 질문을 그대로 잰다.
   * 대신 분모가 0이면 공허하게 통과하므로, 게이트 쪽에서 `shakenRate`가 유의미한지를
   * 함께 단언한다(balance.test.ts).
   */
  stuckInShakenRate: number
  /** 카드 id별 사용 점유율(합 1). 전략별 카드 선택이 실제로 다른지는 이걸로만 보인다. */
  cardUse: Record<string, number>
}

const events = loadEvents()

export function playOne(seed: number, strategy: Strategy): RunResult {
  let s = initGame(seed)
  const rand = new Rand(createRng(seed ^ 0xabcdef))

  const moodTurns: Record<Mood, number> = { normal: 0, shaken: 0, joy: 0 }
  const cardUse: Record<string, number> = {}
  let apSpent = 0, rerolls = 0
  let gradeSumEarly = 0, gradeCountEarly = 0, gradeSumLate = 0, gradeCountLate = 0
  let everShaken = false

  for (let i = 0; i < BALANCE.totalTurns && s.status === 'playing'; i++) {
    // 대기 중인 선택지는 무작위로 해소
    while (s.pendingChoices.length > 0) {
      const c = s.pendingChoices[0]!
      const def = events.find(e => e.id === c.eventId)
      const n = def?.choices?.length ?? 0
      s = n > 0 ? resolveChoice(s, c.eventId, rand.int(0, n - 1), events)
                : { ...s, pendingChoices: s.pendingChoices.slice(1) }
    }
    moodTurns[moodOf(s)]++   // 플레이어가 이 턴에 실제로 보는 표정
    if (isShaken(s)) everShaken = true
    const { state, cards, rerolls: usedRerolls } = act(s, strategy, rand)
    rerolls += usedRerolls
    // 리롤까지 끝난 뒤의 슬롯이 플레이어가 실제로 마주하는 이번 턴의 선택지다.
    const early = state.turn <= HALF_TURN
    for (const sl of [...state.slots.action, state.slots.recovery]) {
      if (early) { gradeSumEarly += gradeIdx(sl.grade); gradeCountEarly++ }
      else { gradeSumLate += gradeIdx(sl.grade); gradeCountLate++ }
    }
    const played = withinApBudget(state, cards)
    apSpent += apCostOf(state, played)
    for (const id of played) cardUse[id] = (cardUse[id] ?? 0) + 1
    s = advanceTurn(state, played)
  }

  const assets = Math.max(0, totalAssets(s))
  const priceMul: Record<string, number> = {}
  for (const st of s.stocks) {
    const def = s.stockDefs.find(d => d.id === st.id)
    if (def) priceMul[st.id] = st.price / def.initialPrice
  }
  return {
    ending: s.ending?.endingId ?? 'unknown',
    titles: s.ending?.titles ?? [],
    assets, shakenTurns: s.trackers.shakenTurns,
    bankrupt: s.ending?.endingId === 'legend', turns: s.turn,
    priceMul, moodTurns,
    apSpent, rerolls,
    gradeSumEarly, gradeCountEarly, gradeSumLate, gradeCountLate,
    everShaken: everShaken || isShaken(s), endedShaken: isShaken(s),
    cardUse,
  }
}

const quantile = (sorted: number[], q: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!

export function runBatch(runs: number, strategy: Strategy, seed0 = 1): BatchReport {
  const endingCounts: Record<string, number> = {}
  const assets: number[] = []
  const muls: Record<string, number[]> = {}
  const titleCounts: Record<string, number> = {}
  let bankrupt = 0, shaken = 0, shakenRuns = 0
  const moodTotal: Record<Mood, number> = { normal: 0, shaken: 0, joy: 0 }
  const moodRuns: Record<Mood, number> = { normal: 0, shaken: 0, joy: 0 }
  const cardTotal: Record<string, number> = {}
  let apSpent = 0, rerolls = 0, turnsPlayed = 0
  let gEarlySum = 0, gEarlyN = 0, gLateSum = 0, gLateN = 0
  let everShakenRuns = 0, stuckRuns = 0

  for (let i = 0; i < runs; i++) {
    const r = playOne(seed0 + i, strategy)
    endingCounts[r.ending] = (endingCounts[r.ending] ?? 0) + 1
    assets.push(r.assets)
    if (r.bankrupt) bankrupt++
    shaken += r.shakenTurns
    if (r.shakenTurns > 0) shakenRuns++
    for (const [id, m] of Object.entries(r.priceMul)) (muls[id] ??= []).push(m)
    apSpent += r.apSpent
    rerolls += r.rerolls
    turnsPlayed += r.turns
    gEarlySum += r.gradeSumEarly; gEarlyN += r.gradeCountEarly
    gLateSum += r.gradeSumLate; gLateN += r.gradeCountLate
    if (r.everShaken) { everShakenRuns++; if (r.endedShaken) stuckRuns++ }
    for (const [id, n] of Object.entries(r.cardUse)) cardTotal[id] = (cardTotal[id] ?? 0) + n
    for (const t of r.titles) titleCounts[t] = (titleCounts[t] ?? 0) + 1
    for (const m of ['normal', 'shaken', 'joy'] as const) {
      moodTotal[m] += r.moodTurns[m]
      if (r.moodTurns[m] > 0) moodRuns[m]++
    }
  }
  assets.sort((a, b) => a - b)

  const priceMulMedian: Record<string, number> = {}
  const priceUpRate: Record<string, number> = {}
  for (const [id, arr] of Object.entries(muls)) {
    const sorted = [...arr].sort((a, b) => a - b)
    priceMulMedian[id] = quantile(sorted, 0.5)
    priceUpRate[id] = arr.filter(m => m >= 1).length / arr.length
  }
  const titleRate: Record<string, number> = {}
  for (const [t, n] of Object.entries(titleCounts)) titleRate[t] = n / runs

  const moodSum = moodTotal.normal + moodTotal.shaken + moodTotal.joy
  const moodShare: Record<Mood, number> = { normal: 0, shaken: 0, joy: 0 }
  const moodReach: Record<Mood, number> = { normal: 0, shaken: 0, joy: 0 }
  for (const m of ['normal', 'shaken', 'joy'] as const) {
    moodShare[m] = moodSum === 0 ? 0 : moodTotal[m] / moodSum
    moodReach[m] = moodRuns[m] / runs
  }

  const cardSum = Object.values(cardTotal).reduce((a, b) => a + b, 0)
  const cardUse: Record<string, number> = {}
  for (const [id, n] of Object.entries(cardTotal)) cardUse[id] = cardSum === 0 ? 0 : n / cardSum

  return {
    runs, strategy, endingCounts,
    bankruptRate: bankrupt / runs,
    assetsMedian: quantile(assets, 0.5),
    assetsP10: quantile(assets, 0.1),
    assetsP90: quantile(assets, 0.9),
    avgShakenTurns: shaken / runs,
    shakenRate: shakenRuns / runs,
    priceMulMedian, priceUpRate, titleRate, moodShare, moodReach,
    // 분모는 **실제로 돈 턴 수**다. 파산으로 일찍 끝난 판을 156턴으로 나누면
    // 행동력을 안 쓴 것처럼 보인다.
    avgApSpent: turnsPlayed === 0 ? 0 : apSpent / turnsPlayed,
    avgGradeIdxEarly: gEarlyN === 0 ? 0 : gEarlySum / gEarlyN,
    avgGradeIdxLate: gLateN === 0 ? 0 : gLateSum / gLateN,
    rerollUse: turnsPlayed === 0 ? 0 : rerolls / turnsPlayed,
    stuckInShakenRate: everShakenRuns === 0 ? 0 : stuckRuns / everShakenRuns,
    cardUse,
  }
}

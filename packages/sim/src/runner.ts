import { initGame, advanceTurn, resolveChoice, loadEvents, totalAssets, cardsPerTurn, BALANCE, createRng, Rand } from '@bb/core'
import { act, type Strategy } from './strategies'

export interface RunResult {
  ending: string; titles: string[]; assets: number
  shakenTurns: number; bankrupt: boolean; turns: number
  /** 종목별 최종가 / 초기가. 시장이 종목에 무슨 짓을 했는지는 자산 분위수로는 안 보인다. */
  priceMul: Record<string, number>
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
}

const events = loadEvents()

export function playOne(seed: number, strategy: Strategy): RunResult {
  let s = initGame(seed)
  const rand = new Rand(createRng(seed ^ 0xabcdef))

  for (let i = 0; i < BALANCE.totalTurns && s.status === 'playing'; i++) {
    // 대기 중인 선택지는 무작위로 해소
    while (s.pendingChoices.length > 0) {
      const c = s.pendingChoices[0]!
      const def = events.find(e => e.id === c.eventId)
      const n = def?.choices?.length ?? 0
      s = n > 0 ? resolveChoice(s, c.eventId, rand.int(0, n - 1), events)
                : { ...s, pendingChoices: s.pendingChoices.slice(1) }
    }
    const { state, cards } = act(s, strategy, rand)
    s = advanceTurn(state, cards.slice(0, cardsPerTurn(state)))
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
    priceMul,
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

  for (let i = 0; i < runs; i++) {
    const r = playOne(seed0 + i, strategy)
    endingCounts[r.ending] = (endingCounts[r.ending] ?? 0) + 1
    assets.push(r.assets)
    if (r.bankrupt) bankrupt++
    shaken += r.shakenTurns
    if (r.shakenTurns > 0) shakenRuns++
    for (const [id, m] of Object.entries(r.priceMul)) (muls[id] ??= []).push(m)
    for (const t of r.titles) titleCounts[t] = (titleCounts[t] ?? 0) + 1
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

  return {
    runs, strategy, endingCounts,
    bankruptRate: bankrupt / runs,
    assetsMedian: quantile(assets, 0.5),
    assetsP10: quantile(assets, 0.1),
    assetsP90: quantile(assets, 0.9),
    avgShakenTurns: shaken / runs,
    shakenRate: shakenRuns / runs,
    priceMulMedian, priceUpRate, titleRate,
  }
}

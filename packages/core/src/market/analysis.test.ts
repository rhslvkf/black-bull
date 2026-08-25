import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { loadStockDefs, initStockStates } from './stocks'
import { GameError } from '../error'
import { analyzeStock } from './analysis'
import { BALANCE } from '../balance'

const withAnalysis = (a: number) => {
  const s = makeState({
    stockDefs: [makeStockDef({ id: 'a', volatility: 0.05 })],
    stocks: [makeStock({ id: 'a', price: 10000, fundamental: 10000 })],
  })
  s.player.stats.analysis = a
  return s
}

describe('analyzeStock', () => {
  it('같은 상태를 두 번 조회하면 같은 값이다 (결정론)', () => {
    const s = withAnalysis(3)
    expect(analyzeStock(s, 'a')).toEqual(analyzeStock(s, 'a'))
  })
  it('밴드는 low < high 이다', () => {
    for (let a = 0; a <= 10; a++) {
      const r = analyzeStock(withAnalysis(a), 'a')
      expect(r.fairLow).toBeLessThan(r.fairHigh)
      expect(r.fairLow).toBeGreaterThan(0)
    }
  })
  it('분석력이 높을수록 밴드가 좁다', () => {
    const lo = analyzeStock(withAnalysis(0), 'a')
    const hi = analyzeStock(withAnalysis(10), 'a')
    expect(hi.fairHigh - hi.fairLow).toBeLessThan(lo.fairHigh - lo.fairLow)
  })
  it('분석력 10이면 밴드 중앙이 실제 fundamental에 아주 가깝다', () => {
    const r = analyzeStock(withAnalysis(10), 'a')
    expect(Math.abs((r.fairLow + r.fairHigh) / 2 - 10000) / 10000).toBeLessThan(0.15)
  })
  it('분석력이 낮으면 종목마다 편차가 크게 벌어진다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'a' }), makeStockDef({ id: 'b' }), makeStockDef({ id: 'c' })],
      stocks: [makeStock({ id: 'a' }), makeStock({ id: 'b' }), makeStock({ id: 'c' })],
    })
    s.player.stats.analysis = 0
    const mids = ['a', 'b', 'c'].map(id => { const r = analyzeStock(s, id); return (r.fairLow + r.fairHigh) / 2 })
    expect(new Set(mids).size).toBe(3)
  })
  it('분석력이 오르면 값이 갱신된다', () => {
    expect(analyzeStock(withAnalysis(0), 'a')).not.toEqual(analyzeStock(withAnalysis(8), 'a'))
  })
  it('confidence는 0~1이고 분석력과 함께 오른다', () => {
    expect(analyzeStock(withAnalysis(0), 'a').confidence).toBeLessThan(analyzeStock(withAnalysis(10), 'a').confidence)
    expect(analyzeStock(withAnalysis(10), 'a').confidence).toBeLessThanOrEqual(1)
  })
  it('리스크 등급이 유효한 값이다', () => {
    for (let a = 0; a <= 10; a++) {
      expect(['낮음', '보통', '높음', '매우 높음']).toContain(analyzeStock(withAnalysis(a), 'a').risk)
    }
  })
  it('없는 종목은 예외', () => {
    expect(() => analyzeStock(withAnalysis(5), 'zz')).toThrow(GameError)
    let thrown: unknown
    try {
      analyzeStock(withAnalysis(5), 'zz')
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(GameError)
    expect((thrown as GameError).code).toBe('NO_STOCK')
  })
  it('종목별 편향은 분석력이 오를수록 줄어들 뿐 방향이 바뀌지 않는다 (재추첨 아님)', () => {
    const defs = loadStockDefs()
    const stocks = initStockStates(defs)
    const s = makeState({ stockDefs: defs, stocks })
    const ids = ['sjc', 'ecp', 'bio', 'shp', 'gam']
    for (const id of ids) {
      const def = defs.find(d => d.id === id)
      if (!def) throw new Error(`fixture missing ${id}`)
      const fundamental = def.fundamental
      const mid = (a: number) => {
        s.player.stats.analysis = a
        const r = analyzeStock(s, id)
        return (r.fairLow + r.fairHigh) / 2
      }
      const err0 = Math.abs(mid(0) - fundamental)
      const err5 = Math.abs(mid(5) - fundamental)
      const err10 = Math.abs(mid(10) - fundamental)
      expect(err10).toBeLessThan(err5)
      expect(err5).toBeLessThan(err0)
      const sign0 = Math.sign(mid(0) - fundamental)
      const sign5 = Math.sign(mid(5) - fundamental)
      const sign10 = Math.sign(mid(10) - fundamental)
      expect(sign5).toBe(sign0)
      expect(sign10).toBe(sign0)
    }
  })
  it('seed0과 state.rng.s가 다를 때, rng.s만 바꿔도 결과는 그대로다 (게임 RNG 스트림 미사용 증명)', () => {
    const s = makeState({
      seed0: 1,
      rng: { s: 999 },
      stockDefs: [makeStockDef({ id: 'a', volatility: 0.05 })],
      stocks: [makeStock({ id: 'a', price: 10000, fundamental: 10000 })],
    })
    s.player.stats.analysis = 3
    const before = analyzeStock(s, 'a')
    s.rng = { s: 424242 }
    const after = analyzeStock(s, 'a')
    expect(after).toEqual(before)
  })
})

/**
 * 최종 리뷰 M3 — 분석력의 체감을 결정하는 상수 전부가 analysis.ts에 리터럴로 박혀 있어
 * `BALANCE`로 옮겼다. 옮긴 값이 **실제로 읽히는지**(하드코딩 잔재가 없는지)는 기대값을
 * BALANCE에서 다시 계산해 비교해야만 고정된다 — 리터럴을 박으면 튜닝하는 순간 무의미해진다.
 */
describe('분석력 상수는 BALANCE.analysis에서만 온다 (최종 리뷰 M3)', () => {
  const A = BALANCE.analysis
  const halfOf = (a: number) => Math.max(A.bandMin, (A.sigmaBase * (1 - a / 10) + A.sigmaFloor) * A.bandMul)

  it('밴드 반폭이 BALANCE에서 계산한 값과 일치한다', () => {
    for (const a of [0, 3, 7, 10]) {
      const r = analyzeStock(withAnalysis(a), 'a')
      const half = (r.fairHigh - r.fairLow) / (r.fairHigh + r.fairLow)
      expect(half, `분석력 ${a}`).toBeCloseTo(halfOf(a), 3)
    }
  })
  it('confidence가 BALANCE에서 계산한 값과 일치한다', () => {
    for (const a of [0, 3, 7, 10]) {
      expect(analyzeStock(withAnalysis(a), 'a').confidence, `분석력 ${a}`)
        .toBeCloseTo(Math.min(1, A.confBase + a * A.confPerAnalysis), 10)
    }
  })
  it('리스크 등급이 BALANCE의 가중·경계에서 계산한 등급과 일치한다', () => {
    for (const volatility of [0.01, 0.05, 0.09, 0.13]) {
      const s = makeState({
        stockDefs: [makeStockDef({ id: 'a', volatility })],
        stocks: [makeStock({ id: 'a', price: 10000, fundamental: 10000 })],
      })
      s.player.stats.analysis = 4
      const r = analyzeStock(s, 'a')
      const est = (r.fairLow + r.fairHigh) / 2      // 밴드 중앙 = 추정 적정가
      const score = (10000 / est - 1) * A.overWeight + volatility * A.volWeight
      const expected = score > A.riskVeryHigh ? '매우 높음'
        : score > A.riskHigh ? '높음' : score > A.riskMid ? '보통' : '낮음'
      expect(r.risk, `volatility ${volatility} / score ${score.toFixed(3)}`).toBe(expected)
    }
  })
  it('위 세 단언이 서로 다른 등급을 실제로 밟는다 (한 등급에서만 도는 공회전이 아님)', () => {
    const grades = [0.01, 0.05, 0.09, 0.13].map(volatility => {
      const s = makeState({
        stockDefs: [makeStockDef({ id: 'a', volatility })],
        stocks: [makeStock({ id: 'a', price: 10000, fundamental: 10000 })],
      })
      s.player.stats.analysis = 4
      return analyzeStock(s, 'a').risk
    })
    expect(new Set(grades).size).toBeGreaterThanOrEqual(3)
  })
})

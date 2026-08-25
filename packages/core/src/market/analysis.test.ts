import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { analyzeStock } from './analysis'

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
    expect(() => analyzeStock(withAnalysis(5), 'zz')).toThrow()
  })
})

import { describe, it, expect } from 'vitest'
import { loadStockDefs, initStockStates, SECTORS, TIER_GATES } from './stocks'

describe('stocks 데이터', () => {
  const defs = loadStockDefs()
  it('10개다', () => expect(defs).toHaveLength(10))
  it('id가 유일하다', () => expect(new Set(defs.map(d => d.id)).size).toBe(10))
  it('8개 섹터가 모두 등장한다', () => {
    expect(new Set(defs.filter(d => !d.etf).map(d => d.sector)).size).toBe(8)
  })
  it('tierGate 0 종목이 3개 이상이다', () => {
    expect(defs.filter(d => d.tierGate === 0).length).toBeGreaterThanOrEqual(3)
  })
  it('수치가 유효 범위다', () => {
    defs.forEach(d => {
      expect(d.initialPrice).toBeGreaterThan(0)
      expect(d.fundamental).toBeGreaterThan(0)
      expect(d.volatility).toBeGreaterThan(0)
      expect(d.hype).toBeGreaterThanOrEqual(0)
      expect(d.hype).toBeLessThanOrEqual(1)
    })
  })
  it('ETF가 lev/inv 각 1개다', () => {
    expect(defs.filter(d => d.etf === 'lev')).toHaveLength(1)
    expect(defs.filter(d => d.etf === 'inv')).toHaveLength(1)
  })
  it('모든 종목의 sector가 유효하다', () => {
    defs.forEach(d => {
      expect(SECTORS).toContain(d.sector)
    })
  })
  it('모든 종목의 tierGate가 유효하다', () => {
    defs.forEach(d => {
      expect(TIER_GATES).toContain(d.tierGate)
    })
  })
  it('모든 종목의 etf가 유효하다', () => {
    defs.forEach(d => {
      expect([undefined, 'lev', 'inv']).toContain(d.etf)
    })
  })
  it('모든 종목의 가격이 정수다', () => {
    defs.forEach(d => {
      expect(Number.isInteger(d.initialPrice)).toBe(true)
      expect(Number.isInteger(d.fundamental)).toBe(true)
    })
  })
  it('initStockStates가 초기가로 상태를 만든다', () => {
    const st = initStockStates(defs)
    expect(st).toHaveLength(10)
    expect(st[0]!.price).toBe(defs[0]!.initialPrice)
    expect(st[0]!.history).toEqual([defs[0]!.initialPrice])
  })
})

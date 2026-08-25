import { describe, it, expect } from 'vitest'
import { createRng, rngNext, Rand } from './rng'

describe('rng', () => {
  it('같은 시드는 같은 수열', () => {
    const a = new Rand(createRng(42)), b = new Rand(createRng(42))
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })
  it('next는 [0,1)', () => {
    const r = new Rand(createRng(7))
    for (let i = 0; i < 1000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('int는 폐구간 [min,max]', () => {
    const r = new Rand(createRng(1))
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) { const v = r.int(1, 6); seen.add(v); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6) }
    expect(seen.size).toBe(6)
  })
  it('normal 평균 ≈ 0', () => {
    const r = new Rand(createRng(3))
    let sum = 0
    for (let i = 0; i < 4000; i++) sum += r.normal()
    expect(Math.abs(sum / 4000)).toBeLessThan(0.08)
  })
  it('pickWeighted는 가중치 0을 뽑지 않는다', () => {
    const r = new Rand(createRng(9))
    for (let i = 0; i < 200; i++) expect(r.pickWeighted(['a', 'b'], x => (x === 'a' ? 0 : 1))).toBe('b')
  })
  it('rngNext는 원본 상태를 변경하지 않는다', () => {
    const s0 = createRng(5)
    rngNext(s0)
    expect(s0).toEqual(createRng(5))
  })
})

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
  it('pickWeighted는 빈 배열에서 throw', () => {
    const r = new Rand(createRng(10))
    expect(() => r.pickWeighted([], () => 1)).toThrow('pickWeighted: empty items')
  })
  it('normal 평균과 표준편차 비기본값', () => {
    const r = new Rand(createRng(11))
    const mean = 50, sd = 10
    const samples: number[] = []
    for (let i = 0; i < 4000; i++) samples.push(r.normal(mean, sd))
    const sampleMean = samples.reduce((a, b) => a + b, 0) / samples.length
    const variance = samples.reduce((a, x) => a + (x - sampleMean) ** 2, 0) / samples.length
    const sampleSd = Math.sqrt(variance)
    expect(Math.abs(sampleMean - mean)).toBeLessThan(0.5)
    expect(Math.abs(sampleSd - sd)).toBeLessThan(0.5)
  })
  it('chance는 확률을 정확히 반영한다', () => {
    const r = new Rand(createRng(12))
    const never = r.chance(0)
    expect(never).toBe(false)
    const r2 = new Rand(createRng(13))
    const always = r2.chance(1)
    expect(always).toBe(true)
    const r3 = new Rand(createRng(14))
    let trueCount = 0
    for (let i = 0; i < 4000; i++) if (r3.chance(0.5)) trueCount++
    const ratio = trueCount / 4000
    expect(Math.abs(ratio - 0.5)).toBeLessThan(0.05)
  })
})

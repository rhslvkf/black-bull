// packages/core/src/market/regimes.test.ts
import { describe, it, expect } from 'vitest'
import { createRng } from '../rng/rng'
import { generateRegimes } from './regimes'
import { BALANCE } from '../balance'

function runs(rs: string[]) {
  const out: { v: string; n: number }[] = []
  for (const r of rs) {
    const last = out[out.length - 1]
    if (last && last.v === r) last.n++
    else out.push({ v: r, n: 1 })
  }
  return out
}

describe('generateRegimes', () => {
  it('길이가 정확히 156이다', () => {
    const [rs] = generateRegimes(createRng(1))
    expect(rs).toHaveLength(BALANCE.totalTurns)
  })
  it('첫 국면은 crash가 아니다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [rs] = generateRegimes(createRng(seed))
      expect(rs[0]).not.toBe('crash')
    }
  })
  it('crash가 최소 1회 포함된다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [rs] = generateRegimes(createRng(seed))
      expect(rs).toContain('crash')
    }
  })
  it('마지막 구간을 제외한 모든 구간 길이가 8 이상 30 이하다', () => {
    for (let seed = 0; seed < 100; seed++) {
      const [rs] = generateRegimes(createRng(seed))
      const rr = runs(rs)
      rr.slice(0, -1).forEach(r => {
        expect(r.n).toBeGreaterThanOrEqual(8)
        expect(r.n).toBeLessThanOrEqual(30)
      })
    }
  })
  it('같은 시드는 같은 결과', () => {
    const [a] = generateRegimes(createRng(77))
    const [b] = generateRegimes(createRng(77))
    expect(a).toEqual(b)
  })
  it('RngState를 진행시켜 반환한다', () => {
    const [, next] = generateRegimes(createRng(5))
    expect(next).not.toEqual(createRng(5))
  })
})

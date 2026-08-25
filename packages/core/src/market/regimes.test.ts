// packages/core/src/market/regimes.test.ts
import { describe, it, expect } from 'vitest'
import { createRng } from '../rng/rng'
import { generateRegimes, fallbackRegimes } from './regimes'
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
  it('totalTurns < 16은 에러를 던진다', () => {
    expect(() => generateRegimes(createRng(1), 15)).toThrow('generateRegimes: totalTurns must be at least 16')
  })
  it('totalTurns >= 16은 에러를 던지지 않는다', () => {
    expect(() => generateRegimes(createRng(1), 16)).not.toThrow()
  })
  it('여러 totalTurns 값에서 모든 구간이 8 이상 30 이하다', () => {
    const testTurns = [16, 32, 100, 156]
    for (const totalTurns of testTurns) {
      for (let seed = 0; seed < 5; seed++) {
        const [rs] = generateRegimes(createRng(seed), totalTurns)
        expect(rs).toHaveLength(totalTurns)
        const rr = runs(rs)
        rr.slice(0, -1).forEach(r => {
          expect(r.n).toBeGreaterThanOrEqual(8)
          expect(r.n).toBeLessThanOrEqual(30)
        })
      }
    }
  })
})

describe('fallbackRegimes', () => {
  it('정확한 길이를 반환한다', () => {
    const testTurns = [16, 17, 23, 30, 31, 32, 47, 100, 156]
    for (const totalTurns of testTurns) {
      const rs = fallbackRegimes(totalTurns)
      expect(rs).toHaveLength(totalTurns)
    }
  })
  it('첫 국면은 crash가 아니다', () => {
    const testTurns = [16, 17, 23, 30, 31, 32, 47, 100, 156]
    for (const totalTurns of testTurns) {
      const rs = fallbackRegimes(totalTurns)
      expect(rs[0]).not.toBe('crash')
    }
  })
  it('crash가 포함된다', () => {
    const testTurns = [16, 17, 23, 30, 31, 32, 47, 100, 156]
    for (const totalTurns of testTurns) {
      const rs = fallbackRegimes(totalTurns)
      expect(rs).toContain('crash')
    }
  })
  it('모든 구간 길이가 8 이상 30 이하다 (마지막 포함)', () => {
    const testTurns = [16, 17, 23, 30, 31, 32, 47, 100, 156]
    for (const totalTurns of testTurns) {
      const rs = fallbackRegimes(totalTurns)
      const rr = runs(rs)
      rr.forEach(r => {
        expect(r.n).toBeGreaterThanOrEqual(8)
        expect(r.n).toBeLessThanOrEqual(30)
      })
    }
  })
})

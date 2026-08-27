import { describe, it, expect } from 'vitest'
import { seedFromQuery } from './seedParam'

describe('seedFromQuery — 감사 재현용 시드 입구 (Ruling 39)', () => {
  it('정수 시드를 읽는다', () => {
    expect(seedFromQuery('?seed=12345')).toBe(12345)
    expect(seedFromQuery('?a=1&seed=7&b=2')).toBe(7)
    expect(seedFromQuery('?seed=0')).toBe(0)
  })
  it('없거나 빈 값이면 null이다 — 평소대로 무작위 시드를 쓴다', () => {
    expect(seedFromQuery('')).toBeNull()
    expect(seedFromQuery('?x=1')).toBeNull()
    expect(seedFromQuery('?seed=')).toBeNull()
    expect(seedFromQuery('?seed=%20')).toBeNull()
  })
  it('정수가 아니면 무시한다 — 조용히 NaN을 게임에 넣지 않는다', () => {
    for (const bad of ['abc', '1.5', '-3', '1e5', '0x10', '12a']) {
      expect(seedFromQuery(`?seed=${bad}`), bad).toBeNull()
    }
  })
  it('32비트 범위를 벗어나면 무시한다 (createRng의 전제)', () => {
    expect(seedFromQuery(`?seed=${2 ** 31 - 1}`)).toBe(2 ** 31 - 1)
    expect(seedFromQuery(`?seed=${2 ** 31}`)).toBeNull()
    expect(seedFromQuery('?seed=99999999999999999999')).toBeNull()
  })
})

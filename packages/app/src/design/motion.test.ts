import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCountUp, useTypewriter } from './motion'
import { matchMediaMock } from './testUtils'

describe('useCountUp', () => {
  it('reduced-motion이면 즉시 목표값이다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const { result } = renderHook(() => useCountUp(1000))
    expect(result.current).toBe(1000)
  })

  it('애니메이션 중에는 목표값보다 작다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', false)
    const { result } = renderHook(() => useCountUp(1000))
    expect(result.current).toBeLessThan(1000)
  })

  it('목표값이 0이어도(reduced-motion) 정상 동작한다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const { result } = renderHook(() => useCountUp(0))
    expect(result.current).toBe(0)
  })
})

describe('useTypewriter', () => {
  it('처음에는 일부만 보인다', () => {
    const { result } = renderHook(() => useTypewriter('안녕하세요 반갑습니다'))
    expect(result.current.shown.length).toBeLessThan('안녕하세요 반갑습니다'.length)
    expect(result.current.done).toBe(false)
  })

  it('skip하면 즉시 전문이 보인다', () => {
    const { result } = renderHook(() => useTypewriter('안녕하세요'))
    act(() => result.current.skip())
    expect(result.current.shown).toBe('안녕하세요')
    expect(result.current.done).toBe(true)
  })

  it('reduced-motion이면 처음부터 전문이다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const { result } = renderHook(() => useTypewriter('안녕하세요'))
    expect(result.current.done).toBe(true)
  })

  it('시간이 지나면 한 글자씩 늘어난다', async () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', false)
    const { result } = renderHook(() => useTypewriter('안녕하세요', 5))
    const firstLen = result.current.shown.length
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 40))
    })
    expect(result.current.shown.length).toBeGreaterThan(firstLen)
  })
})

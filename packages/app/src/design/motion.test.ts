import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

  describe('기본 타이핑 속도(msPerChar 인자 없이)', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('400ms 동안 8~20자 사이가 드러난다(10배 느려지거나 10배 빨라지면 실패)', async () => {
      matchMediaMock('(prefers-reduced-motion: reduce)', false)
      // 커스텀 인자를 넘기지 않는다 — motion.ts의 기본값(msPerChar) 경로 자체를 잰다.
      // 300자짜리 텍스트를 써서 "너무 빨라짐" 뮤테이션도 전문 노출로 상한에 막혀
      // 숨지 않게 한다.
      const text = '가'.repeat(300)
      const { result } = renderHook(() => useTypewriter(text))
      // 1ms씩 잘게 나눠 진행한다 — 매 setTimeout 콜백 사이에 React 렌더/effect가 실제로
      // 플러시돼야 다음 글자의 setTimeout이 새로 걸리는데, 한 번에 크게 advance하면
      // 그 사이 렌더를 기다려주지 않아 첫 한 글자만 진행되고 멈춘다(확인됨). 1ms는
      // "10배 빨라짐" 뮤테이션(3.2ms/자)보다도 촘촘해 어떤 속도에서도 프레임을 놓치지 않는다.
      for (let i = 0; i < 400; i++) {
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          await vi.advanceTimersByTimeAsync(1)
        })
      }
      const revealed = result.current.shown.length
      // 기본값 32ms/자 기준 400ms → 약 12자. 50ms/자보다 느리면 400ms에 8자 미만,
      // 20ms/자보다 빠르면 400ms에 20자 초과 — 그 구간을 "합리적 타이핑 속도"로 잡는다.
      // (VN 대사 타이핑은 보통 초당 20~50자 안팎이 자연스럽다고 보는 값.)
      expect(revealed).toBeGreaterThanOrEqual(8)
      expect(revealed).toBeLessThanOrEqual(20)
    })
  })

  it('텍스트가 도중에 바뀌면 이전 텍스트가 남지 않고 처음부터 다시 친다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true) // reduced-motion으로 즉시 완성 상태를 만들어 타이밍에 기대지 않는다.
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useTypewriter(text),
      { initialProps: { text: '첫 번째 대사입니다' } },
    )
    expect(result.current.done).toBe(true)
    expect(result.current.shown).toBe('첫 번째 대사입니다')

    rerender({ text: '두 번째 대사' })

    // reduced-motion이므로 다음 렌더에서도 즉시 전문이지만, 반드시 "새" 텍스트의
    // 전문이어야 한다 — 이전 텍스트가 이어붙거나 남아 있으면 안 된다(VN에서 이벤트가
    // 연달아 뜰 때 매우 흔한 경로).
    expect(result.current.shown).toBe('두 번째 대사')
    expect(result.current.done).toBe(true)
  })

  it('reduced-motion이 아닐 때도 텍스트가 바뀌면 새 텍스트를 처음부터 친다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', false)
    const { result, rerender } = renderHook(
      ({ text }: { text: string }) => useTypewriter(text),
      { initialProps: { text: '첫 번째' } },
    )
    act(() => result.current.skip())
    expect(result.current.shown).toBe('첫 번째')
    expect(result.current.done).toBe(true)

    rerender({ text: '두 번째 대사' })

    // 새 텍스트로 바뀐 직후에는 done이 다시 false이고, 드러난 부분은 새 텍스트의
    // 접두사여야 한다(이전 텍스트 "첫 번째"의 잔재가 없어야 한다).
    expect(result.current.done).toBe(false)
    expect(result.current.shown.length).toBeLessThan('두 번째 대사'.length)
    expect('두 번째 대사'.startsWith(result.current.shown)).toBe(true)
  })
})

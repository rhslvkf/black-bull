import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCountUp, useShake, useShakePulse, useTypewriter } from './motion'
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

describe('useShake (§6 타격감 — 막힌 동작의 짧은 흔들림)', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('처음에는 흔들리지 않는다', () => {
    const { result } = renderHook(() => useShake(200))
    expect(result.current[0]).toBe(false)
  })

  it('trigger()를 부르면 즉시 흔들리고, duration 뒤 자동으로 꺼진다', () => {
    const { result } = renderHook(() => useShake(200))
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current[0]).toBe(false)
  })

  it('duration이 지나기 전에 다시 trigger()하면 타이머가 재시작된다(계속 흔들린 채 유지)', () => {
    const { result } = renderHook(() => useShake(200))
    act(() => result.current[1]())
    act(() => { vi.advanceTimersByTime(150) })
    act(() => result.current[1]()) // 재시작
    act(() => { vi.advanceTimersByTime(150) }) // 최초 트리거로부터 300ms — 재시작 없었으면 이미 꺼졌을 시점
    expect(result.current[0]).toBe(true)
    act(() => { vi.advanceTimersByTime(50) }) // 재시작 시점으로부터 200ms
    expect(result.current[0]).toBe(false)
  })
})

describe('useShakePulse (§6 타격감 — 흔들림 진입 시 화면 가장자리 맥동)', () => {
  // beforeEach/afterEach로 묶는다(useShake describe와 같은 패턴) — 개별 it 안에서
  // vi.useFakeTimers()/vi.useRealTimers()를 직접 짝지으면, 그 사이의 assertion이
  // 실패해 던질 때 useRealTimers()가 실행되지 못하고 fake timer가 다음 테스트(특히
  // 이 파일 뒤쪽의 useTypewriter 테스트들, setTimeout 기반)로 새어나간다 — 실제로
  // 겪은 사고(MU6 뮤테이션 테스트 중 발견).
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('흔들리지 않는 상태로 마운트되면 펄스가 없다', () => {
    const { result } = renderHook(() => useShakePulse(false))
    expect(result.current).toBe(false)
  })

  it('마운트 즉시 흔들린 상태라면(진입이 아니라 이미 흔들리는 채 시작) 펄스를 켜지 않는다', () => {
    // "진입 시" 한 번만 맥동해야 한다 — 이미 흔들리는 판을 새로고침해서 다시 열었다고
    // 매번 펄스가 도는 것은 스펙 의도가 아니다.
    const { result } = renderHook(() => useShakePulse(true))
    expect(result.current).toBe(false)
  })

  it('false→true로 바뀌는 순간(흔들림 진입) 펄스가 켜진다', () => {
    const { result, rerender } = renderHook(({ shaken }) => useShakePulse(shaken, 500), {
      initialProps: { shaken: false },
    })
    expect(result.current).toBe(false)
    rerender({ shaken: true })
    expect(result.current).toBe(true)
  })

  it('duration이 지나면 흔들림이 계속돼도 펄스는 저절로 꺼진다("한 번" 맥동)', () => {
    const { result, rerender } = renderHook(({ shaken }) => useShakePulse(shaken, 500), {
      initialProps: { shaken: false },
    })
    rerender({ shaken: true })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(500) })
    expect(result.current).toBe(false)
  })

  it('흔들림에서 벗어나면 타임아웃을 기다리지 않고 즉시 펄스가 꺼진다(MU6)', () => {
    const { result, rerender } = renderHook(({ shaken }) => useShakePulse(shaken, 5000), {
      initialProps: { shaken: false },
    })
    rerender({ shaken: true })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(10) }) // 타임아웃(5000ms)에는 한참 못 미친다
    rerender({ shaken: false }) // 흔들림에서 벗어남
    expect(result.current).toBe(false)
  })

  it('reduced-motion이면 흔들림에 진입해도 펄스가 켜지지 않는다 (§6 제1 제약)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const { result, rerender } = renderHook(({ shaken }) => useShakePulse(shaken), {
      initialProps: { shaken: false },
    })
    rerender({ shaken: true })
    expect(result.current).toBe(false)
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

  describe('텍스트 교체 시 리셋 (regression)', () => {
    // 이전 라운드의 테스트는 "짧은 텍스트 → 긴 텍스트" 방향만 썼는데, 그 방향에서는
    // 리셋이 안 돼도 slice(0, oldIndex)가 새 텍스트의 접두사와 우연히 일치해(모든
    // slice(0,n)은 정의상 그 문자열의 접두사이므로) 버그가 잡히지 않았다(재리뷰에서
    // setIndex(0) 삭제·deps=[] 변경 둘 다로 실측 확인됨 — 283/283 그린이었음).
    // 이번에는 (1) 길이·접두사 비교가 아니라 "완전히 처음 상태(빈 문자열)"라는 상태
    // 자체를 직접 단언하고, (2) 옛 텍스트가 새 텍스트보다 긴 대칭 방향도 추가한다 —
    // 그 방향에서는 리셋이 안 되면 slice가 새 텍스트 길이에서 클램프돼 오히려 "이미
    // 다 쳐진 것처럼" 보이는 반대쪽 실패 양상이 나온다. 두 방향을 다 걸어야 어느
    // 쪽으로 고장 나도 잡힌다.

    it('[짧은 텍스트 → 긴 텍스트] 리렌더 직후 처음부터 다시 시작한다(빈 문자열)', () => {
      matchMediaMock('(prefers-reduced-motion: reduce)', false)
      const { result, rerender } = renderHook(
        ({ text }: { text: string }) => useTypewriter(text),
        { initialProps: { text: '가나다라' } }, // 4자
      )
      act(() => result.current.skip())
      expect(result.current.shown).toBe('가나다라')
      expect(result.current.done).toBe(true)

      rerender({ text: '마바사아자차카' }) // 7자 — 옛 텍스트보다 길다

      // 리셋이 안 되면 index=4가 남아 새 텍스트의 앞 4글자("마바사아")가 그대로
      // 보이는데, 그것도 "새 텍스트의 접두사"라 길이·접두사 비교식 단언은 우연히
      // 통과해버린다. 상태 자체(빈 문자열)를 직접 본다.
      expect(result.current.shown).toBe('')
      expect(result.current.done).toBe(false)
    })

    it('[긴 텍스트 → 짧은 텍스트] 리렌더 직후 처음부터 다시 시작한다(빈 문자열)', () => {
      matchMediaMock('(prefers-reduced-motion: reduce)', false)
      const { result, rerender } = renderHook(
        ({ text }: { text: string }) => useTypewriter(text),
        { initialProps: { text: '가나다라마바사아자차카' } }, // 11자
      )
      act(() => result.current.skip())
      expect(result.current.shown).toBe('가나다라마바사아자차카')
      expect(result.current.done).toBe(true)

      rerender({ text: '마바사' }) // 3자 — 옛 텍스트보다 짧다

      // 리셋이 안 되면 index=11이 그대로 남아 slice(0,11)이 새 텍스트(3자) 길이에서
      // 클램프돼 "이미 다 쳐진 상태"(shown='마바사', done=true)처럼 보인다 —
      // 짧은→긴 방향과는 반대의 실패 양상이라 그 테스트만으로는 안 잡힌다.
      expect(result.current.shown).toBe('')
      expect(result.current.done).toBe(false)
    })

    it('[reduced-motion, 짧은 → 긴] 리렌더 직후 새 텍스트 전문이 바로 보인다', () => {
      matchMediaMock('(prefers-reduced-motion: reduce)', true)
      const { result, rerender } = renderHook(
        ({ text }: { text: string }) => useTypewriter(text),
        { initialProps: { text: '가나' } }, // 2자
      )
      expect(result.current.shown).toBe('가나')
      expect(result.current.done).toBe(true)

      rerender({ text: '마바사아자차카' }) // 7자 — 옛 텍스트보다 길다.
      // 리셋이 안 되면(index=2 유지) slice(0,2)라 새 텍스트 앞 2글자만 보인다 —
      // 짧은→긴 방향을 골라 클램프에 가려지지 않게 하고 reduced-motion 경로의
      // 리셋도 함께 고정한다.
      expect(result.current.shown).toBe('마바사아자차카')
      expect(result.current.done).toBe(true)
    })
  })
})

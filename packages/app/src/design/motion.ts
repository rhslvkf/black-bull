import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 모션 3단계(design/tokens.css의 --dur-fast/base/slow와 값을 맞춘다).
 * CSS 커스텀 프로퍼티는 JS에서 바로 쓸 수 없어(getComputedStyle 파싱은 과하다)
 * 숫자 상수로 나란히 둔다 — 값이 바뀌면 두 곳을 함께 고친다.
 */
export const DUR_FAST = 120
export const DUR_BASE = 240
export const DUR_SLOW = 480

/** 숫자 롤업 기본 지속시간. "상태 전이" 층(스펙 §6)에 속한다. */
const COUNT_UP_DURATION = DUR_SLOW

/** 타자기 한 글자당 간격(ms). VN 대사 타이핑 속도. */
const TYPEWRITER_MS_PER_CHAR = 32

/**
 * `prefers-reduced-motion: reduce`를 확인한다.
 *
 * jsdom에는 기본적으로 `window.matchMedia`가 없다(테스트 헬퍼 `matchMediaMock`이
 * 세워주기 전까지). 그 상태에서 호출해도 화면이 죽지 않도록 존재 여부를 먼저 본다 —
 * 없으면 "reduced-motion이 아니다"로 취급한다(모션이 기본값인 실제 브라우저와 동일).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * 숫자 롤업 훅. HUD 자산·수익률 등 값이 바뀔 때 목표값까지 부드럽게 올라가는 값을
 * 반환한다. `prefers-reduced-motion`이면 애니메이션 없이 항상 목표값을 즉시 반환한다.
 *
 * 초기값은 reduced-motion이 아니면 0에서 시작한다(마운트 직후에는 목표값보다
 * 반드시 작다) — 실제 애니메이션은 이어지는 effect가 requestAnimationFrame으로 굴린다.
 */
export function useCountUp(value: number, duration = COUNT_UP_DURATION): number {
  const [display, setDisplay] = useState<number>(() => (prefersReducedMotion() ? value : 0))
  const fromRef = useRef<number>(display)

  useEffect(() => {
    if (prefersReducedMotion()) {
      fromRef.current = value
      setDisplay(value)
      return
    }
    const from = fromRef.current
    if (from === value) return

    let rafId: number
    const start = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - start) / duration)
      const next = Math.round(from + (value - from) * easeOutCubic(t))
      setDisplay(next)
      if (t < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value, duration])

  return display
}

/** 막힌 동작(§6 "타격감" — 예: 손절 봉인 상태의 매도 버튼)에 짧게 흔들림 피드백을
 *  준다. `trigger()`를 부르면 `shaking`이 즉시 true가 됐다가 `duration` 뒤 자동으로
 *  false로 돌아온다. 연달아 누르면 타이머를 다시 시작해(clearTimeout 후 재설정)
 *  매번 새 애니메이션 사이클처럼 보이게 한다.
 *
 *  reduced-motion을 이 훅 자신은 따로 보지 않는다 — `shaking` 자체는 "막힌 동작을
 *  건드렸다"는 상태 신호이고(테스트가 이 신호로 흔들림 클래스 부착 여부를 고정한다),
 *  실제 시각적 흔들림(keyframe)은 CSS 쪽(.shake, index.css)이 `char-stage-shaken`과
 *  같은 패턴으로 `@media (prefers-reduced-motion: reduce)`에서 끈다. */
export function useShake(duration = DUR_BASE): [boolean, () => void] {
  const [shaking, setShaking] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback(() => {
    setShaking(true)
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setShaking(false), duration)
  }, [duration])

  useEffect(() => () => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
  }, [])

  return [shaking, trigger]
}

/** 흔들림(멘탈 위기, `isShaken`) 상태 **진입 시** 화면 가장자리를 한 번 맥동시키는
 *  훅(§6 "타격감" — "흔들림 진입 시 화면 가장자리 맥동"). `shaken`이 false→true로
 *  바뀌는 순간에만 짧게 펄스를 켠다:
 *   - 이미 흔들리는 동안 계속 펄스가 돌면 안 된다(스펙 "한 번" 맥동) → `duration` 뒤
 *     자동으로 꺼진다.
 *   - 흔들림에서 벗어난 뒤에도 펄스가 남아 있으면 안 된다(브리프 MU6) → `shaken`이
 *     false가 되는 즉시 펄스를 강제로 끈다. 자연 타임아웃을 기다리지 않는다.
 *  prefers-reduced-motion이면 펄스를 아예 켜지 않는다 — 이 훅은 순수 시각 효과라
 *  useShake와 달리(위 주석) "상태 신호"로서의 쓸모가 따로 없다. */
export function useShakePulse(shaken: boolean, duration = DUR_SLOW * 2): boolean {
  const [pulsing, setPulsing] = useState(false)
  const prevRef = useRef(shaken)

  useEffect(() => {
    const wasShaken = prevRef.current
    prevRef.current = shaken

    if (!shaken) {
      setPulsing(false)
      return
    }
    if (wasShaken) return // 계속 흔들리는 중 — 새 진입이 아니다.
    if (prefersReducedMotion()) return

    setPulsing(true)
    const id = setTimeout(() => setPulsing(false), duration)
    return () => clearTimeout(id)
  }, [shaken, duration])

  return pulsing
}

export interface Typewriter {
  /** 지금까지 드러난 텍스트. */
  shown: string
  /** 전문이 다 드러났는지. */
  done: boolean
  /** 즉시 전문을 보여준다(탭-투-스킵). */
  skip(): void
}

/**
 * VN 대사 타자기 훅. `prefers-reduced-motion`이면 처음부터 전문을 보여준다.
 * `text`가 바뀌면 처음부터 다시 타이핑한다.
 */
export function useTypewriter(text: string, msPerChar = TYPEWRITER_MS_PER_CHAR): Typewriter {
  const [index, setIndex] = useState<number>(() => (prefersReducedMotion() ? text.length : 0))
  const skippedRef = useRef<boolean>(prefersReducedMotion())

  // 텍스트가 바뀔 때마다 처음부터 다시 시작한다.
  useEffect(() => {
    if (prefersReducedMotion()) {
      skippedRef.current = true
      setIndex(text.length)
      return
    }
    skippedRef.current = false
    setIndex(0)
  }, [text])

  // 한 글자씩 진행한다. skip되었거나 이미 끝났으면 멈춘다.
  useEffect(() => {
    if (skippedRef.current) return
    if (index >= text.length) return
    const id = setTimeout(() => {
      setIndex(i => Math.min(text.length, i + 1))
    }, msPerChar)
    return () => clearTimeout(id)
  }, [index, text, msPerChar])

  const skip = useCallback(() => {
    skippedRef.current = true
    setIndex(text.length)
  }, [text])

  return { shown: text.slice(0, index), done: index >= text.length, skip }
}

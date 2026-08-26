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

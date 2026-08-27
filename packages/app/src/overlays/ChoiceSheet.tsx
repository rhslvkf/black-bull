import { useState } from 'react'
import type { EventChoice } from '@bb/core'
import { DUR_BASE, prefersReducedMotion } from '../design/motion'
import { TOUCH_TARGET_PX } from '../design/layout'

export interface ChoiceSheetProps {
  /**
   * 이 시트가 속한 이벤트 id. 선택 자체(`onChoose`가 받는 index)에는 필요 없지만,
   * "이미 골랐다" 방어 상태(아래 `resolvedIndex`)를 이벤트가 바뀔 때마다 새로
   * 시작하는 데 쓴다 — EventModal이 여러 이벤트를 순서대로 넘겨줄 때(§4.2 "여러
   * 선택지가 대기 중이면 순서대로 해소된다") 이전 이벤트에서 잠긴 버튼 상태가
   * 다음 이벤트로 새어들지 않아야 한다.
   */
  eventId: string
  /** 항상 2개 이상(Task 18 리뷰 확인 — 실제 콘텐츠에 선택지 1개짜리 이벤트는 없다). */
  choices: EventChoice[]
  /**
   * 대사를 다 읽었는가. false면 아무 것도 그리지 않는다(§4.2, 브리프 Step 1의 첫
   * 두 테스트가 이 계약을 고정한다 — 타이핑 중엔 시트가 없어야 하고, 다 읽어야
   * 나타나야 한다). EventModal이 DialogueBox의 `onDone`으로 이 값을 올린다.
   */
  open: boolean
  /** 선택지를 골랐을 때(0-based index). */
  onChoose: (index: number) => void
}

/**
 * 선택지 하단 시트(§4.2). "결정하는 순간"을 대사와 분리하기 위해 화면 하단에서
 * 올라온다 — 엄지 도달 범위(전역 제약)에 선택 버튼을 두는 것이 이 태스크의 목적이다.
 *
 * **중복 클릭 방어를 어디서 막는가(Task 19 결정, 3중 방어를 직접 실측)**:
 *   1. core의 `resolveChoice`는 같은 eventId를 두 번째로 호출하면 이미 대기열에서
 *      빠진 뒤라 무동작이다(engine.ts의 `pendingChoices.some(...)` 가드) — 스토어
 *      상태가 이미 갱신된 뒤라면 core 하나만으로도 이중 적용을 막는다.
 *   2. 이 컴포넌트가 렌더하는 `<button disabled={resolving}>` — 실측 결과(뮤테이션
 *      테스트) 이게 실제로 관측되는 방어의 핵심이다. `disabled` 버튼은 브라우저가
 *      네이티브로 클릭을 통째로 막고, React 18은 이 state 갱신을 같은 이벤트 처리
 *      안에서 동기적으로 커밋하므로, 두 번째 물리 클릭이 도착할 시점엔 이미 잠겨
 *      있다 — `ChoiceSheet.test.tsx`가 `disabled`만 지웠을 때 실제로 깨지는 것으로
 *      확인했다.
 *   3. `handleChoose` 안의 `if (resolving) return` — 위 2번이 이미 항상 먼저
 *      막으므로 지금 이 컴포넌트만 놓고 보면 관측 가능한 이중 방어다(뮤테이션
 *      테스트로도 확인: 이 줄만 지우고 `disabled`는 남겨두면 관측되는 동작이
 *      전혀 안 바뀐다 — 그래서 어떤 자동 테스트도 이 줄 하나만의 제거를 잡지
 *      못한다). 그래도 남겨두는 이유는 `disabled`가 미래에 실제 HTML `disabled`
 *      속성이 아니라 CSS(`pointer-events:none` 등)로만 흉내 내는 형태로 바뀌면
 *      (예: 잠금 중에도 다른 시각 효과를 얹고 싶어질 때) jsdom·실제 브라우저
 *      둘 다에서 클릭이 다시 새어 들 수 있어서다 — 그 순간부터는 이 줄이 유일한
 *      방어가 된다.
 */
export function ChoiceSheet({ eventId, choices, open, onChoose }: ChoiceSheetProps) {
  const [resolvedFor, setResolvedFor] = useState<{ eventId: string; index: number } | null>(null)

  if (!open) return null

  const resolving = resolvedFor !== null && resolvedFor.eventId === eventId

  function handleChoose(index: number): void {
    if (resolving) return
    setResolvedFor({ eventId, index })
    onChoose(index)
  }

  // §6 "화면 전환 — 오버레이 슬라이드업". prefers-reduced-motion이면 애니메이션 없이
  // 즉시 제자리에 나타난다. jsdom은 외부 CSS(@media 포함)를 읽지 않으므로(Ruling 20과
  // 같은 이유) 인라인 style로 내려 실측 가능하게 한다 — DialogueBox 로그 토글의
  // TOUCH_TARGET_PX와 같은 기법이다.
  const animation = prefersReducedMotion() ? 'none' : `choice-sheet-slide-up ${DUR_BASE}ms ease-out`

  return (
    <div className="choice-sheet" data-testid="choice-sheet" style={{ animation }}>
      <p className="choice-sheet-title">어떻게 할까?</p>
      <div className="choice-sheet-list">
        {choices.map((c, i) => (
          <button
            key={i}
            type="button"
            data-testid={`choice-${i}`}
            disabled={resolving}
            style={{ minHeight: TOUCH_TARGET_PX }}
            onClick={() => handleChoose(i)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  )
}

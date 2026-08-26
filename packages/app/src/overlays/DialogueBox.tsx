import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useTypewriter } from '../design/motion'
import { NPC_ID_BY_NAME_KO } from '../design/speakers'
import { TOUCH_TARGET_PX } from '../design/layout'

/** 화면에 이미 지나간 대사 한 줄. 로그(≡)가 쌓는 단위다. */
interface DialogueLine {
  speaker: string | null
  text: string
}

/**
 * 화자 표시 이름(정체를 감췄으면 '???')으로 이름표 배경색 CSS 변수를 고른다. `speaker`는
 * 이미 표시용 한국어 이름이라(§4.1 예시 그대로), 색 토큰을 찾으려면 design/speakers.ts의
 * 역방향 맵(NPC_ID_BY_NAME_KO)으로 먼저 npc id를 알아내야 한다. 알려진 조연 4인이
 * 아니면(예: '???', 또는 앞으로 추가될 화자) --speaker-unknown 중립색으로 떨어진다 —
 * 이 파일이 화자 이름을 직접 하드코딩하지 않는다(design/speakers.ts만 그 값을 안다).
 */
function speakerColorVar(speaker: string): string {
  const id = NPC_ID_BY_NAME_KO[speaker]
  return `var(--speaker-${id ?? 'unknown'})`
}

export interface DialogueBoxProps {
  /** 화자 표시 이름. `null`이면 이름표를 그리지 않는다(뉴스형 이벤트 등). 정체를
   *  감춘 등장은 '???'를 넘긴다. */
  speaker: string | null
  /** 지금 보여줄 대사 한 줄. */
  text: string
  /** 전문이 다 보인 뒤 탭하면 호출된다 — 다음 줄로 넘어가라는 신호. */
  onAdvance?: () => void
  /**
   * 전문이 다 드러나는 순간(자연 완료 또는 탭-투-스킵 둘 다) 호출된다. Task 19 추가 —
   * `onAdvance`와 달리 "완료 뒤 한 번 더 탭"을 요구하지 않는다. §4.2 선택지 시트는
   * "대사를 다 읽었는가" 하나만으로 열려야 한다(브리프 `renderEventWithChoices({text:'짧다'})`가
   * 단 한 번의 탭만으로 시트가 뜨길 기대한다 — 그 탭은 스킵일 뿐, onAdvance 경로가 아니다).
   * `done`이 true가 될 때마다 호출되므로(자연 완료·스킵·reduced-motion 즉시완료 전부 포함)
   * 호출하는 쪽에서 멱등하게 다뤄야 한다.
   */
  onDone?: () => void
}

/**
 * VN 대화창(스펙 §4.1). 세 가지를 한 컴포넌트가 맡는다:
 *   1. 타이핑 — design/motion.ts의 useTypewriter를 그대로 쓴다(Task 9, prefers-reduced-motion
 *      을 이미 존중하고 텍스트가 도중에 바뀌는 경로도 고정돼 있다 — 여기서 다시 만들지 않는다).
 *   2. 이름표 — 화자별 고정색(§4.1 "이름표는 화자별 고정 색").
 *   3. 로그(≡) — 지나간 대사를 다시 볼 수 있어야 VN이다(§0 "VN의 핵심 부품"). `text`
 *      prop이 바뀌는 순간(=다음 줄로 넘어가는 순간) 방금까지 보이던 줄을 로그에 커밋한다.
 *      아직 지나가지 않은 "지금 보이는" 줄은 절대 로그에 넣지 않는다 — 로그는 항상
 *      과거형이다.
 *
 * 탭 규약(§4.1 "≫는 타이핑 즉시 완성"): 타이핑 도중 탭하면 스킵만 하고 onAdvance는
 * 부르지 않는다 — 한 번의 탭으로 대사를 통째로 건너뛰는 사고를 막는다. 전문이 이미
 * 보인 상태에서 탭해야 비로소 onAdvance가 불린다.
 */
export function DialogueBox({ speaker, text, onAdvance, onDone }: DialogueBoxProps) {
  const { shown, done, skip } = useTypewriter(text)
  const [logOpen, setLogOpen] = useState(false)
  const [log, setLog] = useState<DialogueLine[]>([])
  const prevRef = useRef<DialogueLine | null>(null)

  useEffect(() => {
    const prev = prevRef.current
    if (prev && (prev.text !== text || prev.speaker !== speaker)) {
      // 방금까지 보이던 줄이 지금 막 지나갔다 — 로그에 커밋한다.
      setLog(l => [...l, prev])
    }
    prevRef.current = { speaker, text }
  }, [speaker, text])

  // Task 19 — onDone은 done이 "바뀌어 true가 됐을 때"만이 아니라 마운트 시점에 이미
  // true(reduced-motion, 빈 문자열 등)여도 불려야 한다 — 의존 배열이 [done] 하나뿐이라
  // effect는 매 렌더마다가 아니라 done 값이 실제로 바뀔 때만(마운트 최초 1회 포함)
  // 재실행된다.
  useEffect(() => {
    if (done) onDone?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])

  function handleAdvance(): void {
    if (!done) {
      skip()
      return
    }
    onAdvance?.()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleAdvance()
    }
  }

  function toggleLog(e: MouseEvent): void {
    // 로그 버튼 탭이 바깥 dialogue-box의 탭(스킵/다음)으로 번지지 않게 한다.
    e.stopPropagation()
    setLogOpen(o => !o)
  }

  return (
    <div
      className="dialogue-box"
      data-testid="dialogue-box"
      role="button"
      tabIndex={0}
      onClick={handleAdvance}
      onKeyDown={handleKeyDown}
    >
      {speaker !== null && (
        <span
          className="dialogue-speaker"
          data-testid="speaker-tag"
          style={{ backgroundColor: speakerColorVar(speaker) }}
        >
          {speaker}
        </span>
      )}
      <p className="dialogue-text" data-testid="dialogue-text">
        {shown}
        {!done && <span className="dialogue-caret" aria-hidden="true" />}
      </p>
      <button
        type="button"
        className="dialogue-log-toggle"
        data-testid="dialogue-log-toggle"
        aria-label="지난 대사 로그"
        aria-pressed={logOpen}
        style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
        onClick={toggleLog}
      >
        ≡
      </button>
      {logOpen && (
        <div className="dialogue-log" data-testid="dialogue-log" onClick={e => e.stopPropagation()}>
          {log.length === 0 ? (
            <p className="dialogue-log-empty" data-testid="dialogue-log-empty">아직 지난 대사가 없습니다.</p>
          ) : (
            log.map((line, i) => (
              <div key={i} className="dialogue-log-entry" data-testid={`dialogue-log-entry-${i}`}>
                {line.speaker !== null && <span className="dialogue-log-speaker">{line.speaker}</span>}
                <span className="dialogue-log-text">{line.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

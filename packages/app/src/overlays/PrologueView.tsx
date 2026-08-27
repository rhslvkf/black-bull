import { useState } from 'react'
import { useGame } from '../store/store'
import { ArtSlot, type SlotKind } from '../art/slots'
import { NPCS, type ArtKey } from '../art/keys'
import { speakerDisplayName } from '../design/speakers'
import { DialogueBox } from './DialogueBox'
import { TOUCH_TARGET_PX } from '../design/layout'

interface PrologueScene {
  art: ArtKey
  /** npc id 또는 화자 없음(나레이션). `null`이면 DialogueBox가 이름표를 안 그린다
   *  (design/speakers.ts, Task 17). */
  speaker: (typeof NPCS)[number] | null
  text: string
}

// 플레이어가 게임에서 처음 보는 화면(브리프) — 3년의 시작을 4장면으로 압축한다.
// 첫 장면만 화자가 있다(박대박이 수익률을 자랑하는 회식 자리) — 나머지는 주인공의
// 내적 나레이션이라 speaker: null이다. MU10 — speaker가 있는 장면은 반드시
// speakerDisplayName을 거쳐야 한다(id 그대로 넘기면 이름표가 회색 '???'/영문 id로
// 조용히 깨진다, Task 17 리뷰가 EventModal에서 지목한 함정과 동일).
const SCENES: readonly PrologueScene[] = [
  { art: 'npc.daebak.normal', speaker: 'daebak', text: '회식 자리. 박대박이 계좌를 돌린다.\n"+3,240만원 (+412%)"' },
  { art: 'char.tier0.normal', speaker: null, text: '집에 오는 길 내내 그 숫자가 떠나지 않는다.' },
  { art: 'bg.home', speaker: null, text: '새벽 2시. 증권사 앱을 깔고 적금을 깬다.\n시드 300만원.' },
  { art: 'char.tier0.joy', speaker: null, text: '"나만 없어 주식."\n\n그렇게 3년이 시작됐다.' },
]

/** 장면 아트 id의 접두사로 ArtSlot의 종류(§5 슬롯 규격)를 고른다 — 이 파일이 npc./char./
 *  bg. 세 접두사만 쓰므로 그 셋으로 충분하다(cutscene.*은 여기서 쓰지 않는다). */
function slotKindFor(id: ArtKey): SlotKind {
  if (id.startsWith('npc.')) return 'portrait'
  if (id.startsWith('bg.')) return 'background'
  return 'character'
}

/**
 * 프롤로그(§0 "플레이어가 게임에서 처음 보는 화면"). EventModal·CutsceneView와 같은
 * VN 문법으로 맞춘다(Task 20) — 이 컴포넌트는 더 이상 `onDone` prop을 받지 않고,
 * 스스로 스토어를 읽어 "지금 떠야 하는가"를 판단하고 스스로 닫는다(App.tsx가 이제
 * `<PrologueView />`를 다른 오버레이들과 나란히, 조건 없이 렌더한다).
 *
 * "떠야 하는가" 조건은 기존 App.tsx의 `needPrologue`를 그대로 옮겼다: 첫 판(codex.runs
 * === 0)의 1턴째(state.turn === 1)이고 아직 안 봤으면(!prologueDone). `finishPrologue`가
 * localStorage(PROLOGUE_KEY)에 커밋하므로 새로고침해도 다시 뜨지 않는다(store.ts, 최종
 * 리뷰 Minor 9 — 이 계약을 잃지 않는다).
 */
export function PrologueView() {
  const state = useGame(st => st.state)
  const codex = useGame(st => st.codex)
  const prologueDone = useGame(st => st.prologueDone)
  const finishPrologue = useGame(st => st.finishPrologue)
  const [i, setI] = useState(0)

  const needed = state !== null && codex.runs === 0 && state.turn === 1 && !prologueDone
  if (!needed) return null

  const scene = SCENES[Math.min(i, SCENES.length - 1)]!
  const isLast = i + 1 >= SCENES.length
  const dialogueSpeaker = scene.speaker !== null ? speakerDisplayName(scene.speaker) : null

  // MU8 방어 — 다음/스킵 둘 다 같은 종료 경로(finishPrologue)를 거친다. 여기서 상태만
  // 바꾸고 finishPrologue를 안 부르면 새로고침마다 프롤로그가 다시 뜬다(MU9).
  function advance(): void {
    if (isLast) finishPrologue()
    else setI(n => n + 1)
  }

  return (
    <div className="overlay prologue" data-testid="prologue">
      <button
        type="button"
        className="skip"
        data-testid="prologue-skip"
        style={{ minHeight: TOUCH_TARGET_PX }}
        onClick={finishPrologue}
      >
        건너뛰기
      </button>

      <div className="prologue-stage" data-testid="speaker-portrait" data-art-id={scene.art}>
        <ArtSlot kind={slotKindFor(scene.art)} id={scene.art} className="prologue-stage-art" />
      </div>

      <DialogueBox key={i} speaker={dialogueSpeaker} text={scene.text} onAdvance={advance} />

      <button
        type="button"
        className="primary"
        data-testid="prologue-next"
        style={{ minHeight: TOUCH_TARGET_PX }}
        onClick={advance}
      >
        {isLast ? '시작' : '다음'}
      </button>
    </div>
  )
}

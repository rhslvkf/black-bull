import { loadEvents } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import { NPCS } from '../art/keys'

const events = loadEvents()
const NPC_SET: ReadonlySet<string> = new Set(NPCS)
/** 이벤트 데이터의 speaker는 @bb/core에서 평범한 string으로 온다(타입으로 NPCS와 좁혀지지
 * 않는다). 타입 단언(as ArtKey) 없이 npc.* 아트 키로 좁히려면 런타임 멤버십 검사가 필요하다 —
 * 이 타입가드가 그 유일한 통로다. */
function isNpcName(x: string): x is (typeof NPCS)[number] {
  return NPC_SET.has(x)
}

export function EventModal() {
  const s = useGame(st => st.state)
  const choose = useGame(st => st.choose)
  const pending = s?.pendingChoices[0]
  if (!s || !pending) return null

  const def = events.find(e => e.id === pending.eventId)
  if (!def) return null
  const speaker = def.text.speaker

  return (
    <div className="overlay event" data-testid="event-modal">
      <div className="event-card">
        {speaker && isNpcName(speaker) && <Art id={`npc.${speaker}.normal`} size={56} />}
        <h3>{def.text.title}</h3>
        <p className="event-body">{def.text.body}</p>
        <div className="choices">
          {(def.choices ?? [{ label: '확인', effects: [] }]).map((c, i) => (
            <button key={i} data-testid={`choice-${i}`} onClick={() => choose(def.id, i)}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

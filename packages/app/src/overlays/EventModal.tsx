import { loadEvents } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import type { ArtKey } from '../art/keys'

const events = loadEvents()

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
        {speaker && <Art id={`npc.${speaker}` as ArtKey} size={56} />}
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

import { isCardAvailable, isShaken, loadCards } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'

const CARDS = loadCards()

export function CardGrid({ picked, onPick }: { picked: string[]; onPick: (id: string) => void }) {
  const s = useGame(st => st.state)
  if (!s) return null

  // 흔들림일 때 회복 카드를 최상단으로 (스펙 §3.3) — 회복 카드는 절대 잠기지 않는
  // 코어 불변식(isCardAvailable)을 플레이어가 실제로 알아채도록 만드는 정렬이다.
  const ordered = isShaken(s)
    ? [...CARDS].sort((a, b) => Number(!!b.isRecovery) - Number(!!a.isRecovery))
    : CARDS

  return (
    <div className="card-list" data-testid="card-list">
      {ordered.map(c => {
        const ok = isCardAvailable(s, c)
        const on = picked.includes(c.id)
        return (
          <button
            key={c.id} data-testid={`card-${c.id}`} disabled={!ok}
            className={`card${on ? ' picked' : ''}${c.isRecovery ? ' recovery' : ''}`}
            onClick={() => onPick(c.id)}
          >
            <span className="card-name">
              <Art id="ui.card" size={13} />
              <span>{c.name}</span>
              {!ok && <Art id="ui.lock" size={12} />}
            </span>
            <span className="card-desc">{c.desc}</span>
          </button>
        )
      })}
    </div>
  )
}

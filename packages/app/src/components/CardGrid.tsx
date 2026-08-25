import { cardLockReason, isShaken, loadCards, type CardLock } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'

const CARDS = loadCards()

// StockDetail이 매도 차단 이유를 문구로 설명하는 것과 같은 처방(최종 리뷰 Minor 12).
// 자물쇠 아이콘만으로는 티어 때문인지 돈 때문인지 흔들림 때문인지 알 수 없다.
const LOCK_REASON: Record<CardLock, string> = {
  tier: '티어가 모자란다',
  requires: '지금 상황에선 할 수 없다',
  money: '돈이 모자란다',
  shaken: '흔들려서 손에 안 잡힌다',
}

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
        const lock = cardLockReason(s, c)
        const ok = lock === null
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
            {lock && <span className="card-lock" data-testid={`card-lock-${c.id}`}>{LOCK_REASON[lock]}</span>}
          </button>
        )
      })}
    </div>
  )
}

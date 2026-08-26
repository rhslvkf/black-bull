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

  // Ruling 12 — 이번 턴 슬롯(행동 3칸 + 회복 1칸)만 그린다. 카드 11장을 전부 그리면
  // 슬롯 밖 8장이 "눌러도 아무 일 없는" 버튼이 된다 — core가 NOT_IN_SLOTS로 거부하고
  // 스토어 guard가 GameError를 삼키므로 화면에는 무반응으로 보인다.
  // (2×2 배치·등급 배지·행동력 표시는 Task 12·13의 몫이다. 여기서는 목록의 출처만 바꾼다.)
  const slotted = [...s.slots.action, s.slots.recovery].flatMap(slot => {
    const def = CARDS.find(c => c.id === slot.cardId)
    return def ? [def] : []
  })

  // 흔들림일 때 회복 카드를 최상단으로 (스펙 §3.3) — 회복 카드는 절대 잠기지 않는
  // 코어 불변식(isCardAvailable)을 플레이어가 실제로 알아채도록 만드는 정렬이다.
  const ordered = isShaken(s)
    ? [...slotted].sort((a, b) => Number(!!b.isRecovery) - Number(!!a.isRecovery))
    : slotted

  return (
    // Ruling 21 (Task 12) — 카드 버튼의 testid를 `card-${id}` → `slot-card-${id}`로
    // 바꾸고 `data-card-id`를 얹는다. Task 13이 이 자리를 2×2로 다시 그리며 같은
    // 선택자 계약(`slot-card-*` + `data-card-id`)을 유지할 것이므로, 컨테이너
    // testid(`card-list`)와 잠금 사유 testid(`card-lock-${id}`)는 카드 *버튼* 선택자와
    // 겹치는 접두사 문제가 없어(‘card-list’·’card-lock-x’는 `/^slot-card-/`에 걸리지
    // 않는다) 그대로 둔다 — 여기까지 바꾸면 Task 13이 계약을 유지할 이유가 없는
    // 부분까지 흔드는 셈이다.
    <div className="card-list" data-testid="card-list">
      {ordered.map(c => {
        const lock = cardLockReason(s, c)
        const ok = lock === null
        const on = picked.includes(c.id)
        return (
          <button
            key={c.id} data-testid={`slot-card-${c.id}`} data-card-id={c.id} disabled={!ok}
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

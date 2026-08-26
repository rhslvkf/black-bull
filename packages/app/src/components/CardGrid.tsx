import { actionPoints, cardApCost, cardLockReason, gradeOfSlot, isShaken, loadCards, type CardLock } from '@bb/core'
import { useGame } from '../store/store'
import { CardTile } from './CardTile'

const CARDS = loadCards()

// StockDetail이 매도 차단 이유를 문구로 설명하는 것과 같은 처방(최종 리뷰 Minor 12).
// 자물쇠 아이콘만으로는 티어 때문인지 돈 때문인지 흔들림 때문인지 알 수 없다.
const LOCK_REASON: Record<CardLock, string> = {
  tier: '티어가 모자란다',
  requires: '지금 상황에선 할 수 없다',
  money: '돈이 모자란다',
  shaken: '흔들려서 손에 안 잡힌다',
}

/** core의 4개 잠금 사유에 앱 전용 사유 하나(`ap` — 행동력 예산 초과)를 얹는다.
 *  core `CardLock`을 건드리지 않는 이유: 행동력 예산 게이팅은 슬롯·카드 규칙이
 *  아니라 스토어(`togglePick`)가 매기는 UI 정책이다(store.ts의 Ruling 21 주석 —
 *  "count 기반 limit"을 "실제 행동력 예산" 비교로 바꾼 그 자리). LOCK_REASON은
 *  그대로 재사용해 매핑을 두 군데 두지 않는다. */
type UiLockReason = CardLock | 'ap'
const UI_LOCK_REASON: Record<UiLockReason, string> = { ...LOCK_REASON, ap: '행동력이 부족하다' }

/** §3.1 "카드 2×2" — 컨테이너의 열 수는 이 상수 하나가 유일한 출처다. index.css의
 *  `.card-list`는 gap 등 나머지 시각 규칙만 두고 열 수는 선언하지 않는다 — CSS와
 *  인라인 스타일 두 곳에 "2"를 따로 적으면 한쪽만 고쳐 어긋나는 사고가 재발한다
 *  (등급색 복제와 같은 종류의 결함). jsdom은 외부 CSS를 읽지 않으므로(Ruling 20)
 *  인라인으로 내려야 테스트가 실제 배치를 실측할 수 있다.
 */
const CARD_GRID_COLUMNS = 2

/**
 * §3.1 홈 레이아웃의 슬롯 카드 2×2 — 행동 슬롯 3칸 + 회복 슬롯 1칸을 그린다.
 *
 * Ruling 12 — 이번 턴 슬롯만 그린다. 카드 11장을 전부 그리면 슬롯 밖 8장이 "눌러도
 * 아무 일 없는" 버튼이 된다 — core가 NOT_IN_SLOTS로 거부하고 스토어 guard가 GameError를
 * 삼키므로 화면에는 무반응으로 보인다.
 */
export function CardGrid({ picked, onPick }: { picked: string[]; onPick: (id: string) => void }) {
  const s = useGame(st => st.state)
  if (!s) return null

  const slotted = [...s.slots.action, s.slots.recovery].flatMap(slot => {
    const def = CARDS.find(c => c.id === slot.cardId)
    return def ? [{ def, slot }] : []
  })

  // 흔들림일 때 회복 카드를 최상단으로 (스펙 §3.3) — 회복 카드는 절대 잠기지 않는
  // 코어 불변식(isCardAvailable)을 플레이어가 실제로 알아채도록 만드는 정렬이다.
  const ordered = isShaken(s)
    ? [...slotted].sort((a, b) => Number(!!b.def.isRecovery) - Number(!!a.def.isRecovery))
    : slotted

  const budget = actionPoints(s)

  return (
    // Ruling 21 (Task 12) — 카드 버튼의 testid는 `slot-card-${id}` + `data-card-id`다
    // (CardTile이 그 계약을 그대로 유지한다). 컨테이너 testid(`card-list`)와 잠금
    // 사유 testid(`card-lock-${id}`)도 그대로 둔다.
    <div
      className="card-list"
      data-testid="card-list"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${CARD_GRID_COLUMNS}, 1fr)` }}
    >
      {ordered.map(({ def: c, slot }) => {
        const lock = cardLockReason(s, c)
        // togglePick(store.ts)이 실제로 거부하는 조건과 **정확히 같은 식**이어야 한다.
        // 여기서만 다른 계산을 쓰면(예: 이미 고른 카드들의 소모를 빼는 등) "타일은
        // 활성인데 눌러도 picked가 안 바뀌는" 죽은 클릭이 재발한다(컨트롤러 판정 5,
        // 이 저장소에서 이미 두 번 있었던 결함 계열).
        const apCost = cardApCost(c.id, gradeOfSlot(s, c.id))
        const apInsufficient = apCost > budget
        const uiLock: UiLockReason | null = lock ?? (apInsufficient ? 'ap' : null)
        const disabled = uiLock !== null
        const selected = picked.includes(c.id)
        return (
          <CardTile
            key={c.id}
            slot={slot}
            selected={selected}
            disabled={disabled}
            lockReason={uiLock ? UI_LOCK_REASON[uiLock] : null}
            onPick={onPick}
          />
        )
      })}
    </div>
  )
}

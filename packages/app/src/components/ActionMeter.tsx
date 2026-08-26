import { actionPoints } from '@bb/core'
import { apSpent, useGame } from '../store/store'
import { useCountUp } from '../design/motion'
import { TOUCH_TARGET_PX } from './TopBar'

/**
 * §3.1 홈 레이아웃의 행동력 행 — 남은 행동력을 점으로, 리롤 버튼을 옆에 둔다.
 *
 * 점 하나가 곧 행동력 1이 **아니다** — 총 점수는 `actionPoints(state)`(행동력 예산)
 * 이고, 이미 고른 카드들이 실제로 먹는 만큼(`apSpent`, 등급별 `cardApCost` 합)만
 * "꺼진(spent)" 점으로 그린다. 카드 하나가 여러 점을 끄는 게 정상이다(등급이 높을수록
 * 더 많이 꺼진다) — 카드 장수와 점 개수를 같다고 가정하면 안 된다.
 */
export function ActionMeter({ picked }: { picked: string[] }) {
  const s = useGame(st => st.state)
  const doReroll = useGame(st => st.doReroll)

  const total = s ? actionPoints(s) : 0
  // 방어적으로 클램프한다 — togglePick이 예산을 넘겨 고르지 못하게 막지만, 이 컴포넌트가
  // 그 가정에 기대지 않고 스스로도 안전하도록(점이 총 개수를 넘어 그려지는 걸 막는다).
  const spent = s ? Math.min(apSpent(s, picked), total) : 0
  const remaining = total - spent
  // 값이 바뀔 때 부드럽게 롤업한다(§6 "상태 전이" 층). reduced-motion이면 즉시 값으로 뛴다.
  const displayRemaining = useCountUp(remaining)

  if (!s) return null

  const rerollsLeft = s.rerollsLeft

  return (
    <div className="action-meter" data-testid="action-meter">
      <div className="ap-dots" aria-label={`남은 행동력 ${remaining}/${total}`}>
        <span className="ap-num">⚡{displayRemaining}/{total}</span>
        {Array.from({ length: total }, (_, i) => {
          const isSpent = i < spent
          return (
            <span
              key={i}
              data-testid={isSpent ? 'ap-dot-spent' : 'ap-dot'}
              className={`ap-dot${isSpent ? ' ap-dot-spent' : ''}`}
              aria-hidden="true"
            />
          )
        })}
      </div>
      <button
        type="button"
        className="reroll-btn"
        data-testid="reroll"
        disabled={rerollsLeft <= 0}
        style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
        onClick={() => doReroll()}
      >
        🔄 리롤 ({rerollsLeft})
      </button>
    </div>
  )
}

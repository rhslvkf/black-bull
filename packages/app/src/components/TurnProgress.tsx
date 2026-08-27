import { BALANCE } from '@bb/core'
import { useGame } from '../store/store'

/** §3 레이아웃 예산 — 진행바 한 줄 12px(리뷰 Fix Round 1 Ruling 22). 정의는 여기
 *  한 곳뿐이다. jsdom은 외부 CSS를 읽지 않으므로 TopBar/CharacterStage와 같은 방식으로
 *  인라인 스타일로 내려 getComputedStyle로 실측 가능하게 한다. */
export const TURN_PROGRESS_HEIGHT_PX = 12

/**
 * §3.1 홈 레이아웃의 진행바 — `TopBar` 바로 아래, 156턴 중 지금 턴의 진척을 막대로
 * 보여준다. Task 11(상단바 · 진행바 · 캐릭터 스테이지)의 브리프가 진행바를 빠뜨렸고,
 * Task 12가 `Hud`를 게이지만 남기고 정리하며 마지막 남은 구현체(`hud-bar`)까지 지워
 * 화면에서 완전히 사라졌다 — 리뷰 Fix Round 1 Ruling 22로 복원한다.
 *
 * 총 턴 수는 `BALANCE.totalTurns`에서 읽는다 — 156을 여기서 다시 적지 않는다(복제하면
 * 밸런스가 바뀔 때 이 막대만 낡은 총량을 기준으로 남는다).
 */
export function TurnProgress() {
  const s = useGame(st => st.state)
  if (!s) return null

  const pct = Math.min(100, Math.max(0, (s.turn / BALANCE.totalTurns) * 100))

  return (
    <div
      className="turn-progress"
      data-testid="turn-progress"
      style={{ height: `${TURN_PROGRESS_HEIGHT_PX}px` }}
    >
      <div className="turn-progress-fill" data-testid="turn-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

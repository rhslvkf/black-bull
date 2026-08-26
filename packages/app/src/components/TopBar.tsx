import { BALANCE, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { won, yearWeek } from '../format'
import { TOUCH_TARGET_PX } from '../design/layout'

// TOUCH_TARGET_PX는 design/layout.ts로 옮겼다(Fix Round 1 Minor 3) — ActionMeter·
// CardTile 등 다른 컴포넌트가 이 파일(TopBar.tsx)을 상수 창고로 끌어다 쓰던 구조를
// 없애고, 그 두 파일의 import도 함께 `../design/layout`으로 갱신했다. 이 파일 자신은
// 계속 그 값을 아래에서 쓴다.

/** §3 레이아웃 예산 — 상단바 한 줄 56px. 정의는 여기 한 곳뿐이다. jsdom은 외부 CSS를
 *  읽지 않으므로 CharacterStage의 260px와 같은 방식으로 인라인 스타일로 내려
 *  getComputedStyle로 실측 가능하게 한다(리뷰 Fix Round 1 Minor 1). */
export const TOPBAR_HEIGHT_PX = 56

/**
 * §3.1 홈 레이아웃의 상단바 — 메뉴 / 연차·주차·D-day / 총자산 / 정보.
 *
 * 티어·현금·게이지 등 나머지 HUD 요소는 이 컴포넌트의 몫이 아니다(Task 12가 `Hud`를
 * 게이지만 남기고 정리하면서 정리된다). 여기서는 스펙 다이어그램이 상단바 한 줄에
 * 못박은 네 조각만 그린다.
 */
export function TopBar() {
  const s = useGame(st => st.state)
  if (!s) return null

  const remaining = BALANCE.totalTurns - s.turn
  const assets = totalAssets(s)

  return (
    <header className="topbar" data-testid="topbar" style={{ height: `${TOPBAR_HEIGHT_PX}px` }}>
      <button
        type="button"
        className="topbar-icon-btn"
        data-testid="topbar-menu"
        aria-label="메뉴"
        style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
      >
        ☰
      </button>
      <div className="topbar-date" data-testid="topbar-date">
        <span className="topbar-yearweek">{yearWeek(s.turn)}</span>
        <span className="topbar-dday">D-{remaining}</span>
      </div>
      <div className="topbar-assets" data-testid="topbar-assets">{won(assets)}</div>
      <button
        type="button"
        className="topbar-icon-btn"
        data-testid="topbar-info"
        aria-label="정보"
        style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
      >
        ⓘ
      </button>
    </header>
  )
}

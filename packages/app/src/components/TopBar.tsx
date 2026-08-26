import { BALANCE, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { won, yearWeek } from '../format'

/** 전역 제약의 터치 타깃 최소값. jsdom은 외부 CSS를 읽지 않으므로(design/testUtils.ts
 *  주석·CharacterStage의 260px와 같은 이유) 인라인 스타일로 내려 실측 가능하게 한다.
 *  1차 개발에서 "패딩 포함 ≥40px"을 ≥44px로 잘못 보고했던 사고가 있었다 — 여기서는
 *  min-width/min-height를 직접 숫자로 박아 그 착시가 반복될 여지를 없앤다. */
export const TOUCH_TARGET_PX = 44

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
    <header className="topbar" data-testid="topbar">
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

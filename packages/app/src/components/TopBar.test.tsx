import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { BALANCE } from '@bb/core'
import { renderWithState } from '../testUtils'
import { won } from '../format'

// Ruling 18 — 브리프는 @testing-library/jest-dom의 toHaveTextContent/toHaveAttribute를
// 쓰지만 packages/app에는 그 의존성이 없다. 새 의존성을 추가하지 않고 순수 DOM으로
// 옮긴다: textContent 부분 문자열 포함, getAttribute 직접 비교로 검사 내용은 그대로 둔다.

describe('TopBar', () => {
  it('연차·주차와 남은 주를 보여준다', () => {
    renderWithState({ turn: 66 })
    const date = screen.getByTestId('topbar-date').textContent!
    expect(date).toContain('2년차 14주')
    expect(date).toContain('D-90') // 남은 주 = 156(totalTurns) - 66
  })

  it('총자산을 원 단위로 보여준다', () => {
    renderWithState({ player: { cash: 35_450_000 } })
    expect(screen.getByTestId('topbar-assets').textContent).toContain('35,450,000원')
  })

  // MU1 대비 — yearWeek()로 변환하지 않고 턴 원시값을 그대로 찍으면 여기서 실패해야 한다.
  it('원시 턴 번호(66)를 그대로 노출하지 않는다', () => {
    renderWithState({ turn: 66 })
    expect(screen.getByTestId('topbar-date').textContent).not.toContain('66주')
  })

  // MU2 대비 — D-day가 (156 - turn)이 아니라 turn 자체라면 D-66이 찍혀야 하는데,
  // 위 테스트가 D-90을 요구하므로 그 자체로 잡히지만, 여기서 한 번 더 대비를 명시한다.
  it('D-day는 총 턴(156) 대비 남은 주다', () => {
    renderWithState({ turn: 1 })
    expect(screen.getByTestId('topbar-date').textContent).toContain(`D-${BALANCE.totalTurns - 1}`)
  })

  // MU3 대비 — won()을 거치지 않고 숫자만 찍거나 '원'을 떼면 실패해야 한다.
  it('총자산 표기에 천 단위 구분자와 "원"이 붙는다', () => {
    renderWithState({ player: { cash: 12_345_678 } })
    expect(screen.getByTestId('topbar-assets').textContent).toBe(won(12_345_678))
  })

  // 리뷰 Fix Round 1 (Major) — 이전 버전은 TopBar.tsx가 export하는 TOUCH_TARGET_PX를
  // 그대로 import해 "그 상수가 그 상수와 같다"를 확인하는 자기참조 테스트였다. 구현이
  // 32px를 export하든 48px를 export하든 항상 통과해 아무것도 잠그지 못했다(1차 개발의
  // "패딩 포함 ≥40px인데 실측 33px"과 같은 종류의 사고).
  //
  // 44는 계획서 Global Constraints("터치 타깃 44px 이상")의 요구값이지 이 구현의
  // 상수가 아니다 — 그래서 여기서는 TopBar.tsx의 어떤 export도 가져오지 않고 리터럴
  // 44를 직접 적는다. ">="로 비교하는 이유도 같다: 제약은 "44px 이상"이므로, 나중에
  // 48px로 더 넉넉하게 키우는 정당한 변경까지 이 테스트가 막아서는 안 된다.
  it('메뉴·정보 버튼의 터치 타깃이 44px 이상이다 (Global Constraints)', () => {
    const MIN_TOUCH_TARGET_PX = 44 // 계획서 요구값. TopBar.tsx의 상수를 import하지 않는다.
    renderWithState({})
    for (const id of ['topbar-menu', 'topbar-info']) {
      const style = getComputedStyle(screen.getByTestId(id))
      expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    }
  })

  it('메뉴·정보 버튼은 스크린리더가 읽을 수 있는 이름을 가진다', () => {
    renderWithState({})
    expect(screen.getByTestId('topbar-menu').getAttribute('aria-label')).toBe('메뉴')
    expect(screen.getByTestId('topbar-info').getAttribute('aria-label')).toBe('정보')
  })

  // 리뷰 Fix Round 1 (Minor 1) — §3 레이아웃 예산: 상단바 56px. CharacterStage의
  // 260px와 같은 이유로 jsdom이 실측할 수 있게 인라인 스타일로 내린다. 값은
  // TopBar.tsx의 TOPBAR_HEIGHT_PX 상수 한 곳에서만 정의한다.
  it('상단바 높이가 56px로 고정된다 (§3 레이아웃 예산)', () => {
    renderWithState({})
    expect(getComputedStyle(screen.getByTestId('topbar')).height).toBe('56px')
  })
})

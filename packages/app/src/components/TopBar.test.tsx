import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { BALANCE } from '@bb/core'
import { renderWithState } from '../testUtils'
import { won } from '../format'
import { TOUCH_TARGET_PX } from './TopBar'

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

  // 추가 확인: 1차 개발에서 "패딩 포함 ≥40px"을 ≥44px로 잘못 보고한 사고가 있었다
  // (보고서 참고). getComputedStyle로 실제 min-width/min-height를 직접 잰다 —
  // jsdom은 외부 CSS를 안 읽으므로 TopBar가 인라인 스타일로 내린 값을 그대로 본다.
  it('메뉴·정보 버튼의 터치 타깃이 44px 이상이다', () => {
    renderWithState({})
    for (const id of ['topbar-menu', 'topbar-info']) {
      const style = getComputedStyle(screen.getByTestId(id))
      expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(TOUCH_TARGET_PX)
    }
  })

  it('메뉴·정보 버튼은 스크린리더가 읽을 수 있는 이름을 가진다', () => {
    renderWithState({})
    expect(screen.getByTestId('topbar-menu').getAttribute('aria-label')).toBe('메뉴')
    expect(screen.getByTestId('topbar-info').getAttribute('aria-label')).toBe('정보')
  })
})

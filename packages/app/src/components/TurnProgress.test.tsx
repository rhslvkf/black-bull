import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { BALANCE } from '@bb/core'
import { renderWithState } from '../testUtils'
import { TURN_PROGRESS_HEIGHT_PX } from './TurnProgress'

// Ruling 18 — jest-dom 없이 순수 DOM으로 본다.
// Ruling 20 — 12px는 TurnProgress.tsx의 상수 하나에서만 나온다. jsdom은 외부 CSS를
// 읽지 않으므로, 그 상수가 인라인 style로 실제 내려오는지를 getComputedStyle로 잰다.

describe('TurnProgress', () => {
  it('높이가 12px로 고정된다', () => {
    renderWithState({})
    expect(getComputedStyle(screen.getByTestId('turn-progress')).height).toBe('12px')
    expect(TURN_PROGRESS_HEIGHT_PX).toBe(12)
  })

  it('턴이 진행될수록 채워진 폭이 실제로 늘어난다 (BALANCE.totalTurns 기준, 하드코딩 채움 대비)', () => {
    const first = renderWithState({ turn: 1 })
    const widthAtTurn1 = parseFloat(getComputedStyle(screen.getByTestId('turn-progress-fill')).width)
    first.unmount() // 같은 테스트 안에서 두 번 렌더하므로, 다음 렌더 전에 직접 정리한다.

    renderWithState({ turn: 100 })
    const widthAtTurn100 = parseFloat(getComputedStyle(screen.getByTestId('turn-progress-fill')).width)

    // 제약값을 여기서 다시 계산하지 않는다 — BALANCE.totalTurns는 core의 실제 총
    // 턴 수이지, 이 컴포넌트가 export하는 상수를 자기참조하는 게 아니다(156을
    // 리터럴로 복제하면, 밸런스가 바뀔 때 테스트만 낡은 값을 기준으로 남는다).
    const expectedAt1 = (1 / BALANCE.totalTurns) * 100
    const expectedAt100 = (100 / BALANCE.totalTurns) * 100

    expect(widthAtTurn1).toBeCloseTo(expectedAt1, 5)
    expect(widthAtTurn100).toBeCloseTo(expectedAt100, 5)
    // 상수로 고정 채움(예: 항상 50%) 뮤테이션 대비 — 두 턴의 폭이 서로 달라야 한다.
    expect(widthAtTurn1).not.toBeCloseTo(widthAtTurn100, 2)
  })

  it('마지막 턴(BALANCE.totalTurns)에서는 100%를 넘지 않는다', () => {
    renderWithState({ turn: BALANCE.totalTurns })
    const width = parseFloat(getComputedStyle(screen.getByTestId('turn-progress-fill')).width)
    expect(width).toBeCloseTo(100, 5)
  })
})

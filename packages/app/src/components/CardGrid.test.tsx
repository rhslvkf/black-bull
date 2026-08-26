import { describe, it, expect } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import { BALANCE, actionPoints, cardApCost, gradeOfSlot, slotsWith } from '@bb/core'
import { renderWithState, currentState } from '../testUtils'
import { useGame } from '../store/store'

// Ruling 18 — jest-dom 없이 순수 DOM으로 본다.
// Ruling 2 — 등급은 매 턴 굴려지므로, 특정 카드가 특정 등급으로 뜬다고 가정하는 테스트는
// core의 slotsWith(cardId, grade)로 슬롯을 직접 박는다. 브리프의 마지막 두 테스트
// (행동력 부족·잠긴 카드)를 그대로 옮기면 시드 운에 기댄다 — 여기서는 슬롯을 명시
// 주입해 'analyze'가 실제로 그 턴에 뽑혔다고 보장한다.

describe('CardGrid — 행동력 부족·잠금 사유 (브리프 Step 1의 마지막 두 테스트, Ruling 2로 재작성)', () => {
  it('행동력이 모자라면 비활성이고 사유가 보인다', () => {
    // stamina 0, 재직 → actionPoints = 2(base). analyze를 A등급(⚡3)으로 직접 박아
    // "이번 턴 슬롯에 실제로 analyze가 A로 떴다"를 시드와 무관하게 보장한다.
    renderWithState({ slots: slotsWith('analyze', 'A'), player: { stats: { stamina: 0 } } })
    const budget = actionPoints(currentState())
    const cost = cardApCost('analyze', gradeOfSlot(currentState(), 'analyze'))
    expect(cost).toBeGreaterThan(budget) // 테스트 전제: 이 시나리오가 실제로 예산을 넘는지
    const card = screen.getByTestId('slot-card-analyze')
    expect(card.hasAttribute('disabled')).toBe(true)
    expect(card.textContent).toContain('행동력이 부족하다')
  })

  it('잠긴 카드는 사유가 보인다 (흔들림 시 이성 카드)', () => {
    renderWithState({ slots: slotsWith('analyze', 'C'), player: { mental: 12 } })
    expect(screen.getByTestId('slot-card-analyze').textContent).toContain('흔들려서')
  })
})

// 컨트롤러 판정 5 — 타일의 비활성 판정과 store.ts togglePick의 예산 판정이 어긋나면
// "눌리는데 아무 일도 안 일어나는" 버튼이 재발한다(이 저장소에서 이미 두 번 있었던
// 결함 계열). 두 계산을 나란히 다시 베끼는 대신, core 함수(ground truth)로 기대값을
// 구하고 실제 클릭 결과로 검증한다 — 어느 한쪽만 틀려도 잡힌다.
describe('카드 타일의 비활성 판정이 togglePick의 예산 판정과 일치한다 (컨트롤러 판정 5, MU10)', () => {
  it('카드 하나만으로 예산을 넘으면 비활성이고, 클릭해도 선택되지 않는다', () => {
    renderWithState({ slots: slotsWith('analyze', 'A'), player: { stats: { stamina: 0 } } })
    const budget = actionPoints(currentState())
    const cost = cardApCost('analyze', gradeOfSlot(currentState(), 'analyze'))
    expect(cost).toBeGreaterThan(budget)
    const tile = screen.getByTestId('slot-card-analyze')
    expect(tile.hasAttribute('disabled')).toBe(true)
    fireEvent.click(tile)
    expect(useGame.getState().picked).not.toContain('analyze')
  })

  it('예산 안에 드는 카드는 활성이고, 클릭하면 실제로 선택된다', () => {
    renderWithState({ slots: slotsWith('analyze', 'E') })
    const budget = actionPoints(currentState())
    const cost = cardApCost('analyze', gradeOfSlot(currentState(), 'analyze'))
    expect(cost).toBeLessThanOrEqual(budget)
    const tile = screen.getByTestId('slot-card-analyze')
    expect(tile.hasAttribute('disabled')).toBe(false)
    fireEvent.click(tile)
    expect(useGame.getState().picked).toContain('analyze')
  })
})

// 컨트롤러 판정·MU8 — jsdom은 실제 그리드 계산을 하지 않으므로(레이아웃 엔진이 없다),
// "2×2"라는 배치 자체를 잠그려면 인라인 스타일을 실측하는 수밖에 없다(Ruling 20과
// 같은 이유). 2는 스펙 §3.1이 못박은 값이라 CardGrid.tsx의 상수를 import하지 않고
// 리터럴로 비교한다.
describe('카드 2×2 배치 (스펙 §3.1, MU8)', () => {
  it('카드 목록 컨테이너는 2열 그리드다', () => {
    renderWithState({})
    const grid = screen.getByTestId('card-list')
    expect(getComputedStyle(grid).gridTemplateColumns).toBe('repeat(2, 1fr)')
  })

  it('행동 3 + 회복 1 = 4장이 그 2열 그리드 안에 있다 (2열 × 4장 = 2×2)', () => {
    renderWithState({})
    const count = within(screen.getByTestId('card-list')).getAllByTestId(/^slot-card-/).length
    expect(count).toBe(BALANCE.slots.action + BALANCE.slots.recovery)
  })
})

// 전역 제약 "회복 슬롯은 항상 열려 있고 회복 카드는 행동력을 소모하지 않는다"가
// 화면에서 실제로 구별되는지 통합 레벨에서 본다(CardTile.test.tsx는 낱장 단위로 이미
// 본다). MU9 — 이 표식을 지우거나 행동 카드에도 붙이면 잡혀야 한다.
describe('회복 슬롯 카드만 시각적으로 구별된다 (전역 제약, MU9)', () => {
  it('회복 슬롯 카드에는 recovery-marker가 있고, 행동 슬롯 카드 3장에는 없다', () => {
    renderWithState({})
    const s = currentState()
    const recoveryTile = screen.getByTestId(`slot-card-${s.slots.recovery.cardId}`)
    expect(within(recoveryTile).queryByTestId('recovery-marker')).not.toBeNull()
    for (const a of s.slots.action) {
      const actionTile = screen.getByTestId(`slot-card-${a.cardId}`)
      expect(within(actionTile).queryByTestId('recovery-marker')).toBeNull()
    }
  })
})

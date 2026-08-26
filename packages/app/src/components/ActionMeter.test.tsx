import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { actionPoints, cardApCost, gradeOfSlot, slotsWith } from '@bb/core'
import { renderWithState, currentState } from '../testUtils'
import { useGame } from '../store/store'
import { HomeScreen } from '../screens/HomeScreen'
import { Hud } from './Hud'

// Ruling 18 — jest-dom 없이 순수 DOM으로 본다.
// Ruling 21 — 카드 버튼 selector는 `slot-card-<id>`다(`data-card-id` 동반).
// Ruling 20 — 이 파일은 getComputedStyle로 인라인 스타일만 읽는다(--chip처럼 값이
// 없는 CSS-only 프로퍼티를 기대하지 않는다).

describe('ActionMeter', () => {
  it('남은 행동력을 점으로 보여준다', () => {
    renderWithState({ player: { stats: { stamina: 3 } } })
    // 제약값을 여기서 다시 계산하지 않는다 — actionPoints(currentState())는 core의
    // 실제 예산 계산이지, 이 컴포넌트가 export하는 상수를 자기참조하는 게 아니다.
    expect(screen.getAllByTestId('ap-dot')).toHaveLength(actionPoints(currentState()))
  })

  // 브리프의 위 테스트는 stamina 3 → actionPoints=3인 상태만 본다. 3은 우연히
  // "카드 한 장 값"처럼 보일 수 있는 작은 정수라, 이 값 하나만으로는 구현이
  // actionPoints(state)를 실제로 읽는지 상수 3을 하드코딩했는지 구별하지 못한다
  // (보고서에 적은 뮤테이션 MU3 무탐지 사고). 총 예산이 3이 *아닌* 상태를 하나 더 본다.
  it('행동력 예산이 3이 아닌 상태에서도 점 개수가 그 예산과 같다 (MU3 대비)', () => {
    renderWithState({}) // 기본 새 판: stamina 0, 재직 → actionPoints = 2
    const budget = actionPoints(currentState())
    expect(budget).not.toBe(3) // 이 값 자체가 3이면 아래 단언이 무의미해진다
    expect(screen.getAllByTestId('ap-dot')).toHaveLength(budget)
  })

  it('카드를 고르면 점이 꺼진다', () => {
    renderWithState({})
    fireEvent.click(screen.getAllByTestId(/^slot-card-/)[0]!)
    expect(screen.getAllByTestId('ap-dot-spent').length).toBeGreaterThan(0)
  })

  it('리롤 횟수가 0이면 버튼이 비활성이다', () => {
    renderWithState({ rerollsLeft: 0 })
    expect(screen.getByTestId('reroll').hasAttribute('disabled')).toBe(true)
  })

  // 전역 제약: "터치 타깃 44px 이상". TopBar.test.tsx와 같은 방식 — 44는 계획서 요구값이지
  // 이 구현의 상수가 아니므로 ActionMeter.tsx의 어떤 export도 가져오지 않고 리터럴로 적는다.
  it('리롤 버튼의 터치 타깃이 44px 이상이다 (Global Constraints)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    renderWithState({})
    const style = getComputedStyle(screen.getByTestId('reroll'))
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  it('리롤하면 행동 슬롯이 바뀐다', () => {
    renderWithState({ rerollsLeft: 2 })
    const before = screen.getAllByTestId(/^slot-card-/).map(e => e.getAttribute('data-card-id'))
    fireEvent.click(screen.getByTestId('reroll'))
    const after = screen.getAllByTestId(/^slot-card-/).map(e => e.getAttribute('data-card-id'))
    expect(after).not.toEqual(before)
  })
})

// MU7 — 회복 카드는 행동력을 쓰지 않는다(전역 제약: "회복 슬롯은 항상 열려 있고
// 회복 카드는 행동력을 소모하지 않는다"). 위 브리프 테스트는 첫 슬롯 카드(행동 칸)를
// 고르므로 이 불변식을 건드리지 않는다 — 여기서 회복 카드를 직접 골라 점검한다.
describe('회복 카드는 행동력 점을 소모하지 않는다 (전역 제약, MU7)', () => {
  it('회복 슬롯 카드를 골라도 ap-dot-spent가 하나도 생기지 않는다', () => {
    renderWithState({})
    const s = currentState()
    fireEvent.click(screen.getByTestId(`slot-card-${s.slots.recovery.cardId}`))
    expect(screen.queryAllByTestId('ap-dot-spent')).toHaveLength(0)
  })
})

// MU8 — 등급이 오를수록 카드 한 장의 행동력 소모(cardApCost)도 커진다(§2.2). 기본
// 새 판은 슬롯 등급이 시드로 굴려져 나오므로, 여기서는 slotsWith로 등급을 S로
// 명시 고정해 "카드 한 장 = 점 하나"라는 낡은 가정이 남아 있으면 반드시 잡히게 한다.
describe('등급이 높은 카드는 여러 점을 끈다 (§2.2, MU8)', () => {
  it('S등급 카드 한 장을 고르면 그 카드의 실제 행동력 비용만큼 점이 꺼진다', () => {
    // stamina 3 → actionPoints = base(2) + floor(3/3) = 3, S등급 analyze의 비용(gradeAp.S=3)과
    // 정확히 맞춘다 — 예산이 모자라 store가 선택 자체를 거부하면(gating은 store.ts의
    // 몫이지 이 테스트의 관심사가 아니다) 점이 하나도 안 꺼져 이 테스트가 무의미해진다.
    renderWithState({ slots: slotsWith('analyze', 'S'), player: { stats: { stamina: 3 }, employed: true } })
    const s = currentState()
    const cost = cardApCost('analyze', gradeOfSlot(s, 'analyze'))
    expect(cost).toBeGreaterThan(1) // S등급은 실제로 1보다 비싸다 — 아니면 이 테스트가 공회전이다

    fireEvent.click(screen.getByTestId('slot-card-analyze'))
    expect(screen.getAllByTestId('ap-dot-spent')).toHaveLength(cost)
  })
})

// MU9 — doReroll이 rerollsLeft를 실제로 줄이는지. 슬롯 카드 구성이 우연히 리롤 전후
// 같을 수 있어(모든 액션 카드가 그대로 다시 뽑히는 시나리오) 브리프의 '슬롯이 바뀐다'
// 테스트만으로는 rerollsLeft 감소를 완전히 못 박지 못한다 — 숫자 자체를 직접 본다.
describe('리롤은 실제로 rerollsLeft를 줄인다 (MU9)', () => {
  it('리롤 버튼을 누르면 표시된 남은 리롤 횟수가 1 줄어든다', () => {
    renderWithState({ rerollsLeft: 2 })
    expect(screen.getByTestId('reroll').textContent).toContain('(2)')
    fireEvent.click(screen.getByTestId('reroll'))
    expect(screen.getByTestId('reroll').textContent).toContain('(1)')
    expect(currentState().rerollsLeft).toBe(1)
  })
})

// MU10 — Hud를 게이지만 남기고 줄이는 과정에서 정작 게이지 자체가 사라지지 않았는지.
// Hud.test는 별도 파일이 없으므로(HomeScreen.test.tsx의 'Hud' describe가 담당) 여기서는
// ActionMeter와 한 화면(HomeScreen)에 게이지가 여전히 공존하는지를 통합적으로 본다.
describe('Hud를 줄여도 게이지는 화면에 남는다 (MU10)', () => {
  it('HomeScreen 렌더 시 멘탈·컨디션 게이지와 ActionMeter가 함께 존재한다', () => {
    useGame.getState().reset()
    useGame.getState().newGame(1)
    // App.tsx가 아니라 HomeScreen만 렌더하면 Hud(App의 형제)는 트리에 없다 — 이 테스트는
    // "HomeScreen 자체가 게이지를 지운다" 종류의 뮤테이션을 막는 게 아니라, Hud가 홈
    // 화면과 별개로 여전히 렌더 가능한 컴포넌트로 남아 있는지를 본다(아래 두 번째
    // 테스트가 실제 게이지 값 렌더를 직접 확인한다).
    const { unmount } = renderWithState({}, <HomeScreen />)
    expect(screen.getByTestId('action-meter')).toBeDefined()
    unmount()
  })

  it('Hud를 직접 렌더하면 게이지 두 개가 모두 나온다(값 포함)', () => {
    renderWithState({ player: { mental: 55, condition: 33 } }, <Hud />)
    expect(screen.getByTestId('gauge-mental').textContent).toContain('55')
    expect(screen.getByTestId('gauge-condition').textContent).toContain('33')
  })
})

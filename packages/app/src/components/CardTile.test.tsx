import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GRADES, gradeMul, loadCards, type CardGrade } from '@bb/core'
import { CardTile } from './CardTile'

// Ruling 18 — @testing-library/jest-dom을 추가하지 않는다. toHaveTextContent/toBeDisabled
// 대신 순수 DOM(el.textContent, el.hasAttribute('disabled'))으로 본다. 검사 내용은
// 브리프와 동일하다.
//
// Ruling 20 — jsdom은 외부 CSS를 읽지 않고 var()도 해석하지 않는다. 등급 배지 색은
// CardTile.tsx가 인라인 `backgroundColor: var(--grade-<등급>)`로 내리므로
// getComputedStyle이 그 문자열을 그대로 돌려주고, 6개 등급이 서로 다른 문자열이 된다.

const CARDS = loadCards()
const analyze = CARDS.find(c => c.id === 'analyze')!
const rest = CARDS.find(c => c.id === 'rest')!

describe('CardTile', () => {
  it('등급 배지를 보여준다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
    expect(screen.getByTestId('grade-badge').textContent).toContain('A')
  })

  it('등급마다 배지 색이 다르다', () => {
    const color = (g: CardGrade) => {
      const { container, unmount } = render(<CardTile slot={{ cardId: 'analyze', grade: g }} />)
      const c = getComputedStyle(container.querySelector('[data-testid=grade-badge]')!).backgroundColor
      unmount()
      return c
    }
    expect(new Set(GRADES.map(g => color(g))).size).toBe(GRADES.length)
  })

  it('효과가 등급 배율이 반영된 값으로 보인다', () => {
    // 기댓값은 CardTile.tsx를 다시 베끼지 않고 core의 실제 값(loadCards + gradeMul)에서
    // 직접 유도한다 — analyze의 기본 analysis 델타는 카드 데이터가 정하고, 배율은
    // core의 gradeMul('A')가 정한다. 둘 다 CardTile 내부 구현이 아니라 이 테스트가
    // 독립적으로 아는 값이므로, CardTile이 배율을 빼먹으면(MU3) 실패해야 한다.
    const base = analyze.effects.find(e => e.type === 'stat' && e.stat === 'analysis')
    if (base?.type !== 'stat') throw new Error('테스트 전제가 깨졌다: analyze에 analysis 스탯 효과가 없다')
    const expected = base.delta * gradeMul('A')
    expect(expected).toBeCloseTo(1.1, 5) // 브리프가 못박은 값(0.5 × 2.2)과 일치하는지도 함께 고정
    render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
    expect(screen.getByTestId('effect-summary').textContent).toContain(`+${expected.toFixed(1)}`)
  })

  it('회복 카드는 행동력 0으로 표시된다', () => {
    render(<CardTile slot={{ cardId: 'rest', grade: 'C' }} />)
    expect(screen.getByTestId('ap-cost').textContent).toBe('⚡0')
  })

  // MU4 대비 — 등급이 최고(S)라도 회복 카드는 여전히 0이어야 한다. 등급 C 하나만
  // 보면 "회복이라 0"인지 "우연히 이 등급이 0"인지 구별할 수 없다.
  it('회복 카드는 등급이 S여도 행동력 0이다 (MU4 대비)', () => {
    render(<CardTile slot={{ cardId: 'rest', grade: 'S' }} />)
    expect(screen.getByTestId('ap-cost').textContent).toBe('⚡0')
  })

  // 컨트롤러 판정 1·MU7 — 효과 요약이 보상(analysis +1.1)만 보여주고 컨디션 대가를
  // 숨기면 "등급이 오르면 보상과 함께 대가도 커진다"는 §2.2 규칙이 화면에서 사라진다.
  // 브리프의 원본 테스트에는 없던 항목 — 이 태스크가 직접 추가한다.
  describe('효과 요약이 대가를 숨기지 않는다 (컨트롤러 판정 1, MU7)', () => {
    it('analyze A등급의 컨디션 대가(-6 × 2.2 = -13.2)가 화면에 보인다', () => {
      const base = analyze.effects.find(e => e.type === 'condition')
      if (base?.type !== 'condition') throw new Error('테스트 전제가 깨졌다: analyze에 condition 효과가 없다')
      const expectedCondition = base.delta * gradeMul('A')
      expect(expectedCondition).toBeCloseTo(-13.2, 5)
      const { container } = render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
      const costNode = container.querySelector('[data-testid^="cost-condition-"]')
      expect(costNode).not.toBeNull()
      expect(costNode!.textContent).toContain(expectedCondition.toFixed(1))
    })

    it('대가는 effect-summary(보상 줄)가 아니라 별도 비용 표시에 있다', () => {
      const { container } = render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
      expect(screen.getByTestId('effect-summary').textContent).not.toContain('13.2')
      expect(container.querySelector('[data-testid^="cost-condition-"]')).not.toBeNull()
    })
  })

  // MU9 대비 — 회복 카드는 항상 열려 있고 행동력을 쓰지 않는다는 사실이 시각적으로
  // 구별돼야 한다(전역 제약). 행동 카드에는 이 표식이 없어야 대비가 실제로 성립한다.
  describe('회복 카드는 시각적으로 구별된다 (전역 제약, MU9)', () => {
    it('회복 카드에는 recovery-marker가 있다', () => {
      render(<CardTile slot={{ cardId: 'rest', grade: 'C' }} />)
      expect(screen.queryByTestId('recovery-marker')).not.toBeNull()
    })
    it('행동 카드에는 recovery-marker가 없다', () => {
      render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} />)
      expect(screen.queryByTestId('recovery-marker')).toBeNull()
    })
  })

  it('선택된 카드는 picked 클래스를 받는다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} selected />)
    expect(screen.getByTestId('slot-card-analyze').className).toContain('picked')
  })

  it('disabled와 lockReason이 있으면 카드가 잠기고 사유가 보인다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} disabled lockReason="흔들려서 손에 안 잡힌다" />)
    const card = screen.getByTestId('slot-card-analyze')
    expect(card.hasAttribute('disabled')).toBe(true)
    expect(card.textContent).toContain('흔들려서')
  })

  it('disabled가 아니면 사유가 보이지 않는다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} />)
    expect(screen.queryByTestId('card-lock-analyze')).toBeNull()
  })

  // 전역 제약: "터치 타깃 44px 이상". TopBar.test.tsx·ActionMeter.test.tsx와 같은 방식 —
  // 44는 계획서 요구값이지 이 구현의 상수가 아니므로 CardTile.tsx의 어떤 export도
  // 가져오지 않고 리터럴로 적는다(MU11 대비).
  it('카드 타일의 터치 타깃이 44px 이상이다 (Global Constraints, MU11)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} />)
    const style = getComputedStyle(screen.getByTestId('slot-card-analyze'))
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  it('알 수 없는 카드 id면 아무것도 그리지 않는다', () => {
    const { container } = render(<CardTile slot={{ cardId: 'no-such-card', grade: 'C' }} />)
    expect(container.textContent).toBe('')
  })

  it('rest 카드 자체가 존재한다 (테스트 전제 확인)', () => {
    expect(rest.isRecovery).toBe(true)
  })
})

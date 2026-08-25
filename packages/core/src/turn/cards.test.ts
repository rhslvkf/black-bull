import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { loadCards, isCardAvailable, playCard } from './cards'
import { GameError } from '../error'

const cards = loadCards()
const byId = (id: string) => cards.find(c => c.id === id)!

describe('cards 데이터', () => {
  it('12장이고 id가 유일하다', () => {
    expect(cards).toHaveLength(12)
    expect(new Set(cards.map(c => c.id)).size).toBe(12)
  })
  it('회복 카드가 3장 있고 전부 lockedWhenShaken이 아니다', () => {
    const rec = cards.filter(c => c.isRecovery)
    expect(rec).toHaveLength(3)
    rec.forEach(c => expect(c.lockedWhenShaken).toBeFalsy())
  })
  it('이성 카드 4장이 흔들림에 잠긴다', () => {
    expect(cards.filter(c => c.lockedWhenShaken)).toHaveLength(4)
  })
  it('각 육성 스탯을 올리는 카드가 최소 1장씩 있다', () => {
    for (const st of ['grit', 'stamina', 'info', 'analysis', 'network'] as const) {
      expect(cards.some(c => c.effects.some(e => e.type === 'stat' && e.stat === st && e.delta > 0))).toBe(true)
    }
  })
})

describe('isCardAvailable', () => {
  it('정상 멘탈에서는 이성 카드가 열린다', () => {
    expect(isCardAvailable(makeState(), byId('analyze'))).toBe(true)
  })
  it('흔들림에서 이성 카드가 잠긴다', () => {
    const s = makeState(); s.player.mental = 10
    expect(isCardAvailable(s, byId('analyze'))).toBe(false)
  })
  it('흔들림에서도 회복 카드는 열린다 (스펙 §3.3 불변 규칙)', () => {
    const s = makeState(); s.player.mental = 0
    cards.filter(c => c.isRecovery).forEach(c => expect(isCardAvailable(s, c)).toBe(true))
  })
  it('현금이 부족하면 비용 있는 카드가 잠긴다', () => {
    const s = makeState(); s.player.cash = 0
    const paid = cards.find(c => (c.cost?.money ?? 0) > 0)!
    expect(isCardAvailable(s, paid)).toBe(false)
  })
})

describe('playCard', () => {
  it('효과가 적용된다', () => {
    expect(playCard(makeState(), 'analyze').player.stats.analysis).toBeGreaterThan(0)
  })
  it('비용이 차감된다', () => {
    const paid = cards.find(c => (c.cost?.money ?? 0) > 0)!
    const s = playCard(makeState(), paid.id)
    expect(s.player.cash).toBeLessThan(makeState().player.cash)
  })
  it('야근은 돈을 벌고 컨디션을 깎는다', () => {
    const s = playCard(makeState(), 'overtime')
    expect(s.player.cash).toBeGreaterThan(makeState().player.cash)
    expect(s.flags['__conditionPending']).toBeLessThan(0)
  })
  it('잠긴 카드는 CARD_LOCKED', () => {
    const s = makeState(); s.player.mental = 5
    expect(() => playCard(s, 'analyze')).toThrow(GameError)
  })
  it('없는 카드는 NO_CARD', () => {
    expect(() => playCard(makeState(), 'nope')).toThrow(/NO_CARD/)
  })
})

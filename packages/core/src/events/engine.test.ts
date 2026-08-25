// packages/core/src/events/engine.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { resolveImpacts, revealRumors, drawEvents, resolveChoice, rumorLead } from './engine'
import type { EventDef } from '../types'
import { BALANCE } from '../balance'

const ev = (over: Partial<EventDef> & { id: string }): EventDef => ({
  category: 'news', weight: 1, text: { title: over.id, body: '본문' }, ...over,
})

describe('resolveImpacts', () => {
  it('만기 도달분만 반환하고 목록에서 제거한다', () => {
    const s = makeState({ turn: 5, pendingImpacts: [
      { target: 'stock:s1', magnitude: 0.1, dueTurn: 5, revealTurn: 3, revealed: true, title: 'a' },
      { target: 'market', magnitude: -0.05, dueTurn: 7, revealTurn: 5, revealed: false, title: 'b' },
    ] })
    const [map, next] = resolveImpacts(s)
    expect(map.get('stock:s1')).toBeCloseTo(0.1, 6)
    expect(map.has('market')).toBe(false)
    expect(next.pendingImpacts).toHaveLength(1)
  })
  it('같은 타깃 충격은 합산된다', () => {
    const s = makeState({ turn: 2, pendingImpacts: [
      { target: 'market', magnitude: 0.1, dueTurn: 2, revealTurn: 1, revealed: true, title: 'a' },
      { target: 'market', magnitude: 0.2, dueTurn: 2, revealTurn: 1, revealed: true, title: 'b' },
    ] })
    expect(resolveImpacts(s)[0].get('market')).toBeCloseTo(0.3, 6)
  })
})

describe('revealRumors', () => {
  const pending = (turn: number) => makeState({ turn, pendingImpacts: [
    { target: 'stock:s1', magnitude: 0.2, dueTurn: turn + 2, revealTurn: turn, revealed: false, title: '수주 임박' },
  ] })
  it('정보력 0이면 루머가 안 보인다', () => {
    expect(rumorLead(0)).toBe(0)
    expect(revealRumors(pending(5)).news.filter(n => n.kind === 'rumor')).toHaveLength(0)
  })
  it('정보력이 높으면 루머가 보인다', () => {
    const s = pending(5); s.player.stats.info = 10
    expect(revealRumors(s).news.some(n => n.kind === 'rumor')).toBe(true)
  })
  it('같은 루머를 두 번 노출하지 않는다', () => {
    let s = pending(5); s.player.stats.info = 10
    s = revealRumors(s)
    const n1 = s.news.length
    s = revealRumors(s)
    expect(s.news.length).toBe(n1)
  })
})

describe('drawEvents', () => {
  it('조건 불만족 이벤트는 안 뽑힌다', () => {
    const pool = [ev({ id: 'locked', conditions: [{ type: 'tierMin', value: 5 }] })]
    expect(drawEvents(makeState(), pool).news.some(n => n.title === 'locked')).toBe(false)
  })
  it('턴당 최대 개수를 넘지 않는다', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ev({ id: `e${i}` }))
    const s = drawEvents(makeState(), pool)
    expect(s.news.filter(n => n.turn === 1).length).toBeLessThanOrEqual(BALANCE.maxEventsPerTurn)
  })
  it('oneShot은 재발화하지 않는다', () => {
    const pool = [ev({ id: 'once', oneShot: true })]
    let s = drawEvents(makeState(), pool)
    expect(s.firedOneShots).toContain('once')
    const before = s.news.length
    s = drawEvents({ ...s, turn: 2 }, pool)
    expect(s.news.length).toBe(before)
  })
  it('effects가 즉시 적용된다', () => {
    const pool = [ev({ id: 'e', effects: [{ type: 'stat', stat: 'info', delta: 1 }] })]
    expect(drawEvents(makeState(), pool).player.stats.info).toBe(1)
  })
  it('impact는 예약된다', () => {
    const pool = [ev({ id: 'e', impact: { target: 'sector:바이오', magnitude: 0.3, delay: 2 } })]
    const s = drawEvents(makeState({ turn: 4 }), pool)
    expect(s.pendingImpacts[0]).toMatchObject({ target: 'sector:바이오', dueTurn: 6 })
  })
  it('선택지 있는 이벤트는 pendingChoices로 간다', () => {
    const pool = [ev({ id: 'pick', choices: [{ label: 'A', effects: [] }] })]
    const s = drawEvents(makeState(), pool)
    expect(s.pendingChoices).toEqual([{ eventId: 'pick' }])
  })
})

describe('resolveChoice', () => {
  const pool = [ev({ id: 'pick', choices: [
    { label: '넣는다', effects: [{ type: 'cash', delta: -500000 }, { type: 'flag', key: 'kim', value: 'inc' }] },
    { label: '거절', effects: [] },
  ] })]
  it('선택 효과가 적용되고 대기열에서 빠진다', () => {
    const s = resolveChoice(makeState({ pendingChoices: [{ eventId: 'pick' }] }), 'pick', 0, pool)
    expect(s.player.cash).toBe(2_500_000)
    expect(s.flags['kim']).toBe(1)
    expect(s.pendingChoices).toHaveLength(0)
  })
  it('잘못된 인덱스는 BAD_CHOICE', () => {
    expect(() => resolveChoice(makeState({ pendingChoices: [{ eventId: 'pick' }] }), 'pick', 9, pool)).toThrow(/BAD_CHOICE/)
  })
})

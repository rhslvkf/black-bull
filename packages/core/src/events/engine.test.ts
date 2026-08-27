// packages/core/src/events/engine.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { resolveImpacts, revealRumors, drawEvents, resolveChoice, rumorLead, rumorChance } from './engine'
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

describe('rumorLead / rumorChance', () => {
  // 표 기반 고정값 — 구현을 호출해서 기대값을 만들지 않고, 의도한 구간을 직접 적어둔다.
  const table: Array<[info: number, lead: number, chance: number]> = [
    [0, 0, 0],
    [1, 0, 0],
    [2, 0, 0],
    [3, 1, 0.5],
    [4, 1, 0.5],
    [5, 1, 0.5],
    [6, 2, 0.7],
    [7, 2, 0.7],
    [8, 2, 0.7],
    [9, 3, 0.9],
    [10, 3, 0.9],
  ]
  it.each(table)('info=%i -> lead=%i, chance=%f', (info, lead, chance) => {
    expect(rumorLead(info)).toBe(lead)
    expect(rumorChance(info)).toBeCloseTo(chance, 6)
  })

  // 위 표는 '의도'의 기록이고, 아래는 '구현이 BALANCE를 실제로 읽는가'의 확인이다
  // (최종 리뷰 M3 — 구간값이 engine.ts에 리터럴로 박혀 있었다). 둘 다 있어야
  // "BALANCE를 튜닝했는데 엔진에 옛 리터럴이 남은" 상태가 잡힌다.
  it('구간표가 BALANCE.infoTiers와 정확히 일치한다', () => {
    for (const tier of BALANCE.infoTiers) {
      expect(rumorLead(tier.minInfo), `info ${tier.minInfo}`).toBe(tier.lead)
      expect(rumorChance(tier.minInfo), `info ${tier.minInfo}`).toBeCloseTo(tier.chance, 6)
    }
    const lowest = Math.min(...BALANCE.infoTiers.map(t => t.minInfo))
    expect(rumorLead(lowest - 1)).toBe(0)
    expect(rumorChance(lowest - 1)).toBe(0)
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
  it("루머 제목은 원제목 앞에 '[루머] ' 접두사를 붙인 것과 정확히 같다", () => {
    // 플레이어에게 보이는 한국어 문구인데 지금까지 어떤 테스트도 이 문자열을 고정하지
    // 않았다 — 접두사를 지우거나 다른 말로 바꿔도 전부 그린이었다(Task 14 리뷰 이월).
    // app은 접두사가 아니라 `kind === 'rumor'`로 루머를 판별하므로(NewsTicker의 isRumor)
    // 이 문구가 조용히 바뀌어도 화면은 멀쩡히 동작하고, 그래서 더더욱 여기서 잠가야 한다.
    //
    // `toContain('[루머]')`로 쓰지 않는 이유: 부분 문자열 검사는 접두사만 남기고 원제목을
    // 통째로 날려도('[루머] ' 하나만 있어도) 통과한다 — 이 저장소가 이미 두 번 밟은
    // 함정이다. 완성된 제목 전체를 통짜로 비교한다.
    const s = pending(5); s.player.stats.info = 10
    const rumors = revealRumors(s).news.filter(n => n.kind === 'rumor')
    expect(rumors).toHaveLength(1)
    expect(rumors[0]!.title).toBe('[루머] 수주 임박')
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
  it('풀이 충분히 크면 턴당 정확히 최대 개수만큼 뽑는다', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ev({ id: `e${i}` }))
    const s = drawEvents(makeState(), pool)
    expect(s.news.filter(n => n.turn === 1).length).toBe(BALANCE.maxEventsPerTurn)
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
  it('잘못된 인덱스는 던지지 않고 효과 없이 대기열만 비운다', () => {
    const before = makeState({ pendingChoices: [{ eventId: 'pick' }] })
    const s = resolveChoice(before, 'pick', 9, pool)
    expect(s.player.cash).toBe(before.player.cash)
    expect(s.flags).toEqual(before.flags)
    expect(s.pendingChoices).toHaveLength(0)
  })
  it('대기열에 없는 이벤트는 무동작이다', () => {
    const before = makeState({ pendingChoices: [] })
    const s = resolveChoice(before, 'pick', 0, pool)
    expect(s).toEqual(before)
  })
  it('같은 선택을 두 번 호출해도 효과는 한 번만 적용된다', () => {
    let s = resolveChoice(makeState({ pendingChoices: [{ eventId: 'pick' }] }), 'pick', 0, pool)
    expect(s.player.cash).toBe(2_500_000)
    expect(s.flags['kim']).toBe(1)
    s = resolveChoice(s, 'pick', 0, pool)
    expect(s.player.cash).toBe(2_500_000)
    expect(s.flags['kim']).toBe(1)
    expect(s.pendingChoices).toHaveLength(0)
  })
  // Ruling 50 — 종료된 게임에는 무동작(던지지 않는다). advanceTurn 9단계가 정상적으로
  // pendingChoices를 비우므로 실제 경로에서는 도달하지 않지만, UI가 낙오된 선택지에
  // 실수로 호출해도 굳어진 ending과 모순되는 state 변화가 반영되지 않아야 한다.
  it('종료된 상태에서는 무동작이다 (status 가드, Ruling 50)', () => {
    const before = makeState({ status: 'ended', pendingChoices: [{ eventId: 'pick' }] })
    const s = resolveChoice(before, 'pick', 0, pool)
    expect(s).toEqual(before)
  })
})

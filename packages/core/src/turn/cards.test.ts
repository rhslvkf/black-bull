import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { loadCards, isCardAvailable, playCard } from './cards'
import { GameError } from '../error'
import type { ActionCardDef, Effect, Condition, StatKey } from '../types'

const cards = loadCards()
const byId = (id: string) => cards.find(c => c.id === id)!

// raw as ActionCardDef[]는 JSON import 타입이 리터럴을 넓혀버리기 때문에 아무것도 검증하지 않는다.
// 아래 목록은 satisfies로 오탈자를 컴파일 타임에 잡고, cards.json 데이터는 런타임 테스트로 직접 검증한다.
const EFFECT_TYPES = [
  'stat', 'mental', 'condition', 'cash', 'flag', 'impact',
  'buyStockPct', 'averageDown', 'retire', 'rivalMul', 'fundamentalMul',
] as const satisfies readonly Effect['type'][]

const CONDITION_TYPES = [
  'tierMin', 'tierMax', 'turnMin', 'turnMax', 'regime', 'statMin',
  'assetsMin', 'assetsMax', 'employed', 'mentalMax',
  'flagEq', 'flagMin', 'flagAbsent', 'holdsStock',
] as const satisfies readonly Condition['type'][]

const STAT_KEYS = ['grit', 'stamina', 'info', 'analysis', 'network'] as const satisfies readonly StatKey[]

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
  it('isRecovery는 lockedWhenShaken보다 항상 먼저 검사된다 (합성 카드로 체크 순서 자체를 고정)', () => {
    // cards.json에는 isRecovery && lockedWhenShaken을 동시에 만족하는 카드가 없어서
    // 실제 데이터만으로는 isCardAvailable 내부 검사 순서가 안 바뀌어도 테스트가 통과해버린다.
    // 그래서 그 조합을 직접 만들어 순서 자체를 고정한다 — isRecovery 검사가 lockedWhenShaken보다
    // 먼저라면 true, 뒤바뀌면(흔들림 잠금이 먼저 걸리면) false가 나와야 실패한다.
    const s = makeState(); s.player.mental = 0
    const synthetic: ActionCardDef = {
      id: '__synthetic_recovery_locked__', name: '합성 카드', desc: '체크 순서 고정용',
      effects: [], isRecovery: true, lockedWhenShaken: true,
    }
    expect(isCardAvailable(s, synthetic)).toBe(true)
  })
})

describe('cards.json 데이터 유효성 (raw as ActionCardDef[] 캐스팅은 아무것도 검증하지 않으므로 직접 검증한다)', () => {
  it('id가 유일하고 비어있지 않으며 name/desc가 비어있지 않다', () => {
    const seen = new Set<string>()
    const bad: string[] = []
    for (const c of cards) {
      if (c.id.length === 0) bad.push('(빈 id)')
      if (seen.has(c.id)) bad.push(`중복 id: ${c.id}`)
      seen.add(c.id)
      if (c.name.length === 0) bad.push(`${c.id}: 빈 name`)
      if (c.desc.length === 0) bad.push(`${c.id}: 빈 desc`)
    }
    expect(bad).toEqual([])
  })

  it('모든 effects[].type이 알려진 Effect 타입이다', () => {
    const bad: string[] = []
    for (const c of cards) {
      for (const e of c.effects) {
        if (!EFFECT_TYPES.includes(e.type)) bad.push(`${c.id}: 알 수 없는 effect.type "${e.type}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('모든 stat 필드가 알려진 StatKey다', () => {
    const bad: string[] = []
    for (const c of cards) {
      for (const e of c.effects) {
        if (e.type === 'stat' && !STAT_KEYS.includes(e.stat)) bad.push(`${c.id}: 알 수 없는 stat "${e.stat}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('모든 requires[].type이 알려진 Condition 타입이다', () => {
    const bad: string[] = []
    for (const c of cards) {
      for (const r of c.requires ?? []) {
        if (!CONDITION_TYPES.includes(r.type)) bad.push(`${c.id}: 알 수 없는 requires.type "${r.type}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('모든 숫자 필드가 유한하다', () => {
    const bad: string[] = []
    const walk = (value: unknown, path: string): void => {
      if (typeof value === 'number') {
        if (!Number.isFinite(value)) bad.push(`${path} = ${value}`)
      } else if (Array.isArray(value)) {
        value.forEach((v, i) => walk(v, `${path}[${i}]`))
      } else if (value !== null && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
      }
    }
    cards.forEach(c => walk(c, c.id))
    expect(bad).toEqual([])
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

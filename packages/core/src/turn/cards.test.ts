import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { loadCards, isCardAvailable, cardLockReason, playCard } from './cards'
import { GameError } from '../error'
import { BALANCE } from '../balance'
import { gradeMul, GRADES } from './grade'
import type { ActionCardDef, Effect, Condition, StatKey, CardGrade } from '../types'

const cards = loadCards()
const byId = (id: string) => cards.find(c => c.id === id)!

// raw as ActionCardDef[]는 JSON import 타입이 리터럴을 넓혀버리기 때문에 아무것도 검증하지 않는다.
// 아래 목록은 satisfies로 오탈자를 컴파일 타임에 잡고, cards.json 데이터는 런타임 테스트로 직접 검증한다.
const EFFECT_TYPES = [
  'stat', 'mental', 'condition', 'cash', 'flag', 'impact',
  'buyStockPct', 'retire', 'rivalMul', 'fundamentalMul',
] as const satisfies readonly Effect['type'][]

const CONDITION_TYPES = [
  'tierMin', 'tierMax', 'turnMin', 'turnMax', 'regime', 'statMin',
  'assetsMin', 'assetsMax', 'employed', 'mentalMax',
  'flagEq', 'flagMin', 'flagAbsent', 'holdsStock',
] as const satisfies readonly Condition['type'][]

const STAT_KEYS = ['grit', 'stamina', 'info', 'analysis', 'network'] as const satisfies readonly StatKey[]

describe('cards 데이터', () => {
  it('11장이고 id가 유일하다', () => {
    expect(cards).toHaveLength(11)
    expect(new Set(cards.map(c => c.id)).size).toBe(11)
  })
  it('회복 카드가 4장 있고 전부 lockedWhenShaken이 아니다', () => {
    const rec = cards.filter(c => c.isRecovery)
    expect(rec).toHaveLength(4)
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
    expect(playCard(makeState(), 'analyze', 'C').player.stats.analysis).toBeGreaterThan(0)
  })
  it('비용이 차감된다', () => {
    const paid = cards.find(c => (c.cost?.money ?? 0) > 0)!
    const s = playCard(makeState(), paid.id, 'C')
    expect(s.player.cash).toBeLessThan(makeState().player.cash)
  })
  it('야근은 돈을 벌고 컨디션을 깎는다', () => {
    const s = playCard(makeState(), 'overtime', 'C')
    expect(s.player.cash).toBeGreaterThan(makeState().player.cash)
    expect(s.flags['__conditionPending']).toBeLessThan(0)
  })
  it('잠긴 카드는 CARD_LOCKED', () => {
    const s = makeState(); s.player.mental = 5
    expect(() => playCard(s, 'analyze', 'C')).toThrow(GameError)
  })
  it('없는 카드는 NO_CARD', () => {
    expect(() => playCard(makeState(), 'nope', 'C')).toThrow(/NO_CARD/)
  })
})

/**
 * Ruling 13 — 등급 배율은 효과뿐 아니라 **비용**에도 곱해진다. 브리프의 playCard
 * 스니펫에는 cost 처리가 통째로 빠져 있었다(그대로 옮겼으면 비용이 사라지는 회귀).
 * cards.json에서 cost를 가진 카드는 '주식 스터디'(cost.money 30,000)뿐이라,
 * cost.condition 경로는 데이터가 없어 여기서 관측할 수단이 없다(보고서 참고).
 */
describe('playCard — 등급이 비용에도 곱해진다 (Ruling 13)', () => {
  const paid = loadCards().find(c => (c.cost?.money ?? 0) > 0)!
  const rich = () => makeState({ player: { cash: 10_000_000 } })

  it('돈 비용에 등급 배율이 곱해진다', () => {
    const spent = (g: CardGrade) => rich().player.cash - playCard(rich(), paid.id, g).player.cash
    expect(spent('C')).toBe(paid.cost!.money)
    expect(spent('A')).toBe(Math.round(paid.cost!.money! * gradeMul('A')))
    expect(spent('A')).toBeGreaterThan(spent('C'))
  })

  // cards.json에 cost를 가진 카드가 늘어나면(특히 cost.condition) 이 테스트가 자동으로
  // 그 카드까지 검사한다 — 데이터가 자라도 커버리지가 따라 자라게 만든 장치다.
  it('cost를 가진 카드는 등급이 오르면 비용도 함께 커진다 (데이터 전수)', () => {
    const withCost = loadCards().filter(c => (c.cost?.money ?? 0) > 0 || (c.cost?.condition ?? 0) > 0)
    expect(withCost.length).toBeGreaterThan(0)
    for (const c of withCost) {
      const lo = playCard(rich(), c.id, 'C')
      const hi = playCard(rich(), c.id, 'A')
      if (c.cost?.money) expect(hi.player.cash, `${c.name} 돈 비용`).toBeLessThan(lo.player.cash)
      if (c.cost?.condition) {
        expect(Number(hi.flags['__conditionPending']), `${c.name} 컨디션 비용`)
          .toBeLessThan(Number(lo.flags['__conditionPending']))
      }
    }
  })

  it('배율을 곱한 뒤에도 현금은 정수 KRW다', () => {
    for (const g of GRADES) {
      const after = playCard(rich(), paid.id, g)
      expect(Number.isInteger(after.player.cash), `등급 ${g}`).toBe(true)
    }
  })
})

/**
 * 스펙 §3.3 불변식 — 회복 카드(isRecovery)는 어떤 상태에서도 잠기지 않는다.
 * 사용자가 설계 피드백에서 직접 요구한 조항이다("행동 카드가 잠기면 실제로 멘탈 수치를
 * 다시 복구할 길이 없어지는 거 아니야?"). 최종 리뷰 Minor A에서 `최존버와 소주`가
 * 현금 4만원 미만일 때 잠기는 것이 발견됐다 — 문언이 지켜지지 않고 있었다.
 */
describe('회복 카드는 어떤 상태에서도 잠기지 않는다 (스펙 §3.3 불변식)', () => {
  const RECOVERY = ['rest', 'exercise', 'drink', 'hodl']

  it('회복 카드는 정확히 4종이고 이름이 스펙과 같다', () => {
    const rec = loadCards().filter(c => c.isRecovery)
    expect(rec.map(c => c.id).sort()).toEqual([...RECOVERY].sort())
    expect(rec.map(c => c.name).sort()).toEqual(['운동', '존버', '최존버와 소주', '휴식'].sort())
  })

  it('현금 0 · 컨디션 0 · 멘탈 0 · 티어 0의 최악 상태에서도 3종 모두 통과한다', () => {
    const base = makeState()
    const s = {
      ...base,
      player: { ...base.player, cash: 0, condition: 0, mental: 0, tier: 0 as const, holdings: [] },
    }
    for (const id of RECOVERY) {
      const card = loadCards().find(c => c.id === id)!
      expect(isCardAvailable(s, card), `${card.name}이(가) 잠겼다`).toBe(true)
    }
  })

  it('현금 구간 전체(0원 ~ 카드 비용 언저리)에서 회복 카드가 한 번도 잠기지 않는다', () => {
    const base = makeState()
    for (const cash of [0, 1, 999, 39_999, 40_000, 1_000_000]) {
      const s = { ...base, player: { ...base.player, cash, mental: 5 } }
      for (const id of RECOVERY) {
        const card = loadCards().find(c => c.id === id)!
        expect(isCardAvailable(s, card), `${card.name} @ ${cash}원`).toBe(true)
      }
    }
  })

  it('현금 0에서도 회복 카드를 실제로 낼 수 있고 멘탈이 오른다 (판정만 통과하는 게 아니다)', () => {
    const base = makeState()
    const s = { ...base, player: { ...base.player, cash: 0, mental: 5 } }
    const after = playCard(s, 'drink', 'C')
    expect(after.player.cash).toBe(0)                       // 클램프가 음수를 막는다
    expect(Number(after.flags['__mentalPending'])).toBeGreaterThan(0)
  })
})

// 최종 리뷰 Minor 12 — 화면이 잠긴 이유를 말할 수 있으려면 core가 이유를 알려줘야 한다.
describe('cardLockReason', () => {
  it('티어가 모자라면 tier다', () => {
    expect(cardLockReason(makeState(), byId('report'))).toBe('tier')
  })
  it('퇴사자에게 야근은 requires다 (티어와 구분된다)', () => {
    const s = makeState(); s.player.employed = false
    expect(cardLockReason(s, byId('overtime'))).toBe('requires')
  })
  it('돈이 모자라면 money다', () => {
    const s = makeState(); s.player.cash = 100
    expect(cardLockReason(s, byId('study'))).toBe('money')
  })
  it('흔들림이면 shaken이다', () => {
    const s = makeState(); s.player.mental = BALANCE.mental.shakenMax
    expect(cardLockReason(s, byId('analyze'))).toBe('shaken')
  })
  it('회복 카드는 최악의 상태에서도 null이다', () => {
    const base = makeState()
    const s = { ...base, player: { ...base.player, cash: 0, mental: 0, condition: 0 } }
    expect(cardLockReason(s, byId('drink'))).toBeNull()
  })
  it('isCardAvailable은 cardLockReason과 항상 일치한다 (두 판정이 갈라지지 않는다)', () => {
    const base = makeState()
    for (const cash of [0, 35_000, 1_000_000]) {
      for (const mental of [10, 80]) {
        for (const tier of [0, 2] as const) {
          const s = { ...base, player: { ...base.player, cash, mental, tier } }
          for (const c of loadCards()) {
            expect(isCardAvailable(s, c), `${c.name}`).toBe(cardLockReason(s, c) === null)
          }
        }
      }
    }
  })
})

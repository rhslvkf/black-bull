import { describe, it, expect } from 'vitest'
import { drawSlots, rerollSlots, rerollCount, gradeOfSlot } from './slots'
import { loadCards } from './cards'
import { rollGrade } from './grade'
import { BALANCE } from '../balance'
import { createRng } from '../rng/rng'
import { makeState, slotsWith } from '../testkit'
import { GameError } from '../error'
import { initGame } from './advance'

describe('drawSlots', () => {
  it('행동 3칸 · 회복 1칸을 만든다', () => {
    const [slots] = drawSlots(makeState({}))
    expect(slots.action).toHaveLength(BALANCE.slots.action)
    expect(slots.recovery).toBeDefined()
  })
  it('행동 슬롯에 회복 카드가 섞이지 않는다', () => {
    // isRecovery는 회복 카드에만 `true`로 박혀 있고 행동 카드에는 필드 자체가 없다
    // (undefined) — cards.json 실제 스키마. toBe(false)로 쓰면 항상 실패하므로 falsy로 본다.
    const [slots] = drawSlots(makeState({}))
    for (const s of slots.action) expect(loadCards().find(c => c.id === s.cardId)!.isRecovery).toBeFalsy()
  })
  it('회복 슬롯은 반드시 회복 카드다', () => {
    const [slots] = drawSlots(makeState({}))
    expect(loadCards().find(c => c.id === slots.recovery.cardId)!.isRecovery).toBe(true)
  })
  it('행동 슬롯에 같은 카드가 중복되지 않는다', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const [slots] = drawSlots(makeState({ rng: createRng(seed) }))
      expect(new Set(slots.action.map(s => s.cardId)).size).toBe(slots.action.length)
    }
  })
  it('같은 시드는 같은 슬롯을 만든다 (결정론)', () => {
    const a = drawSlots(makeState({ rng: createRng(9) }))[0]
    const b = drawSlots(makeState({ rng: createRng(9) }))[0]
    expect(a).toEqual(b)
  })
  it('다른 시드는 다른 슬롯을 만든다', () => {
    const a = drawSlots(makeState({ rng: createRng(1) }))[0]
    const b = drawSlots(makeState({ rng: createRng(2) }))[0]
    expect(a).not.toEqual(b)
  })
  // 위 단일 쌍(시드 1 vs 2) 비교는 우연히 같은 슬롯이 뽑혀 통과하지 못할 결정론적
  // 위험은 없지만(그런 우연은 사실상 없다), 그 반대 방향 — 우연히 "항상 다르다"는
  // 착시를 단일 쌍만으로 주장하는 게 아님을 여러 시드 쌍으로 넓게 고정해둔다.
  // 이 테스트 자체는 시드가 전부 리터럴로 고정돼 있어 실행마다 결과가 같다(플레이키 아님).
  it('여러 시드 쌍에서 슬롯이 대부분 달라진다 (단일 쌍 우연 배제)', () => {
    let differed = 0
    const total = 30
    for (let seed = 1; seed <= total; seed++) {
      const a = drawSlots(makeState({ rng: createRng(seed) }))[0]
      const b = drawSlots(makeState({ rng: createRng(seed + 1000) }))[0]
      if (JSON.stringify(a) !== JSON.stringify(b)) differed++
    }
    expect(differed).toBe(total)
  })
  it('슬롯 등급이 대응 스탯을 실제로 반영한다 (스탯 0 vs 만렙)', () => {
    const countHigh = (network: number, analysis: number, info: number, grit: number, stamina: number) => {
      let high = 0
      const trials = 300
      for (let seed = 1; seed <= trials; seed++) {
        const [slots] = drawSlots(makeState({
          rng: createRng(seed),
          player: { stats: { network, analysis, info, grit, stamina } },
        }))
        for (const s of slots.action) if (s.grade === 'A' || s.grade === 'S') high++
      }
      return high
    }
    const lowStat = countHigh(0, 0, 0, 0, 0)
    const highStat = countHigh(9, 9, 9, 9, 9)
    expect(highStat).toBeGreaterThan(lowStat * 3)
  })
})

describe('리롤', () => {
  it('인맥 0에서도 기본 횟수가 있다', () => {
    expect(rerollCount(makeState({ player: { stats: { network: 0 } } }))).toBe(BALANCE.reroll.base)
  })
  it('인맥이 오르면 횟수가 늘어난다', () => {
    const lo = rerollCount(makeState({ player: { stats: { network: 0 } } }))
    const hi = rerollCount(makeState({ player: { stats: { network: 9 } } }))
    expect(hi).toBeGreaterThan(lo)
  })
  it('인맥이 아무리 높아도 상한을 넘지 않는다', () => {
    expect(rerollCount(makeState({ player: { stats: { network: 10 } } }))).toBeLessThanOrEqual(BALANCE.reroll.max)
    expect(rerollCount(makeState({ player: { stats: { network: 999 } } }))).toBe(BALANCE.reroll.max)
  })
  it('행동 슬롯만 바뀌고 회복 슬롯은 그대로다', () => {
    const s = { ...makeState({ rng: createRng(3) }), rerollsLeft: 2 }
    const after = rerollSlots(s)
    expect(after.slots.recovery).toEqual(s.slots.recovery)
    expect(after.slots.action).not.toEqual(s.slots.action)
  })
  it('남은 횟수가 1 줄어든다', () => {
    const s = { ...makeState({}), rerollsLeft: 2 }
    expect(rerollSlots(s).rerollsLeft).toBe(1)
  })
  it('남은 횟수가 0이면 아무 일도 일어나지 않는다', () => {
    const s = { ...makeState({}), rerollsLeft: 0 }
    expect(rerollSlots(s)).toEqual(s)
  })
})

describe('gradeOfSlot', () => {
  it('행동 슬롯에서 등급을 찾는다', () => {
    const s = { ...makeState({}), slots: slotsWith('analyze', 'A') }
    expect(gradeOfSlot(s, 'analyze')).toBe('A')
  })
  it('회복 슬롯에서 등급을 찾는다', () => {
    const s = { ...makeState({}), slots: { action: [{ cardId: 'overtime', grade: 'C' as const }], recovery: { cardId: 'exercise', grade: 'S' as const } } }
    expect(gradeOfSlot(s, 'exercise')).toBe('S')
  })
  it('슬롯에 없는 카드면 GameError(NOT_IN_SLOTS)를 던진다', () => {
    const s = { ...makeState({}), slots: slotsWith('analyze', 'A') }
    expect(() => gradeOfSlot(s, 'nope')).toThrow(GameError)
    try {
      gradeOfSlot(s, 'nope')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(GameError)
      expect((e as GameError).code).toBe('NOT_IN_SLOTS')
    }
  })
})

describe('initGame과 슬롯의 결정론', () => {
  it('같은 시드로 initGame을 두 번 호출하면 슬롯까지 완전히 같다', () => {
    const a = initGame(123)
    const b = initGame(123)
    expect(a.slots).toEqual(b.slots)
    expect(a.rerollsLeft).toBe(b.rerollsLeft)
    expect(a.rng).toEqual(b.rng)
  })
  it('initGame이 뽑은 슬롯도 행동 3 · 회복 1 규칙을 지킨다', () => {
    const s = initGame(1)
    expect(s.slots.action).toHaveLength(BALANCE.slots.action)
    expect(loadCards().find(c => c.id === s.slots.recovery.cardId)!.isRecovery).toBe(true)
  })
  it('rollGrade를 직접 참조해도 초기 스탯(전부 0)에서는 등급 분포가 낮은 쪽에 치우친다', () => {
    // grade.ts의 계약을 재확인하는 회귀 고정 — slots.ts가 cardStat 매핑을 잘못 넘기면
    // (예: 항상 0을 넘기면) 이 테스트로는 못 잡지만, 최소한 rollGrade 자체가 여전히
    // 낮은 스탯에서 상위 등급을 드물게 준다는 전제를 살아있게 유지한다.
    let rng = createRng(1)
    let high = 0
    for (let i = 0; i < 500; i++) {
      const [g, next] = rollGrade(rng, 0)
      rng = next
      if (g === 'A' || g === 'S') high++
    }
    expect(high / 500).toBeLessThan(0.1)
  })
})

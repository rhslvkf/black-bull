import { describe, it, expect } from 'vitest'
import { drawSlots, rerollSlots, rerollCount, gradeOfSlot } from './slots'
import { loadCards } from './cards'
import { rollGrade } from './grade'
import { BALANCE } from '../balance'
import { createRng } from '../rng/rng'
import { makeState, slotsWith } from '../testkit'
import { GameError } from '../error'
import { initGame } from './advance'
import { generateRegimes } from '../market/regimes'

describe('카드 데이터: isRecovery 명시성 (Ruling 7)', () => {
  // 위 "행동 슬롯에 회복 카드가 섞이지 않는다"는 한 번의 drawSlots가 뽑은 3장만
  // 본다 — 뽑히지 않은 나머지 행동 카드가 isRecovery를 빠뜨려도 못 잡는다.
  // 여기서는 loadCards() 전수를 직접 검사해 7장 모두를 고정한다.
  it('행동 카드 7장 전부가 isRecovery: false를 명시한다', () => {
    const recoveryIds = new Set(['hodl', 'rest', 'exercise', 'drink'])
    const actionCards = loadCards().filter(c => !recoveryIds.has(c.id))
    expect(actionCards).toHaveLength(7)
    for (const c of actionCards) expect(c.isRecovery).toBe(false)
  })
  it('회복 카드 4장 전부가 isRecovery: true다', () => {
    for (const id of ['hodl', 'rest', 'exercise', 'drink']) {
      expect(loadCards().find(c => c.id === id)!.isRecovery).toBe(true)
    }
  })
})

describe('drawSlots', () => {
  it('행동 3칸 · 회복 1칸을 만든다', () => {
    const [slots] = drawSlots(makeState({}))
    expect(slots.action).toHaveLength(BALANCE.slots.action)
    expect(slots.recovery).toBeDefined()
  })
  it('행동 슬롯에 회복 카드가 섞이지 않는다', () => {
    // cards.json의 행동 카드 7장은 isRecovery: false를 명시한다(Ruling 7) — 새 카드를
    // 추가하며 이 필드를 빠뜨리면(undefined) 이 엄격한 toBe(false)가 잡는다.
    const [slots] = drawSlots(makeState({}))
    for (const s of slots.action) expect(loadCards().find(c => c.id === s.cardId)!.isRecovery).toBe(false)
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
  // Fix Round 1 Major 1 — draw()가 카드는 뽑되 rng를 진행시키지 않아도(=인자로 받은
  // rng를 그대로 반환해도) 기존 스위트가 전부 그린이었다. 재현성 테스트만으로는
  // "굴렸다"와 "안 굴렸는데 우연히 같다"를 구분하지 못한다 — rng가 실제로
  // 전진했는지를 직접 단언해야 한다.
  it('반환된 rng가 넘긴 rng와 다르다 (실제로 소비된다)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = makeState({ rng: createRng(seed) })
      const [, nextRng] = drawSlots(s)
      expect(nextRng).not.toEqual(s.rng)
    }
  })
  it('반환된 rng를 이어받아 다시 뽑으면 다른 슬롯이 나온다 (rng가 실제로 전진했다는 증거)', () => {
    let differed = 0
    const total = 20
    for (let seed = 1; seed <= total; seed++) {
      const s = makeState({ rng: createRng(seed) })
      const [a, r1] = drawSlots(s)
      const [b] = drawSlots({ ...s, rng: r1 })
      if (JSON.stringify(a) !== JSON.stringify(b)) differed++
    }
    expect(differed).toBe(total)
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

describe('slotsWith', () => {
  it('넘긴 cardId와 grade가 행동 슬롯에 그대로 들어간다', () => {
    const s = slotsWith('report', 'S')
    expect(s.action).toEqual([{ cardId: 'report', grade: 'S' }])
  })
  it('grade 인자가 실제로 반영된다 (등급별로 결과가 달라진다)', () => {
    expect(slotsWith('overtime', 'E').action[0]!.grade).toBe('E')
    expect(slotsWith('overtime', 'S').action[0]!.grade).toBe('S')
  })
  it('회복 슬롯이 항상 채워져 있고 회복 카드다', () => {
    const s = slotsWith('overtime', 'C')
    expect(s.recovery).toBeDefined()
    expect(loadCards().find(c => c.id === s.recovery.cardId)!.isRecovery).toBe(true)
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
  // Fix Round 1 Major 2 — initGame이 drawSlots가 돌려준 새 rng를 버리고
  // generateRegimes 직후의 rng를 그대로 최종 상태에 남겨도 위 "두 번 부르면 같다"
  // 테스트는 통과한다(rng를 아예 안 쓰는 구현도 재현성은 만족하므로). 슬롯 뽑기가
  // rng를 실제로 추가 소비했다는 것 자체를 국면 생성 직후의 rng와 직접 비교해 고정한다.
  it('슬롯을 뽑은 뒤의 rng가 국면 생성 직후의 rng와 다르다 (슬롯 뽑기가 rng를 소비했다)', () => {
    const [, rngAfterRegimes] = generateRegimes(createRng(7))
    const state = initGame(7)
    expect(state.rng).not.toEqual(rngAfterRegimes)
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

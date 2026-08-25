import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { settleCondition, rollForcedSkip } from './condition'
import { BALANCE } from '../balance'

describe('condition', () => {
  it('재직자는 매 턴 소모된다', () => {
    expect(settleCondition(makeState(), 0).player.condition).toBe(80 + BALANCE.condition.drainEmployed)
  })
  it('퇴사자는 덜 소모된다', () => {
    const s = makeState(); s.player.employed = false
    expect(settleCondition(s, 0).player.condition).toBe(80 + BALANCE.condition.drainUnemployed)
  })
  it('체력이 높으면 덜 소모된다', () => {
    const s = makeState(); s.player.stats = { ...s.player.stats, stamina: 10 }
    expect(settleCondition(s, 0).player.condition).toBeGreaterThan(settleCondition(makeState(), 0).player.condition)
  })
  it('카드 회복은 저항 없이 그대로 더해진다', () => {
    const s = makeState(); s.player.condition = 50
    expect(settleCondition(s, 30).player.condition).toBe(50 + 30 + BALANCE.condition.drainEmployed)
  })
  it('100을 넘지 않는다', () => {
    const s = makeState(); s.player.condition = 95
    expect(settleCondition(s, 40).player.condition).toBe(100)
  })
  it('0에 닿으면 번아웃 진입', () => {
    const s = makeState(); s.player.condition = 2
    const r = settleCondition(s, 0)
    expect(r.player.burnoutTurns).toBe(BALANCE.condition.burnoutTurns)
    expect(r.player.condition).toBe(BALANCE.condition.burnoutRecover)
    expect(r.player.mental).toBe(80 + BALANCE.condition.burnoutMental)
  })
  it('번아웃 중에는 항상 스킵되고 카운터가 준다', () => {
    const s = makeState(); s.player.burnoutTurns = 2
    const [skip, next] = rollForcedSkip(s)
    expect(skip).toBe(true)
    expect(next.player.burnoutTurns).toBe(1)
  })
  it('컨디션이 높으면 스킵되지 않는다', () => {
    const s = makeState(); s.player.condition = 90
    expect(rollForcedSkip(s)[0]).toBe(false)
  })
  it('컨디션이 매우 낮으면 정확한 횟수로 스킵된다', () => {
    // 고정 시드에서 200번 반복하면 정확히 92번 스킵됨
    // 이 값은 forcedSkipChance나 RNG 소비 방식 변경 시 달라짐
    let s = makeState(); s.player.condition = 5
    let skips = 0
    for (let i = 0; i < 200; i++) { const [sk, n] = rollForcedSkip(s); if (sk) skips++; s = { ...n, player: { ...n.player, condition: 5 } } }
    expect(skips).toBe(92)
    // 정확한 값이 임의적이지 않음을 보이기 위한 건전성 검사
    expect(skips).toBeGreaterThan(40)
    expect(skips).toBeLessThan(150)
  })
  it('체력 저항이 소모에만 적용되고 회복에는 아니다', () => {
    // stamina=10일 때: 저항 = max(0.2, 1 - 10*0.06) = 0.4
    // 소모 = -4 * 0.4 = -1.6 ≈ -2
    // 결과 = 80 - 2 = 78
    const s = makeState(); s.player.stats = { ...s.player.stats, stamina: 10 }
    expect(settleCondition(s, 0).player.condition).toBe(78)
    // stamina=1일 때: 저항 = 1 - 0.06 = 0.94
    // 소모 = -4 * 0.94 = -3.76 ≈ -4
    // 결과 = 80 - 4 = 76
    expect(settleCondition(makeState(), 0).player.condition).toBe(76)
  })
  it('야근 스킵 시 정확히 -5 페널티가 적용된다', () => {
    // condition=5에서 여러 번 굴려서 스킵이 나올 때까지
    let s = makeState(); s.player.condition = 5
    let skipped = false
    let iterations = 0
    while (!skipped && iterations < 500) {
      const [sk, n] = rollForcedSkip(s)
      if (sk) {
        expect(n.player.condition).toBe(5 + BALANCE.condition.forcedSkipPenalty)
        skipped = true
      }
      s = n
      iterations++
    }
    expect(skipped).toBe(true)
  })
  it('야근 스킵 미발생 시 컨디션 변화 없다', () => {
    // condition=90에서는 스킵 확률 판정 자체가 일어나지 않음
    const s = makeState(); s.player.condition = 90
    const [skip, next] = rollForcedSkip(s)
    expect(skip).toBe(false)
    expect(next.player.condition).toBe(90)
    // RNG도 소비되지 않음
    expect(next.rng.s).toBe(s.rng.s)
  })
  it('컨디션이 정확히 강제스킵 경계에 닿으면 스킵 판정이 없다', () => {
    // forcedSkipBelow = 20, condition >= 20 일 때 판정 안 함
    const s = makeState(); s.player.condition = 20
    const [skip, next] = rollForcedSkip(s)
    expect(skip).toBe(false)
    expect(next.player.condition).toBe(20)
    expect(next.rng.s).toBe(s.rng.s)
  })
  it('컨디션이 경계 아래 한 칸이면 스킵 판정이 있다', () => {
    // condition = 19 < 20 이므로 판정 발생, 40% 확률로 스킵
    let s = makeState(); s.player.condition = 19
    const beforeRng = s.rng.s
    let got_roll = false
    for (let i = 0; i < 10; i++) {
      const [skip, next] = rollForcedSkip(s)
      if (next.rng.s !== beforeRng) {
        // RNG가 소비되었으므로 확률 판정이 일어남
        got_roll = true
        break
      }
      s = next
    }
    expect(got_roll).toBe(true)
  })
})

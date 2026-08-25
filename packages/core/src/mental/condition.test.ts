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
  it('컨디션이 낮으면 가끔 스킵된다', () => {
    let s = makeState(); s.player.condition = 5
    let skips = 0
    for (let i = 0; i < 200; i++) { const [sk, n] = rollForcedSkip(s); if (sk) skips++; s = { ...n, player: { ...n.player, condition: 5 } } }
    expect(skips).toBeGreaterThan(30)
    expect(skips).toBeLessThan(170)
  })
})

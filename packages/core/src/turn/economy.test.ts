import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { settlePayroll, tierOf, settleTier, stepRival } from './economy'
import { BALANCE } from '../balance'

describe('settlePayroll', () => {
  it('payPeriod 배수 턴에만 정산한다', () => {
    expect(settlePayroll(makeState({ turn: 3 })).player.cash).toBe(BALANCE.seedMoney)
    expect(settlePayroll(makeState({ turn: 4 })).player.cash).toBe(BALANCE.seedMoney + BALANCE.employedNet)
  })
  it('퇴사자는 생활비가 빠진다', () => {
    const s = makeState({ turn: 4 }); s.player.employed = false
    expect(settlePayroll(s).player.cash).toBe(BALANCE.seedMoney - BALANCE.unemployedOut)
  })
  it('현금이 부족해도 음수가 되지 않는다', () => {
    const s = makeState({ turn: 4 }); s.player.employed = false; s.player.cash = 100
    expect(settlePayroll(s).player.cash).toBe(0)
  })
})

describe('tierOf', () => {
  it('경계값이 맞다', () => {
    expect(tierOf(0)).toBe(0)
    expect(tierOf(9_999_999)).toBe(0)
    expect(tierOf(10_000_000)).toBe(1)
    expect(tierOf(500_000_000)).toBe(4)
    expect(tierOf(3_000_000_000)).toBe(5)
    expect(tierOf(-1)).toBe(0)
  })
})

describe('settleTier', () => {
  it('승급 시 컷신 플래그가 선다', () => {
    const s = makeState(); s.player.cash = 12_000_000
    const r = settleTier(s)
    expect(r.player.tier).toBe(1)
    expect(r.cutscene).toBe('cutscene.promote.1')
  })
  it('히스테리시스: 기준의 90% 이상이면 강등되지 않는다', () => {
    const s = makeState(); s.player.tier = 1; s.player.cash = 9_500_000
    expect(settleTier(s).player.tier).toBe(1)
  })
  it('90% 미만이면 강등되고 컷신이 뜬다', () => {
    const s = makeState(); s.player.tier = 1; s.player.cash = 8_000_000
    const r = settleTier(s)
    expect(r.player.tier).toBe(0)
    expect(r.cutscene).toBe('cutscene.demote.0')
  })
  it('변동이 없으면 컷신도 없다', () => {
    expect(settleTier(makeState()).cutscene).toBeNull()
  })
})

describe('stepRival', () => {
  it('boom에서는 늘어난다', () => {
    const s = makeState({ turn: 1 }); s.regimes[0] = 'boom'
    expect(stepRival(s).rivalAssets).toBeGreaterThan(s.rivalAssets)
  })
  it('crash에서는 크게 줄어든다', () => {
    const s = makeState({ turn: 1 }); s.regimes[0] = 'crash'
    expect(stepRival(s).rivalAssets).toBeLessThan(s.rivalAssets * 0.95)
  })
  it('음수가 되지 않는다', () => {
    let s = makeState({ turn: 1 }); s.regimes[0] = 'crash'; s.rivalAssets = 1000
    for (let i = 0; i < 200; i++) s = stepRival(s)
    expect(s.rivalAssets).toBeGreaterThanOrEqual(0)
  })
})

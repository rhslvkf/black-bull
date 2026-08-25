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
  it('crash에서는 driftMul로 크게 줄어든다', () => {
    const s = makeState({ turn: 1 }); s.regimes[0] = 'crash'
    // 상한을 'driftMul 적용'과 '미적용'의 정확히 중간(지수 평균)에 둔다.
    //   적용   exp(drift * driftMul)
    //   미적용 exp(drift)          ← driftMul을 빠뜨린 구현
    // 리터럴 0.939를 박으면 drift 값을 튜닝하는 순간 무의미해진다(Task 24에서 실제로 깨졌다).
    const { drift } = BALANCE.regime.crash
    const bound = Math.exp(drift * (BALANCE.rival.driftMul + 1) / 2)
    expect(stepRival(s).rivalAssets).toBeLessThan(s.rivalAssets * bound)
    // 아래 단언이 없으면 driftMul을 터무니없이 키운 구현도 통과한다
    expect(stepRival(s).rivalAssets).toBeGreaterThan(s.rivalAssets * Math.exp(drift * BALANCE.rival.driftMul) * 0.999)
  })
  it('regimes를 거쳐도 정수로 유지된다', () => {
    let s = makeState({ turn: 1 })
    for (let i = 0; i < 30; i++) {
      s = { ...s, turn: s.turn + 1 }
      s = stepRival(s)
      expect(Number.isInteger(s.rivalAssets)).toBe(true)
      expect(s.rivalAssets).toBeGreaterThanOrEqual(0)
    }
  })
})

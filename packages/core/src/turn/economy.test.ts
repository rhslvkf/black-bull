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

// 최종 리뷰 C1: 무매매 기준선(accounting.noTradeBaseline)의 유일한 근거가 이 누계다.
// 여기가 갱신되지 않으면 HUD 수익률이 다시 '시드머니 대비'로 되돌아간다.
describe('settlePayroll이 netPayroll에 누적한다 (무매매 기준선의 근거)', () => {
  it('재직 정산은 employedNet만큼 누적한다', () => {
    const r = settlePayroll(makeState({ turn: 4 }))
    expect(r.trackers.netPayroll).toBe(BALANCE.employedNet)
  })
  it('정산이 없는 턴에는 누적하지 않는다', () => {
    expect(settlePayroll(makeState({ turn: 3 })).trackers.netPayroll).toBe(0)
  })
  it('퇴사 정산은 음수로 누적한다', () => {
    const s = makeState({ turn: 4 }); s.player.employed = false
    expect(settlePayroll(s).trackers.netPayroll).toBe(-BALANCE.unemployedOut)
  })
  it('현금 부족으로 덜 빠졌으면 실제로 빠진 만큼만 누적한다', () => {
    const s = makeState({ turn: 4 }); s.player.employed = false; s.player.cash = 100
    const r = settlePayroll(s)
    expect(r.player.cash).toBe(0)
    expect(r.trackers.netPayroll).toBe(-100)
  })
  it('여러 번 정산하면 계속 쌓인다', () => {
    let s = makeState({ turn: 4 })
    s = settlePayroll(s)
    s = settlePayroll({ ...s, turn: 8 })
    expect(s.trackers.netPayroll).toBe(BALANCE.employedNet * 2)
  })
})

// 최종 리뷰 Minor 6 — Ruling 49(폴백 금지)가 stepRival에는 적용되지 않고 남아 있었다.
describe('stepRival도 국면 인덱스 폴백을 두지 않는다 (Ruling 49)', () => {
  it('regimes 범위를 벗어난 turn이면 조용히 stagnation으로 넘어가지 않고 BAD_TURN을 던진다', () => {
    const s = makeState({ turn: BALANCE.totalTurns + 44 })
    expect(() => stepRival(s)).toThrow(/BAD_TURN/)
  })
})

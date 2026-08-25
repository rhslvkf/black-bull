import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { evalCondition, evalAll } from './conditions'
import { applyEffects } from './effects'

describe('evalCondition', () => {
  it('tierMin / tierMax', () => {
    const s = makeState(); s.player.tier = 2
    expect(evalCondition(s, { type: 'tierMin', value: 2 })).toBe(true)
    expect(evalCondition(s, { type: 'tierMin', value: 3 })).toBe(false)
    expect(evalCondition(s, { type: 'tierMax', value: 2 })).toBe(true)
  })
  it('turnMin / turnMax', () => {
    const s = makeState({ turn: 60 })
    expect(evalCondition(s, { type: 'turnMin', value: 60 })).toBe(true)
    expect(evalCondition(s, { type: 'turnMax', value: 59 })).toBe(false)
  })
  it('regime는 현재 턴 국면을 본다', () => {
    const s = makeState({ turn: 3 }); s.regimes[2] = 'crash'
    expect(evalCondition(s, { type: 'regime', value: 'crash' })).toBe(true)
    expect(evalCondition(s, { type: 'regime', value: 'boom' })).toBe(false)
  })
  it('statMin', () => {
    const s = makeState(); s.player.stats.info = 5
    expect(evalCondition(s, { type: 'statMin', stat: 'info', value: 5 })).toBe(true)
    expect(evalCondition(s, { type: 'statMin', stat: 'analysis', value: 1 })).toBe(false)
  })
  it('assetsMin / assetsMax / employed / mentalMax', () => {
    const s = makeState()
    expect(evalCondition(s, { type: 'assetsMin', value: 3_000_000 })).toBe(true)
    expect(evalCondition(s, { type: 'assetsMax', value: 1 })).toBe(false)
    expect(evalCondition(s, { type: 'employed', value: true })).toBe(true)
    expect(evalCondition(s, { type: 'mentalMax', value: 79 })).toBe(false)
  })
  it('flagEq / flagMin / flagAbsent', () => {
    const s = makeState(); s.flags = { k: 3, done: true }
    expect(evalCondition(s, { type: 'flagEq', key: 'done', value: true })).toBe(true)
    expect(evalCondition(s, { type: 'flagMin', key: 'k', value: 3 })).toBe(true)
    expect(evalCondition(s, { type: 'flagMin', key: 'zz', value: 1 })).toBe(false)
    expect(evalCondition(s, { type: 'flagAbsent', key: 'zz' })).toBe(true)
    expect(evalCondition(s, { type: 'flagAbsent', key: 'k' })).toBe(false)
  })
  it('holdsStock', () => {
    const s = makeState(); s.player.holdings = [{ stockId: 's1', qty: 1, avgCost: 1, heldTurns: 0 }]
    expect(evalCondition(s, { type: 'holdsStock', stockId: 's1' })).toBe(true)
    expect(evalCondition(s, { type: 'holdsStock', stockId: 's2' })).toBe(false)
  })
  it('evalAll: 빈 배열/undefined는 true', () => {
    expect(evalAll(makeState(), [])).toBe(true)
    expect(evalAll(makeState(), undefined)).toBe(true)
  })
})

describe('applyEffects', () => {
  it('stat은 0~10으로 클램프된다', () => {
    const up = applyEffects(makeState(), [{ type: 'stat', stat: 'info', delta: 99 }])
    expect(up.player.stats.info).toBe(10)
    const down = applyEffects(makeState(), [{ type: 'stat', stat: 'info', delta: -99 }])
    expect(down.player.stats.info).toBe(0)
  })
  it('cash는 즉시 반영된다', () => {
    expect(applyEffects(makeState(), [{ type: 'cash', delta: -1000 }]).player.cash).toBe(2_999_000)
  })
  it('mental/condition은 pending에 누적된다', () => {
    const s = applyEffects(makeState(), [{ type: 'mental', delta: 20 }, { type: 'condition', delta: 30 }])
    expect(s.player.mental).toBe(80)
    expect(s.flags['__mentalPending']).toBe(20)
    expect(s.flags['__conditionPending']).toBe(30)
  })
  it('flag inc는 1씩 증가시킨다', () => {
    let s = applyEffects(makeState(), [{ type: 'flag', key: 'n', value: 'inc' }])
    s = applyEffects(s, [{ type: 'flag', key: 'n', value: 'inc' }])
    expect(s.flags['n']).toBe(2)
  })
  it('impact는 pendingImpacts에 예약된다', () => {
    const s = applyEffects(makeState({ turn: 5 }), [
      { type: 'impact', target: 'stock:s1', magnitude: 0.1, delay: 2, title: '호재' },
    ])
    expect(s.pendingImpacts[0]).toMatchObject({ target: 'stock:s1', dueTurn: 7, revealed: false })
  })
  it('retire는 고용 상태를 끈다', () => {
    expect(applyEffects(makeState(), [{ type: 'retire' }]).player.employed).toBe(false)
  })
  it('rivalMul은 라이벌 자산을 곱한다', () => {
    const s = applyEffects(makeState(), [{ type: 'rivalMul', value: 2 }])
    expect(s.rivalAssets).toBe(makeState().rivalAssets * 2)
  })
  it('fundamentalMul은 내재가치를 바꾼다', () => {
    const s = applyEffects(makeState(), [{ type: 'fundamentalMul', stockId: 's1', value: 1.5 }])
    expect(s.stocks[0]!.fundamental).toBe(15000)
  })
  it('averageDown은 손실 종목을 현금 20%로 추가매수한다', () => {
    const base = makeState()
    base.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 20000, heldTurns: 0 }]
    const s = applyEffects(base, [{ type: 'averageDown' }])
    expect(s.player.holdings[0]!.qty).toBeGreaterThan(10)
    expect(s.player.cash).toBeLessThan(base.player.cash)
  })
  it('buyStockPct는 살 수 없으면 조용히 넘어간다', () => {
    const s = makeState(); s.player.cash = 0
    expect(() => applyEffects(s, [{ type: 'buyStockPct', stockId: 's1', pct: 0.5 }])).not.toThrow()
  })
})

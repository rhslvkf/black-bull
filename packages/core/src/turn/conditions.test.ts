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
  it('buyStockPct는 살 수 없으면 조용히 넘어간다', () => {
    const s = makeState(); s.player.cash = 0
    expect(() => applyEffects(s, [{ type: 'buyStockPct', stockId: 's1', pct: 0.5 }])).not.toThrow()
  })
  it('buyStockPct는 티어락처럼 GameError로 실패하면(수량은 확보되지만) 상태를 바꾸지 않는다', () => {
    const s = makeState()
    // 자금은 충분해 qty > 0으로 buy()까지 도달하지만, tierGate가 player.tier(0)보다 높아 TIER_LOCKED로 실패한다.
    s.stockDefs = s.stockDefs.map(d => d.id === 's1' ? { ...d, tierGate: 5 } : d)
    let result: ReturnType<typeof applyEffects> | undefined
    expect(() => {
      result = applyEffects(s, [{ type: 'buyStockPct', stockId: 's1', pct: 0.5 }])
    }).not.toThrow()
    expect(result).toBe(s)
  })
  it('buyStockPct는 존재하지 않는 종목이면(자금이 충분해도) 조용히 넘어간다', () => {
    const s = makeState() // cash는 기본값(넉넉함) — qty 계산 이전에 priceOf가 NO_STOCK을 던지는 경로를 검증한다
    let result: ReturnType<typeof applyEffects> | undefined
    expect(() => {
      result = applyEffects(s, [{ type: 'buyStockPct', stockId: 'nope', pct: 0.5 }])
    }).not.toThrow()
    expect(result).toBe(s)
  })
})

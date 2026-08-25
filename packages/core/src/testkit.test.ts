import { describe, it, expect } from 'vitest'
import { makeState } from './testkit'
import { BALANCE } from './balance'

describe('testkit', () => {
  it('makeState 기본값이 유효하다', () => {
    const s = makeState()
    expect(s.turn).toBe(1)
    expect(s.regimes).toHaveLength(BALANCE.totalTurns)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
    expect(s.stocks.map(x => x.id)).toEqual(['s1', 's2'])
    expect(s.stockDefs.map(x => x.id)).toEqual(['s1', 's2'])
  })
  it('override가 병합된다', () => {
    const s = makeState({ turn: 10 })
    expect(s.turn).toBe(10)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
  })
})

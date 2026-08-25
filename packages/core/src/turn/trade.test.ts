import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { buy, sell, canSell, maxBuyQty } from './trade'
import { totalAssets, cashRatio, portfolioLossPct } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'

describe('accounting', () => {
  it('보유 없으면 총자산 = 현금', () => {
    expect(totalAssets(makeState())).toBe(BALANCE.seedMoney)
  })
  it('총자산은 대출을 뺀다', () => {
    const s = makeState()
    s.player.loan = 1_000_000
    expect(totalAssets(s)).toBe(BALANCE.seedMoney - 1_000_000)
  })
  it('cashRatio가 비중을 반영한다', () => {
    const s = makeState()
    s.player.cash = 5000
    s.player.holdings = [{ stockId: 's1', qty: 1, avgCost: 10000, heldTurns: 0 }]
    expect(cashRatio(s)).toBeCloseTo(5000 / 15000, 5)
  })
  it('portfolioLossPct: 평가손실이 있으면 양수', () => {
    const s = makeState()
    s.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 20000, heldTurns: 0 }]
    expect(portfolioLossPct(s)).toBeCloseTo(50, 5)
  })
  it('portfolioLossPct: 수익이면 0', () => {
    const s = makeState()
    s.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 5000, heldTurns: 0 }]
    expect(portfolioLossPct(s)).toBe(0)
  })
})

describe('buy', () => {
  it('현금이 줄고 수량이 늘고 수수료가 붙는다', () => {
    const s = buy(makeState(), 's1', 10)
    const cost = 10 * 10000
    expect(s.player.cash).toBe(BALANCE.seedMoney - cost - Math.floor(cost * BALANCE.feeRate))
    expect(s.player.holdings[0]!.qty).toBe(10)
    expect(s.player.holdings[0]!.avgCost).toBe(10000)
  })
  it('추가 매수는 평단을 가중평균한다', () => {
    let s = makeState()
    s.stocks[0]!.price = 10000
    s = buy(s, 's1', 10)
    s.stocks[0]!.price = 20000
    s = buy(s, 's1', 10)
    expect(s.player.holdings[0]!.avgCost).toBe(15000)
    expect(s.player.holdings[0]!.qty).toBe(20)
  })
  it('현금 부족이면 NO_CASH', () => {
    expect(() => buy(makeState(), 's1', 10_000)).toThrow(GameError)
  })
  it('티어 미달이면 TIER_LOCKED', () => {
    const s = makeState({ stockDefs: [makeStockDef({ id: 's1', tierGate: 3 })], stocks: [makeStock({ id: 's1' })] })
    expect(() => buy(s, 's1', 1)).toThrow(/TIER_LOCKED/)
  })
  it('수량 0 이하는 BAD_QTY', () => {
    expect(() => buy(makeState(), 's1', 0)).toThrow(/BAD_QTY/)
  })
  it('maxBuyQty만큼은 항상 살 수 있다', () => {
    const s = makeState()
    const q = maxBuyQty(s, 's1')
    expect(q).toBeGreaterThan(0)
    expect(() => buy(s, 's1', q)).not.toThrow()
    expect(() => buy(s, 's1', q + 1)).toThrow()
  })
  it('원본 상태를 변경하지 않는다', () => {
    const s = makeState()
    buy(s, 's1', 10)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
    expect(s.player.holdings).toHaveLength(0)
  })
})

describe('sell', () => {
  it('수수료+세금을 뗀 금액이 입금된다', () => {
    let s = buy(makeState(), 's1', 10)
    const cashAfterBuy = s.player.cash
    s = sell(s, 's1', 10)
    const gross = 10 * 10000
    const net = gross - Math.floor(gross * BALANCE.feeRate) - Math.floor(gross * BALANCE.taxRate)
    expect(s.player.cash).toBe(cashAfterBuy + net)
    expect(s.player.holdings).toHaveLength(0)
  })
  it('왕복 거래는 반드시 손해다', () => {
    const before = totalAssets(makeState())
    const s = sell(buy(makeState(), 's1', 10), 's1', 10)
    expect(totalAssets(s)).toBeLessThan(before)
  })
  it('보유량 초과는 NO_QTY', () => {
    const s = buy(makeState(), 's1', 5)
    expect(() => sell(s, 's1', 6)).toThrow(/NO_QTY/)
  })
  it('멘탈 흔들림 + 손실 20% 이상이면 SELL_BLOCKED', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 7000
    s.player.mental = 10
    expect(canSell(s, 's1').ok).toBe(false)
    expect(() => sell(s, 's1', 1)).toThrow(/SELL_BLOCKED/)
  })
  it('멘탈 흔들림이어도 손실 20% 미만이면 팔린다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 9000
    s.player.mental = 10
    expect(canSell(s, 's1').ok).toBe(true)
  })
  it('멘탈이 정상이면 큰 손실도 팔린다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 3000
    s.player.mental = 80
    expect(() => sell(s, 's1', 10)).not.toThrow()
  })
  it('손절 시 lossCuts 트래커가 오른다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 8000
    s = sell(s, 's1', 10)
    expect(s.trackers.lossCuts).toBe(1)
  })
  it('큰손 티어는 매도 시 주가를 누른다', () => {
    let s = makeState()
    s.player.tier = 5
    s.player.cash = 1e12
    s = buy(s, 's1', 5_000_000)
    const p = s.stocks[0]!.price
    s = sell(s, 's1', 5_000_000)
    expect(s.stocks[0]!.price).toBeLessThan(p)
  })
})

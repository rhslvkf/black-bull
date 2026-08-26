import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { buy, sell, canSell, maxBuyQty, canAverageDown, averageDown } from './trade'
import { totalAssets, cashRatio, portfolioLossPct, positionLossPct, priceOf, fee, tax } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { loadCards } from './cards'

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
  it('cashRatio: 총자산이 음수면 0이다 (지급불능을 현금비중 1로 읽지 않는다)', () => {
    const s = makeState()
    s.player.cash = 0
    s.player.loan = 1_000_000
    expect(totalAssets(s)).toBeLessThan(0)
    expect(cashRatio(s)).toBe(0)
  })
  it('cashRatio: 총자산이 정확히 0이면 0이다', () => {
    const s = makeState()
    s.player.cash = 0
    expect(totalAssets(s)).toBe(0)
    expect(cashRatio(s)).toBe(0)
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
  it('priceOf: 알 수 없는 종목이면 GameError(NO_STOCK)', () => {
    const s = makeState()
    expect(() => priceOf(s, 'no-such-stock')).toThrow(GameError)
    let caught: unknown
    try {
      priceOf(s, 'no-such-stock')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeInstanceOf(GameError)
    if (caught instanceof GameError) {
      expect(caught.code).toBe('NO_STOCK')
    }
  })
})

describe('buy', () => {
  it('현금이 줄고 수량이 늘고 수수료가 붙는다', () => {
    const s = buy(makeState(), 's1', 10)
    const cost = 10 * 10000
    expect(s.player.cash).toBe(BALANCE.seedMoney - cost - fee(cost))
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
  it('maxBuyQty는 buy가 실제로 받아주는 정확한 경계다 (여러 현금 액수)', () => {
    const price = 10000
    for (const cash of [10000, 10001, 10002, 20002, 20003, BALANCE.seedMoney]) {
      const s = makeState()
      s.stocks[0]!.price = price
      s.player.cash = cash
      const q = maxBuyQty(s, 's1')
      if (q > 0) expect(() => buy(s, 's1', q)).not.toThrow()
      expect(() => buy(s, 's1', q + 1)).toThrow()
    }
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
    const net = gross - fee(gross) - tax(gross)
    expect(s.player.cash).toBe(cashAfterBuy + net)
    expect(s.player.holdings).toHaveLength(0)
  })
  it('왕복 거래는 반드시 손해다', () => {
    const before = totalAssets(makeState())
    const s = sell(buy(makeState(), 's1', 10), 's1', 10)
    expect(totalAssets(s)).toBeLessThan(before)
  })
  it('최소 단위(최저가 1주) 왕복 거래도 반드시 손해다', () => {
    const s0 = makeState({
      stockDefs: [makeStockDef({ id: 's1' })],
      stocks: [makeStock({ id: 's1', price: BALANCE.minPrice })],
    })
    const before = totalAssets(s0)
    const s = sell(buy(s0, 's1', 1), 's1', 1)
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
  it('게임 종료 상태에서는 보유량 부족보다 NOT_PLAYING이 우선한다', () => {
    let s = buy(makeState(), 's1', 5)
    s = { ...s, status: 'ended' }
    expect(() => sell(s, 's1', 6)).toThrow(/NOT_PLAYING/)
  })
  it('멘탈이 정확히 shakenMax(29)이고 손실 30%면 차단된다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 7000 // (10000-7000)/10000*100 = 30%
    s.player.mental = BALANCE.mental.shakenMax
    expect(canSell(s, 's1').ok).toBe(false)
  })
  it('멘탈이 shakenMax+1(30)이고 손실 30%면 허용된다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 7000
    s.player.mental = BALANCE.mental.shakenMax + 1
    expect(canSell(s, 's1').ok).toBe(true)
  })
  it('손실이 정확히 sellBlockLossPct(20%)이고 멘탈 흔들림이면 차단된다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 8000 // (10000-8000)/10000*100 = 20%
    s.player.mental = 10
    expect(positionLossPct(s, 's1')).toBe(BALANCE.mental.sellBlockLossPct)
    expect(canSell(s, 's1').ok).toBe(false)
  })
  it('손실이 sellBlockLossPct(20%) 미만이고 멘탈 흔들림이면 허용된다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 8001 // (10000-8001)/10000*100 = 19.99%
    s.player.mental = 10
    expect(positionLossPct(s, 's1')).toBeLessThan(BALANCE.mental.sellBlockLossPct)
    expect(canSell(s, 's1').ok).toBe(true)
  })
})

// 최종 리뷰 Minor 13: buy 경로의 큰손 체결충격은 통째로 지워도 스위트가 조용했다.
// sell 쪽만 고정돼 있던 대칭을 맞춘다.
describe('큰손 체결충격은 매수·매도 양쪽에 걸린다 (최종 리뷰 Minor 13)', () => {
  it('큰손 티어는 매수 시 주가를 밀어 올린다', () => {
    const s = makeState()
    s.player.tier = 5
    s.player.cash = 1e12
    const before = s.stocks[0]!.price
    const after = buy(s, 's1', 5_000_000)
    expect(after.stocks[0]!.price).toBeGreaterThan(before)
  })
  it('큰손이 아니면 매수해도 주가가 움직이지 않는다', () => {
    const s = makeState()
    s.player.cash = 1e12
    const before = s.stocks[0]!.price
    const after = buy(s, 's1', 5_000_000)
    expect(after.stocks[0]!.price).toBe(before)
  })
})

describe('averageDown', () => {
  it('보유하지 않은 종목은 물타기할 수 없다', () => {
    const s = makeState({ player: { ...makeState().player, cash: 1_000_000, holdings: [] } })
    expect(canAverageDown(s, 'sjc').ok).toBe(false)
    // canAverageDown 판정만으로는 averageDown이 실제로 그 판정을 지키는지 고정하지 못한다
    // (뮤테이션 검증 MU1: 가드 호출을 지워도 canAverageDown 자체는 여전히 false를 반환한다).
    expect(averageDown(s, 'sjc', 500_000)).toEqual(s)
  })

  it('평단보다 현재가가 높으면 물타기할 수 없다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
      stocks: [makeStock({ id: 'sjc', price: 12000 })],
      player: { ...makeState().player, cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    expect(canAverageDown(s, 'sjc').ok).toBe(false)
    expect(averageDown(s, 'sjc', 500_000)).toEqual(s)
  })

  it('물타기하면 평단이 실제로 내려간다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { ...makeState().player, cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    const after = averageDown(s, 'sjc', 500_000)
    const h = after.player.holdings.find(x => x.stockId === 'sjc')!
    expect(h.avgCost).toBeLessThan(10000)
    expect(h.qty).toBeGreaterThan(10)
  })

  it('예산을 넘겨 쓰지 않는다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { ...makeState().player, cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    const after = averageDown(s, 'sjc', 300_000)
    expect(s.player.cash - after.player.cash).toBeLessThanOrEqual(300_000)
  })

  it('현금이 1주 값에 못 미치면 상태가 그대로다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { ...makeState().player, cash: 100, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    expect(averageDown(s, 'sjc', 100)).toEqual(s)
  })
})

describe('카드 풀 재편', () => {
  it('물타기 카드가 사라졌다', () => {
    expect(loadCards().find(c => c.id === 'avgdown')).toBeUndefined()
  })
  it('존버가 회복 카드가 됐다', () => {
    expect(loadCards().find(c => c.id === 'hodl')!.isRecovery).toBe(true)
  })
})

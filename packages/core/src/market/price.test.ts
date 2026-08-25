import { describe, it, expect } from 'vitest'
import { createRng } from '../rng/rng'
import { stepPrices, applyWhaleImpact } from './price'
import { makeStockDef, makeStock } from '../testkit'
import { BALANCE } from '../balance'

const noImpact = new Map<string, number>()

describe('stepPrices', () => {
  it('변동성·베타 0이고 fundamental=price면 가격이 그대로다', () => {
    const defs = [makeStockDef({ id: 'a' })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBe(10000)
  })
  it('일반주의 적정가는 매 턴 fundamentalGrowth만큼 자란다', () => {
    const defs = [makeStockDef({ id: 'a' })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.fundamental).toBe(Math.round(10000 * Math.exp(BALANCE.fundamentalGrowth)))
    // 성장률이 0이면 위 단언은 그대로 통과한다 — 실제로 자라는지를 따로 못박는다.
    expect(out[0]!.fundamental).toBeGreaterThan(10000)
  })
  it('적정가 성장 덕분에 장기 보유가 보상받는다 (침체 국면에서도 우상향)', () => {
    // beta=0·volatility=0·hype=0·충격 없음 → 가격을 움직이는 항은 평균회귀뿐이고,
    // 평균회귀가 쫓아가는 목표(fundamental)가 매 턴 자란다. 성장 항을 지우면 이 종목의
    // 가격은 60턴 뒤에도 정확히 10000에 머물러 이 테스트가 실패한다 (뮤테이션 검증: 보고서).
    const defs = [makeStockDef({ id: 'a' })]
    let stocks = [makeStock({ id: 'a' })]
    let rng = createRng(1)
    for (let i = 0; i < 60; i++) {
      const [st, r] = stepPrices(stocks, defs, 'stagnation', noImpact, rng)
      stocks = st; rng = r
    }
    expect(stocks[0]!.price).toBeGreaterThan(10000)
    // 가격은 적정가를 추월하지 않는다 (평균회귀가 목표를 뒤따르는 구조)
    expect(stocks[0]!.price).toBeLessThan(stocks[0]!.fundamental)
  })
  it('ETF의 적정가는 성장하지 않고 가격을 그대로 따라간다', () => {
    const defs = [makeStockDef({ id: 'l', etf: 'lev', beta: 0, volatility: 0, hype: 0 })]
    const [out] = stepPrices([makeStock({ id: 'l' })], defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.fundamental).toBe(out[0]!.price)
  })
  it('평균회귀: 저평가면 오른다', () => {
    const defs = [makeStockDef({ id: 'a', fundamental: 20000 })]
    const stocks = [makeStock({ id: 'a', price: 10000, fundamental: 20000 })]
    const [out] = stepPrices(stocks, defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
  })
  it('평균회귀: 고평가면 내린다', () => {
    const defs = [makeStockDef({ id: 'a', fundamental: 5000 })]
    const stocks = [makeStock({ id: 'a', price: 10000, fundamental: 5000 })]
    const [out] = stepPrices(stocks, defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBeLessThan(10000)
  })
  it('crash 국면 드리프트가 가격을 떨어뜨린다', () => {
    const defs = [makeStockDef({ id: 'a', beta: 1 })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'crash', noImpact, createRng(1))
    expect(out[0]!.price).toBeLessThan(10000)
  })
  it('hype가 높을수록 충격이 증폭된다', () => {
    const lo = makeStockDef({ id: 'a', hype: 0 })
    const hi = makeStockDef({ id: 'a', hype: 1 })
    const imp = new Map([['stock:a', 0.1]])
    const [l] = stepPrices([makeStock({ id: 'a' })], [lo], 'stagnation', imp, createRng(1))
    const [h] = stepPrices([makeStock({ id: 'a' })], [hi], 'stagnation', imp, createRng(1))
    expect(h[0]!.price).toBeGreaterThan(l[0]!.price)
  })
  it('이벤트 충격에 BALANCE.impact.mul이 곱해진다', () => {
    // 이벤트 임팩트는 주가를 움직이는 가장 큰 채널인데 BALANCE에 손잡이가 없었다(Fix Round 1).
    // beta=0·volatility=0·fundamental=price라 충격 항만 남는 상태에서 정확히 검사한다.
    const defs = [makeStockDef({ id: 'a', hype: 0 })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'stagnation', new Map([['market', 0.1]]), createRng(1))
    expect(out[0]!.price).toBe(Math.round(10000 * Math.exp(0.1 * BALANCE.impact.mul)))
    // mul이 1이면 위 단언은 그대로 통과한다 — 실제로 배율이 걸려 있는지를 따로 못박는다.
    expect(BALANCE.impact.mul).toBeLessThan(1)
    expect(out[0]!.price).toBeLessThan(Math.round(10000 * Math.exp(0.1)))
  })
  it('지수 ETF는 종목·섹터 충격을 받지 않고 시장 충격만 받는다', () => {
    const defs = [makeStockDef({ id: 'l', etf: 'lev', beta: 0, sector: '금융' })]
    const imp = new Map([['sector:금융', 0.2], ['stock:l', 0.2]])
    const [out] = stepPrices([makeStock({ id: 'l' })], defs, 'stagnation', imp, createRng(1))
    expect(out[0]!.price).toBe(10000)
  })
  it('곱버스(inv) ETF는 시장 충격을 반대로 받는다', () => {
    // beta만 뒤집으면 국면 드리프트만 반대가 되고 뉴스 충격에는 시장과 같은 방향으로 움직인다.
    const lev = makeStockDef({ id: 'l', etf: 'lev', beta: 0 })
    const inv = makeStockDef({ id: 'i', etf: 'inv', beta: 0 })
    const imp = new Map([['market', 0.1]])
    const [out] = stepPrices([makeStock({ id: 'l' }), makeStock({ id: 'i' })], [lev, inv], 'stagnation', imp, createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
    expect(out[1]!.price).toBeLessThan(10000)
  })
  it('섹터 충격이 같은 섹터에만 적용된다', () => {
    const defs = [makeStockDef({ id: 'a', sector: '바이오' }), makeStockDef({ id: 'b', sector: '조선' })]
    const stocks = [makeStock({ id: 'a' }), makeStock({ id: 'b' })]
    const [out] = stepPrices(stocks, defs, 'stagnation', new Map([['sector:바이오', 0.2]]), createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
    expect(out[1]!.price).toBe(10000)
  })
  it('inv ETF는 시장 드리프트에 반대로 움직인다', () => {
    const defs = [makeStockDef({ id: 'i', beta: -2, etf: 'inv' })]
    const [out] = stepPrices([makeStock({ id: 'i' })], defs, 'crash', noImpact, createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
  })
  it('ETF는 fundamental이 price를 따라간다', () => {
    const defs = [makeStockDef({ id: 'l', beta: 2, etf: 'lev' })]
    const [out] = stepPrices([makeStock({ id: 'l' })], defs, 'boom', noImpact, createRng(1))
    expect(out[0]!.fundamental).toBe(out[0]!.price)
  })
  it('ETF는 평균회귀의 영향을 받지 않고, 동일 조건의 일반주는 fundamental로 끌려간다', () => {
    // beta=0이면 국면 드리프트가 사라지고, volatility=0·hype=0·noImpact이면
    // 가격을 움직이는 항은 평균회귀뿐이다. ETF는 그 항이 없으므로 price가 그대로여야 하고,
    // 동일 수치의 일반주는 fundamental(5000) 쪽으로 끌려 내려가야 한다.
    const etfDef = makeStockDef({ id: 'l', etf: 'lev', beta: 0, volatility: 0, hype: 0 })
    const normalDef = makeStockDef({ id: 'n', beta: 0, volatility: 0, hype: 0 })
    const etfStock = makeStock({ id: 'l', price: 20000, fundamental: 5000 })
    const normalStock = makeStock({ id: 'n', price: 20000, fundamental: 5000 })
    const [out] = stepPrices([etfStock, normalStock], [etfDef, normalDef], 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBe(20000)
    expect(out[1]!.price).toBeLessThan(20000)
  })
  it('가격은 minPrice 아래로 안 내려간다', () => {
    const defs = [makeStockDef({ id: 'a', beta: 5, volatility: 0.5 })]
    let stocks = [makeStock({ id: 'a', price: 60, fundamental: 1 })]
    let rng = createRng(3)
    for (let i = 0; i < 60; i++) { const [s, r] = stepPrices(stocks, defs, 'crash', noImpact, rng); stocks = s; rng = r }
    expect(stocks[0]!.price).toBeGreaterThanOrEqual(BALANCE.minPrice)
  })
  it('history는 historyLen을 넘지 않는다', () => {
    const defs = [makeStockDef({ id: 'a' })]
    let stocks = [makeStock({ id: 'a' })]
    let rng = createRng(2)
    for (let i = 0; i < BALANCE.historyLen + 20; i++) { const [s, r] = stepPrices(stocks, defs, 'boom', noImpact, rng); stocks = s; rng = r }
    expect(stocks[0]!.history.length).toBe(BALANCE.historyLen)
  })
  it('가격은 정수다', () => {
    const defs = [makeStockDef({ id: 'a', volatility: 0.05, beta: 1 })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'boom', noImpact, createRng(11))
    expect(Number.isInteger(out[0]!.price)).toBe(true)
  })
  it('입력 배열을 변경하지 않는다', () => {
    const defs = [makeStockDef({ id: 'a', beta: 1 })]
    const stocks = [makeStock({ id: 'a' })]
    stepPrices(stocks, defs, 'boom', noImpact, createRng(1))
    expect(stocks[0]!.price).toBe(10000)
    expect(stocks[0]!.history).toEqual([10000])
  })
  it('def가 없는 종목은 에러를 던진다', () => {
    const defs = [makeStockDef({ id: 'a' })]
    const stocks = [makeStock({ id: 'missing' })]
    expect(() => stepPrices(stocks, defs, 'stagnation', noImpact, createRng(1)))
      .toThrow('stepPrices: no StockDef for missing')
  })
})

describe('applyWhaleImpact', () => {
  it('매수는 가격을 올리고 매도는 내린다', () => {
    expect(applyWhaleImpact(10000, 1e10, 'buy')).toBeGreaterThan(10000)
    expect(applyWhaleImpact(10000, 1e10, 'sell')).toBeLessThan(10000)
  })
  it('충격은 maxImpact로 상한이 있다', () => {
    const p = applyWhaleImpact(10000, 1e15, 'buy')
    expect(p).toBeLessThanOrEqual(Math.round(10000 * (1 + BALANCE.whale.maxImpact)))
  })
  it('매도 충격도 maxImpact로 하한이 있다', () => {
    const p = applyWhaleImpact(10000, 1e15, 'sell')
    expect(p).toBeGreaterThanOrEqual(Math.round(10000 * (1 - BALANCE.whale.maxImpact)))
  })
  it('notional이 0이면 가격이 그대로다', () => {
    expect(applyWhaleImpact(10000, 0, 'buy')).toBe(10000)
    expect(applyWhaleImpact(10000, 0, 'sell')).toBe(10000)
  })
  it('음수 notional은 sell에서 가격을 올리지 않고 buy에서 내리지 않는다', () => {
    expect(applyWhaleImpact(10000, -1e10, 'sell')).toBeLessThanOrEqual(10000)
    expect(applyWhaleImpact(10000, -1e10, 'buy')).toBeGreaterThanOrEqual(10000)
  })
})

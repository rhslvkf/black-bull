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

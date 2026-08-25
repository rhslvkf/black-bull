import { Rand, type RngState } from '../rng/rng'
import { BALANCE } from '../balance'
import type { Regime, StockDef, StockState } from '../types'

export function stepPrices(
  stocks: StockState[], defs: StockDef[], regime: Regime,
  impacts: Map<string, number>, rng: RngState,
): [StockState[], RngState] {
  const rand = new Rand(rng)
  const { drift, vol } = BALANCE.regime[regime]
  const byId = new Map(defs.map(d => [d.id, d]))
  const market = impacts.get('market') ?? 0

  const out = stocks.map(s => {
    const d = byId.get(s.id)
    if (!d) throw new Error(`stepPrices: no StockDef for ${s.id}`)
    // 지수 ETF는 개별 종목·섹터 뉴스와 무관하고 시장 충격만 받되, BALANCE.etfShockMul
    // 배수로 받는다. beta만 뒤집어 두면 국면 드리프트만 반대·2배가 되고 뉴스에는
    // 1배·같은 방향으로 움직여서 '레버리지'도 '곱버스'도 이름값을 못 한다.
    const shock = d.etf
      ? market * BALANCE.etfShockMul[d.etf]
      : (market + (impacts.get(`stock:${s.id}`) ?? 0) + (impacts.get(`sector:${d.sector}`) ?? 0)) * (1 + d.hype)
    let r = drift * d.beta
      + rand.normal(0, d.volatility * vol)
      + shock * BALANCE.impact.mul
    if (!d.etf) r += BALANCE.meanRev * Math.log(s.fundamental / s.price)

    const price = Math.max(BALANCE.minPrice, Math.round(s.price * Math.exp(r)))
    const history = [...s.history, price].slice(-BALANCE.historyLen)
    // 적정가는 매 턴 fundamentalGrowth만큼 자란다. 평균회귀가 가격을 끌고 가는 목표 자체가
    // 위로 움직이므로, 국면 드리프트와 달리 이 성장분은 되돌려지지 않는다 = 장기 보유의 보상.
    // (이번 턴 가격은 성장 전 fundamental로 계산한 뒤 성장시킨다.)
    const fundamental = d.etf ? price : Math.round(s.fundamental * Math.exp(BALANCE.fundamentalGrowth))
    return { ...s, price, fundamental, history }
  })
  return [out, rand.state]
}

export function applyWhaleImpact(price: number, notional: number, side: 'buy' | 'sell'): number {
  const mag = Math.min(BALANCE.whale.maxImpact, Math.max(0, notional / BALANCE.whale.notionalDiv))
  const p = Math.round(price * (1 + (side === 'buy' ? mag : -mag)))
  return Math.max(BALANCE.minPrice, p)
}

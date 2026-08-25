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
    const shock = market + (impacts.get(`stock:${s.id}`) ?? 0) + (impacts.get(`sector:${d.sector}`) ?? 0)
    let r = drift * d.beta
      + rand.normal(0, d.volatility * vol)
      + shock * (1 + d.hype)
    if (!d.etf) r += BALANCE.meanRev * Math.log(s.fundamental / s.price)

    const price = Math.max(BALANCE.minPrice, Math.round(s.price * Math.exp(r)))
    const history = [...s.history, price].slice(-BALANCE.historyLen)
    return { ...s, price, fundamental: d.etf ? price : s.fundamental, history }
  })
  return [out, rand.state]
}

export function applyWhaleImpact(price: number, notional: number, side: 'buy' | 'sell'): number {
  const mag = Math.min(BALANCE.whale.maxImpact, Math.max(0, notional / BALANCE.whale.notionalDiv))
  const p = Math.round(price * (1 + (side === 'buy' ? mag : -mag)))
  return Math.max(BALANCE.minPrice, p)
}

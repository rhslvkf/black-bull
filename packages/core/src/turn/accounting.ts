import type { GameState } from '../types'

export function priceOf(state: GameState, stockId: string): number {
  const s = state.stocks.find(x => x.id === stockId)
  if (!s) throw new Error(`NO_STOCK:${stockId}`)
  return s.price
}
export function holdingValue(state: GameState): number {
  return state.player.holdings.reduce((a, h) => a + h.qty * priceOf(state, h.stockId), 0)
}
export function totalAssets(state: GameState): number {
  return state.player.cash + holdingValue(state) - state.player.loan
}
export function cashRatio(state: GameState): number {
  const t = totalAssets(state)
  return t <= 0 ? 1 : Math.min(1, state.player.cash / t)
}
export function portfolioLossPct(state: GameState): number {
  const cost = state.player.holdings.reduce((a, h) => a + h.qty * h.avgCost, 0)
  if (cost <= 0) return 0
  const val = holdingValue(state)
  return val >= cost ? 0 : ((cost - val) / cost) * 100
}
export function positionLossPct(state: GameState, stockId: string): number {
  const h = state.player.holdings.find(x => x.stockId === stockId)
  if (!h || h.avgCost <= 0) return 0
  const p = priceOf(state, stockId)
  return p >= h.avgCost ? 0 : ((h.avgCost - p) / h.avgCost) * 100
}

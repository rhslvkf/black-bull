import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const FEE_PPM = Math.round(BALANCE.feeRate * 1_000_000)
const TAX_PPM = Math.round(BALANCE.taxRate * 1_000_000)

export const fee = (gross: number) => (gross > 0 ? Math.max(1, Math.floor((gross * FEE_PPM) / 1_000_000)) : 0)
export const tax = (gross: number) => (gross > 0 ? Math.max(1, Math.floor((gross * TAX_PPM) / 1_000_000)) : 0)

export function priceOf(state: GameState, stockId: string): number {
  const s = state.stocks.find(x => x.id === stockId)
  if (!s) throw new GameError('NO_STOCK')
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
  return t <= 0 ? 0 : Math.min(1, state.player.cash / t)
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

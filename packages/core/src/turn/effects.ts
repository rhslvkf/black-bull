import type { Effect, GameState } from '../types'
import { buy, maxBuyQty } from './trade'
import { priceOf } from './accounting'

const clampStat = (v: number) => Math.max(0, Math.min(10, Math.round(v * 10) / 10))
const bump = (s: GameState, key: string, delta: number): GameState =>
  ({ ...s, flags: { ...s.flags, [key]: Number(s.flags[key] ?? 0) + delta } })

function buyWithBudget(state: GameState, stockId: string, budget: number): GameState {
  const price = priceOf(state, stockId)
  const qty = Math.min(maxBuyQty(state, stockId), Math.floor(budget / price))
  if (qty <= 0) return state
  try { return buy(state, stockId, qty) } catch { return state }
}

export function applyEffects(state: GameState, effects: Effect[]): GameState {
  let s = state
  for (const e of effects) {
    switch (e.type) {
      case 'stat': {
        const stat = e.stat
        s = { ...s, player: { ...s.player, stats: { ...s.player.stats, [stat]: clampStat(s.player.stats[stat] + e.delta) } } }
        break
      }
      case 'mental': s = bump(s, '__mentalPending', e.delta); break
      case 'condition': s = bump(s, '__conditionPending', e.delta); break
      case 'cash': s = { ...s, player: { ...s.player, cash: Math.max(0, s.player.cash + e.delta) } }; break
      case 'flag':
        s = e.value === 'inc'
          ? bump(s, e.key, 1)
          : { ...s, flags: { ...s.flags, [e.key]: e.value } }
        break
      case 'impact':
        s = { ...s, pendingImpacts: [...s.pendingImpacts, {
          target: e.target, magnitude: e.magnitude,
          dueTurn: s.turn + e.delay, revealTurn: s.turn, revealed: false, title: e.title,
        }] }
        break
      case 'retire': s = { ...s, player: { ...s.player, employed: false } }; break
      case 'rivalMul': s = { ...s, rivalAssets: Math.round(s.rivalAssets * e.value) }; break
      case 'fundamentalMul':
        s = { ...s, stocks: s.stocks.map(x => x.id === e.stockId ? { ...x, fundamental: Math.round(x.fundamental * e.value) } : x) }
        break
      case 'buyStockPct': s = buyWithBudget(s, e.stockId, s.player.cash * e.pct); break
      case 'averageDown': {
        const losing = s.player.holdings
          .filter(h => priceOf(s, h.stockId) < h.avgCost)
          .sort((a, b) => priceOf(s, a.stockId) / a.avgCost - priceOf(s, b.stockId) / b.avgCost)[0]
        if (losing) s = buyWithBudget(s, losing.stockId, s.player.cash * 0.2)
        break
      }
    }
  }
  return s
}

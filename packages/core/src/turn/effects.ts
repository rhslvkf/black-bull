import type { Effect, GameState } from '../types'
import { buy, maxBuyQty } from './trade'
import { priceOf } from './accounting'
import { GameError } from '../error'

const clampStat = (v: number) => Math.max(0, Math.min(10, Math.round(v * 10) / 10))
const bump = (s: GameState, key: string, delta: number): GameState =>
  ({ ...s, flags: { ...s.flags, [key]: Number(s.flags[key] ?? 0) + delta } })

// 티어락·자금부족·존재하지 않는 종목 등 게임 규칙상 실패는 조용히 무시한다(no-op).
// 그 외 예외(코드 버그 등)는 삼키지 않고 다시 던진다.
function buyWithBudget(state: GameState, stockId: string, budget: number): GameState {
  try {
    const price = priceOf(state, stockId)
    const qty = Math.min(maxBuyQty(state, stockId), Math.floor(budget / price))
    if (qty <= 0) return state
    return buy(state, stockId, qty)
  } catch (err) {
    if (err instanceof GameError) return state
    throw err
  }
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
      default: {
        const _exhaustive: never = e
        return _exhaustive
      }
    }
  }
  return s
}

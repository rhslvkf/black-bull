import type { Condition, GameState } from '../types'
import { totalAssets } from './accounting'

export function evalCondition(state: GameState, c: Condition): boolean {
  const p = state.player
  switch (c.type) {
    case 'tierMin': return p.tier >= c.value
    case 'tierMax': return p.tier <= c.value
    case 'turnMin': return state.turn >= c.value
    case 'turnMax': return state.turn <= c.value
    case 'regime': return state.regimes[state.turn - 1] === c.value
    case 'statMin': return p.stats[c.stat] >= c.value
    case 'assetsMin': return totalAssets(state) >= c.value
    case 'assetsMax': return totalAssets(state) <= c.value
    case 'employed': return p.employed === c.value
    case 'mentalMax': return p.mental <= c.value
    case 'flagEq': return state.flags[c.key] === c.value
    case 'flagMin': return Number(state.flags[c.key] ?? 0) >= c.value
    case 'flagAbsent': return state.flags[c.key] === undefined
    case 'holdsStock': return p.holdings.some(h => h.stockId === c.stockId)
  }
}

export function evalAll(state: GameState, cs?: Condition[]): boolean {
  return !cs || cs.every(c => evalCondition(state, c))
}

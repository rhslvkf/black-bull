import type { GameState, Tier } from '../types'
import { BALANCE } from '../balance'
import { totalAssets } from './accounting'

export function settlePayroll(state: GameState): GameState {
  if (state.turn % BALANCE.payPeriod !== 0) return state
  const delta = state.player.employed ? BALANCE.employedNet : -BALANCE.unemployedOut
  return { ...state, player: { ...state.player, cash: Math.max(0, state.player.cash + delta) } }
}

export function tierOf(assets: number): Tier {
  let t: Tier = 0
  for (let i = BALANCE.tierMins.length - 1; i >= 0; i--) {
    if (assets >= BALANCE.tierMins[i]!) { t = i as Tier; break }
  }
  return t
}

export function settleTier(state: GameState): GameState {
  const assets = totalAssets(state)
  const cur = state.player.tier
  const raw = tierOf(assets)

  let next = cur
  if (raw > cur) next = raw
  else if (raw < cur && assets < BALANCE.tierMins[cur]! * 0.9) next = raw

  if (next === cur) return state
  const cutscene = next > cur ? `cutscene.promote.${next}` : `cutscene.demote.${next}`
  return { ...state, player: { ...state.player, tier: next }, cutscene }
}

export function stepRival(state: GameState): GameState {
  const regime = state.regimes[state.turn - 1] ?? 'stagnation'
  const { drift } = BALANCE.regime[regime]
  const v = state.rivalAssets * Math.exp(drift * BALANCE.rival.driftMul)
  return { ...state, rivalAssets: Math.max(0, Math.round(v)) }
}

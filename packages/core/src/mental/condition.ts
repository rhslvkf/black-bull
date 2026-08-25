import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { Rand } from '../rng/rng'

const resist = (stamina: number) => Math.max(0.2, 1 - stamina * BALANCE.condition.resistPer)

export function settleCondition(state: GameState, delta: number): GameState {
  const c = BALANCE.condition
  const drain = (state.player.employed ? c.drainEmployed : c.drainUnemployed) * resist(state.player.stats.stamina)
  let condition = Math.max(0, Math.min(100, Math.round(state.player.condition + drain + delta)))
  let { burnoutTurns, mental } = state.player

  if (condition <= 0) {
    burnoutTurns = c.burnoutTurns
    condition = c.burnoutRecover
    mental = Math.max(0, Math.min(100, mental + c.burnoutMental))
  }
  return { ...state, player: { ...state.player, condition, burnoutTurns, mental } }
}

export function rollForcedSkip(state: GameState): [boolean, GameState] {
  const c = BALANCE.condition
  if (state.player.burnoutTurns > 0) {
    return [true, { ...state, player: { ...state.player, burnoutTurns: state.player.burnoutTurns - 1 } }]
  }
  if (state.player.condition >= c.forcedSkipBelow) return [false, state]

  const rand = new Rand(state.rng)
  const skip = rand.chance(c.forcedSkipChance)
  const condition = skip
    ? Math.max(0, state.player.condition + c.forcedSkipPenalty)
    : state.player.condition
  return [skip, { ...state, rng: rand.state, player: { ...state.player, condition } }]
}

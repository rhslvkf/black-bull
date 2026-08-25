import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { cashRatio, portfolioLossPct } from '../turn/accounting'

export function isShaken(state: GameState): boolean {
  return state.player.mental <= BALANCE.mental.shakenMax
}

export function mentalResist(grit: number): number {
  return Math.max(0.2, 1 - grit * BALANCE.mental.resistPer)
}

export function settleMental(state: GameState, recoveryDelta: number): GameState {
  const m = BALANCE.mental
  const loss = portfolioLossPct(state)

  let drop = 0
  if (loss > 0) drop += state.player.employed ? m.lossHold : m.lossHoldUnemployed
  const worsen = loss - state.prevLossPct
  if (worsen > 0) drop += -(worsen * m.worsenFactor)
  if (state.player.loan > 0) drop += m.margin

  let gain = recoveryDelta
  if (cashRatio(state) >= 0.5) gain += m.cashCalm

  const delta = drop * mentalResist(state.player.stats.grit) + gain
  const mental = Math.max(0, Math.min(100, Math.round(state.player.mental + delta)))

  return {
    ...state,
    player: { ...state.player, mental },
    prevLossPct: loss,
    trackers: {
      ...state.trackers,
      shakenTurns: state.trackers.shakenTurns + (mental <= m.shakenMax ? 1 : 0),
    },
  }
}

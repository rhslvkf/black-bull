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
  // 현금이 많으면 마음이 편하다 — 단, 물려 있지 않을 때만이다. 손실 중에도 이 보정이
  // 붙으면 lossHold를 이겨서 "물려 있는데 멘탈이 오르는" 상태가 되고, 흔들림이 영영
  // 발동하지 않는다. 월급이 매달 들어와 현금비중이 늘 높기 때문에 실제로 그랬다
  // (Fix Round 1: 200시드 중 흔들림을 겪은 판 0).
  if (loss <= 0 && cashRatio(state) >= m.calmCashRatio) gain += m.cashCalm

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

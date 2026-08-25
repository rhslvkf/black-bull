import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { cashRatio, holdingValue, portfolioLossPct, totalAssets } from '../turn/accounting'

export function isShaken(state: GameState): boolean {
  return state.player.mental <= BALANCE.mental.shakenMax
}

export function mentalResist(grit: number): number {
  return Math.max(0.2, 1 - grit * BALANCE.mental.resistPer)
}

/**
 * 손실 멘탈 피해의 노출도 가중 (0~1).
 *
 * `portfolioLossPct`는 **보유 원가 대비** 손실률이라 노출 규모가 전혀 반영되지 않는다.
 * 그래서 이 가중이 없으면 총자산의 0.2%짜리 1주와 몰빵이 같은 피해를 입는다.
 * 총자산이 0 이하(지급불능)면 노출을 최대로 본다 — 그 상태는 이미 최악이다.
 */
export function lossExposure(state: GameState): number {
  const assets = totalAssets(state)
  if (assets <= 0) return 1
  const ratio = holdingValue(state) / assets
  return Math.max(0, Math.min(1, ratio / BALANCE.mental.lossExposureFull))
}

export function settleMental(state: GameState, recoveryDelta: number): GameState {
  const m = BALANCE.mental
  const loss = portfolioLossPct(state)

  // 손실에서 오는 두 항(고정감소·악화)만 노출도로 가중한다. 신용(margin)은 빚을 졌다는
  // 사실 자체에 대한 것이라 노출과 무관하게 그대로 물린다.
  const exposure = lossExposure(state)
  let drop = 0
  if (loss > 0) drop += (state.player.employed ? m.lossHold : m.lossHoldUnemployed) * exposure
  const worsen = loss - state.prevLossPct
  if (worsen > 0) drop += -(worsen * m.worsenFactor) * exposure
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

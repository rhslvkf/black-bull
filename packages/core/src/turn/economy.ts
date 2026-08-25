import type { GameState, Tier } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { totalAssets } from './accounting'

export function settlePayroll(state: GameState): GameState {
  if (state.turn % BALANCE.payPeriod !== 0) return state
  const delta = state.player.employed ? BALANCE.employedNet : -BALANCE.unemployedOut
  const cash = Math.max(0, state.player.cash + delta)
  // 실제로 움직인 금액만 누적한다 — 현금이 모자라 생활비가 덜 빠졌으면 그만큼만.
  // 이 누계가 무매매 기준선(accounting.noTradeBaseline)의 유일한 근거다.
  const applied = cash - state.player.cash
  return {
    ...state,
    player: { ...state.player, cash },
    trackers: { ...state.trackers, netPayroll: state.trackers.netPayroll + applied },
  }
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
  else if (raw < cur && assets < BALANCE.tierMins[cur]! * BALANCE.tierDemoteRatio) next = raw

  if (next === cur) return state
  const cutscene = next > cur ? `cutscene.promote.${next}` : `cutscene.demote.${next}`
  return { ...state, player: { ...state.player, tier: next }, cutscene }
}

export function stepRival(state: GameState): GameState {
  // Ruling 49와 같은 처방: 폴백을 두면 인덱스가 어긋나도(off-by-one 등) 조용히 통과한다.
  // advance.ts는 이미 폴백을 지웠는데 여기만 남아 있었다(최종 리뷰 Minor 6).
  const regime = state.regimes[state.turn - 1]
  if (regime === undefined) throw new GameError('BAD_TURN')
  const { drift } = BALANCE.regime[regime]
  const v = state.rivalAssets * Math.exp(drift * BALANCE.rival.driftMul)
  return { ...state, rivalAssets: Math.max(0, Math.round(v)) }
}

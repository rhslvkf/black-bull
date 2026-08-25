import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { cashRatio, holdingValue, investmentRoi, portfolioLossPct, totalAssets } from '../turn/accounting'

export type Mood = 'normal' | 'shaken' | 'joy'

/**
 * 홈 화면 캐릭터의 표정 구간.
 *
 * 1차 축은 멘탈이다(스펙 §6 "멘탈 구간별 표정 변화"): 흔들림이면 무조건 shaken.
 * 흔들림이 아닐 때 joy와 normal을 가르는 건 **투자 성과**다 — 시장에 실제로 들어가
 * 있고, 멘탈이 넉넉하고, 무매매 기준선보다 확실히 앞서 있을 때만 웃는다.
 *
 * 세 조건이 다 필요하다:
 * - 멘탈만으로 가르면 시작값 100이 곧 joy라 첫 턴부터 환희가 된다.
 * - ROI만으로 가르면(구 구현) 월급 입금이 곧 수익이 돼 게임 내내 환희에 고정된다.
 * - 보유 조건이 없으면 **야근 카드로 번 돈**이 기준선을 밀어 올려, 주식을 한 주도
 *   안 산 판이 다시 영구 joy가 된다(브라우저 156턴 실측: 156턴 중 155턴 joy).
 *   가진 게 없으면 오를 것도 없다 — 이 표정은 "투자가 잘 되고 있다"는 뜻이다.
 */
export function moodOf(state: GameState): Mood {
  if (isShaken(state)) return 'shaken'
  const m = BALANCE.mood
  const invested = holdingValue(state) > 0
  return invested && state.player.mental >= m.joyMental && investmentRoi(state) >= m.joyRoiPct
    ? 'joy'
    : 'normal'
}

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

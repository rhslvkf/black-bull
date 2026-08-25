import raw from '../../data/endings.json'
import type { EndingResult, GameState } from '../types'
import { BALANCE } from '../balance'
import { totalAssets } from '../turn/accounting'

export const ENDINGS = raw.endings as { id: string; name: string; desc: string }[]
export const TITLES = raw.titles as { id: string; name: string }[]

const nameOf = (id: string) => ENDINGS.find(e => e.id === id)?.name ?? id
const titleOf = (id: string) => TITLES.find(t => t.id === id)?.name ?? id

function pickEnding(state: GameState, assets: number, bankrupt: boolean): string {
  const e = BALANCE.endings
  if (bankrupt || assets <= 0) return 'legend'
  if (state.player.stats.network >= 8 && state.flags['kimRoom'] === true) return 'kimheir'
  if (assets >= e.fireMin && !state.player.employed) return 'fire'
  if (assets >= 500_000_000) return 'super'
  if (assets >= 100_000_000) return 'wise'
  if (assets >= e.bankHigh) return 'bank'
  if (assets >= e.savingsBelow && assets <= e.breakevenHigh) return 'breakeven'
  if (assets > e.breakevenHigh) return 'bank'
  return 'savings'
}

function pickTitles(state: GameState, assets: number): string[] {
  const t = state.trackers
  const avgCash = t.turnsCounted > 0 ? t.cashRatioSum / t.turnsCounted : 1
  const out: string[] = []
  if (assets > state.rivalAssets) out.push('beatRival')
  if (Number(state.flags['momIgnored'] ?? 0) >= 3) out.push('momSecret')
  if (t.shakenTurns === 0) out.push('steelMental')
  if (t.lossCuts === 0) out.push('noCut')
  if (!t.usedMargin) out.push('noDebt')
  if (t.maxHeldTurns >= 52) out.push('hodler')
  if (avgCash < 0.05) out.push('allIn')
  return out.map(titleOf)
}

export function judgeEnding(state: GameState, bankrupt: boolean): EndingResult {
  const finalAssets = Math.max(0, totalAssets(state))
  const endingId = pickEnding(state, finalAssets, bankrupt)
  return { endingId, endingName: nameOf(endingId), titles: pickTitles(state, finalAssets), finalAssets }
}

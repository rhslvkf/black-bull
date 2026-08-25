import raw from '../../data/endings.json'
import type { EndingResult, GameState } from '../types'
import { BALANCE } from '../balance'
import { totalAssets } from '../turn/accounting'

// 판정 로직이 실제로 참조하는 id 전체. EndingId/TitleId는 이 배열들에서 파생되므로,
// judgeEnding/pickTitles가 알려지지 않은 id를 반환하려 하면 컴파일 에러가 된다.
// (raw as {...}[] 캐스팅 자체는 JSON import의 리터럴-넓히기 때문에 아무것도 검증하지
// 않는다 — 이 프로젝트에서 이미 세 태스크가 같은 함정에 걸렸다. endings.test.ts의
// 'endings.json 데이터 유효성' 블록이 데이터가 이 목록과 정확히 일치하는지 런타임으로
// 검증한다.)
export const ENDING_IDS = [
  'legend', 'savings', 'breakeven', 'bank', 'wise', 'super', 'fire', 'kimheir',
] as const
export type EndingId = (typeof ENDING_IDS)[number]

export const TITLE_IDS = [
  'beatRival', 'momSecret', 'steelMental', 'noCut', 'noDebt', 'hodler', 'allIn',
] as const
export type TitleId = (typeof TITLE_IDS)[number]

export const ENDINGS = raw.endings as { id: EndingId; name: string; desc: string }[]
export const TITLES = raw.titles as { id: TitleId; name: string }[]

const nameOf = (id: EndingId) => ENDINGS.find(e => e.id === id)?.name ?? id
const titleOf = (id: TitleId) => TITLES.find(t => t.id === id)?.name ?? id

function pickEnding(state: GameState, assets: number, bankrupt: boolean): EndingId {
  const e = BALANCE.endings
  if (bankrupt || assets <= 0) return 'legend'
  if (state.player.stats.network >= 8 && state.flags['kimRoom'] === true) return 'kimheir'
  if (assets >= e.fireMin && !state.player.employed) return 'fire'
  if (assets >= e.superMin) return 'super'
  if (assets >= e.wiseMin) return 'wise'
  if (assets > e.breakevenHigh) return 'bank'
  if (assets >= e.savingsBelow) return 'breakeven'
  return 'savings'
}

function pickTitles(state: GameState, assets: number): string[] {
  const t = state.trackers
  const avgCash = t.turnsCounted > 0 ? t.cashRatioSum / t.turnsCounted : 1
  const out: TitleId[] = []
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

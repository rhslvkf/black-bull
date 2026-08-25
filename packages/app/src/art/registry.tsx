import { TIERS, MOODS, NPCS, SECTORS, ENDING_IDS, UI_KEYS, PROMOTE_TIERS, DEMOTE_TIERS, type ArtKey } from './keys'
import { makeCharacter, type ArtProps } from './parts/Character'
import { makePortrait } from './parts/Portraits'
import { makeScene, makeIcon } from './parts/Scenes'

export type ArtSource =
  | { kind: 'svg'; component: React.FC<ArtProps> }
  | { kind: 'image'; src: string }

const TIER_LABELS = ['주린이', '개미', '불개미', '슬기로운 개미', '슈퍼개미', '큰손']
const ENDING_META: Record<string, [string, string]> = {
  legend: ['#6e2b2b', '💀'], savings: ['#4a4a4a', '🏦'], breakeven: ['#3f5a6b', '😐'],
  bank: ['#3f6b52', '🙂'], wise: ['#3f7d6b', '📈'], super: ['#a58a3f', '🐜'],
  fire: ['#c9702a', '🔥'], kimheir: ['#7a2f6b', '📢'],
}
const SECTOR_GLYPH: Record<string, string> = {
  '반도체': '🔲', '2차전지': '🔋', '바이오': '🧬', '조선': '🚢',
  '게임': '🎮', '금융': '🏦', '엔터': '🎤', '방산': '🛡️',
}
const UI_GLYPH: Record<string, string> = {
  'ui.mental': '🧠', 'ui.condition': '⚡', 'ui.cash': '💵', 'ui.assets': '💰',
  'ui.up': '▲', 'ui.down': '▼', 'ui.lock': '🔒', 'ui.rumor': '👂',
  'ui.news': '📰', 'ui.card': '🃏', 'ui.tier': '🏅', 'ui.calendar': '📅',
}

const entries: [string, ArtSource][] = []

for (const t of TIERS) for (const m of MOODS) {
  entries.push([`char.tier${t}.${m}`, { kind: 'svg', component: makeCharacter(t, m) }])
}
for (const n of NPCS) entries.push([`npc.${n}`, { kind: 'svg', component: makePortrait(n) }])
// settleTier(economy.ts)는 next > cur일 때 promote.${next}(next=1..5), next < cur일 때
// demote.${next}(next=0..4)를 만든다 — promote.0과 demote.5는 도달 불가능하다.
for (const t of PROMOTE_TIERS) {
  entries.push([`cutscene.promote.${t}`, { kind: 'svg', component: makeScene('#2f6b4f', '🎉', `${TIER_LABELS[t]} 승급`) }])
}
for (const t of DEMOTE_TIERS) {
  entries.push([`cutscene.demote.${t}`, { kind: 'svg', component: makeScene('#5a3a3a', '💧', `${TIER_LABELS[t]} 강등`) }])
}
for (const id of ENDING_IDS) {
  const [tone, glyph] = ENDING_META[id]!
  entries.push([`ending.${id}`, { kind: 'svg', component: makeScene(tone, glyph, id) }])
}
for (const s of SECTORS) entries.push([`sector.${s}`, { kind: 'svg', component: makeIcon(SECTOR_GLYPH[s]!, s) }])
for (const k of UI_KEYS) entries.push([k, { kind: 'svg', component: makeIcon(UI_GLYPH[k]!, k) }])

export const ART = Object.fromEntries(entries) as Record<ArtKey, ArtSource>
export const ALL_ART_KEYS = entries.map(([k]) => k) as ArtKey[]

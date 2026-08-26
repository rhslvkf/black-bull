import { ENDINGS } from '@bb/core'
import {
  TIERS, MOODS, NPCS, NPC_MOODS, BACKGROUNDS, SECTORS, ENDING_IDS, TIER_NAMES, UI_KEYS,
  PROMOTE_TIERS, DEMOTE_TIERS, type ArtKey,
} from './keys'
import { makeCharacter, type ArtProps } from './parts/Character'
import { makePortrait } from './parts/Portraits'
import { makeScene, makeIcon } from './parts/Scenes'
import { makeBackground } from './parts/Backgrounds'

export type ArtSource =
  | { kind: 'svg'; component: React.FC<ArtProps> }
  | { kind: 'image'; src: string }

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
// Minor #2: <img> 교체 시 alt에 내부 키 문자열(`char.tier0.joy` 등)이 그대로 노출되지
// 않도록, 사람이 읽을 수 있는 한국어 설명을 키 단위로 미리 만들어 둔다. Art.tsx가
// image 소스일 때 이 맵을 alt로 쓴다.
const MOOD_KO: Record<string, string> = { normal: '평상시', shaken: '흔들리는 모습', joy: '기쁜 모습' }
const NPC_NAME_KO: Record<string, string> = { daebak: '박대박', cho: '최존버', kim: '김실장', mom: '엄마' }
// Task 10: 조연 초상의 무드 축(normal/alt)은 char.*의 MOOD_KO(normal/shaken/joy)와 값이
// 겹치지 않는 별개 맵이다 — 하나로 합치면 'alt'가 없는 키에도 존재하는 것처럼 보인다.
const NPC_MOOD_KO: Record<string, string> = { normal: '기본 모습', alt: '다른 모습' }
const BG_NAME_KO: Record<string, string> = { office: '사무실', home: '집', street: '거리', exchange: '거래소' }
const UI_NAME_KO: Record<string, string> = {
  'ui.mental': '멘탈', 'ui.condition': '컨디션', 'ui.cash': '현금', 'ui.assets': '자산',
  'ui.up': '상승', 'ui.down': '하락', 'ui.lock': '잠금', 'ui.rumor': '루머',
  'ui.news': '뉴스', 'ui.card': '카드', 'ui.tier': '티어', 'ui.calendar': '달력',
}
const ENDING_NAME_KO: Record<string, string> = Object.fromEntries(ENDINGS.map(e => [e.id, e.name]))

const entries: [string, ArtSource][] = []
const altEntries: [string, string][] = []

for (const t of TIERS) for (const m of MOODS) {
  const key = `char.tier${t}.${m}`
  // 같은 문자열을 <img alt>와 <svg aria-label> 양쪽에 쓴다 — 출하 중인 건 svg 소스라
  // 여기를 나누면 실제 화면의 접근성 이름이 영영 "캐릭터"에 머문다(최종 리뷰 Minor 4).
  const alt = `${TIER_NAMES[t]} 캐릭터 (${MOOD_KO[m]})`
  entries.push([key, { kind: 'svg', component: makeCharacter(t, m, alt) }])
  altEntries.push([key, alt])
}
for (const n of NPCS) for (const m of NPC_MOODS) {
  const alt = `등장인물 ${NPC_NAME_KO[n] ?? n} (${NPC_MOOD_KO[m]})`
  entries.push([`npc.${n}.${m}`, { kind: 'svg', component: makePortrait(n, m, alt) }])
  altEntries.push([`npc.${n}.${m}`, alt])
}
for (const b of BACKGROUNDS) {
  const alt = `배경: ${BG_NAME_KO[b] ?? b}`
  entries.push([`bg.${b}`, { kind: 'svg', component: makeBackground(b, alt) }])
  altEntries.push([`bg.${b}`, alt])
}
// settleTier(economy.ts)는 next > cur일 때 promote.${next}(next=1..5), next < cur일 때
// demote.${next}(next=0..4)를 만든다 — promote.0과 demote.5는 도달 불가능하다.
for (const t of PROMOTE_TIERS) {
  entries.push([`cutscene.promote.${t}`, { kind: 'svg', component: makeScene('#2f6b4f', '🎉', `${TIER_NAMES[t]} 승급`) }])
  altEntries.push([`cutscene.promote.${t}`, `${TIER_NAMES[t]} 승급 장면`])
}
for (const t of DEMOTE_TIERS) {
  entries.push([`cutscene.demote.${t}`, { kind: 'svg', component: makeScene('#5a3a3a', '💧', `${TIER_NAMES[t]} 강등`) }])
  altEntries.push([`cutscene.demote.${t}`, `${TIER_NAMES[t]} 강등 장면`])
}
for (const id of ENDING_IDS) {
  const [tone, glyph] = ENDING_META[id]!
  entries.push([`ending.${id}`, { kind: 'svg', component: makeScene(tone, glyph, ENDING_NAME_KO[id] ?? id) }])
  altEntries.push([`ending.${id}`, `엔딩: ${ENDING_NAME_KO[id] ?? id}`])
}
for (const s of SECTORS) {
  entries.push([`sector.${s}`, { kind: 'svg', component: makeIcon(SECTOR_GLYPH[s]!, s) }])
  altEntries.push([`sector.${s}`, `${s} 섹터`])
}
for (const k of UI_KEYS) {
  entries.push([k, { kind: 'svg', component: makeIcon(UI_GLYPH[k]!, UI_NAME_KO[k] ?? k) }])
  altEntries.push([k, `${UI_NAME_KO[k] ?? k} 아이콘`])
}

export const ART = Object.fromEntries(entries) as Record<ArtKey, ArtSource>
export const ALL_ART_KEYS = entries.map(([k]) => k) as ArtKey[]
/** Minor #2: 이미지로 교체된 아트 키의 <img alt>에 쓰는 한국어 설명. */
export const ART_ALT = Object.fromEntries(altEntries) as Record<ArtKey, string>

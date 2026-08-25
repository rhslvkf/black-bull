// Ruling 56: SECTORS/ENDING_IDS는 @bb/core의 배열을 그대로 재사용한다(로컬 복제 금지).
// core가 재수출하는 배열 참조를 그대로 쓰므로, core 쪽 목록이 바뀌면 이 파일도 같은 값을
// 참조해 자동으로 따라간다 — 드리프트가 '테스트로 잡히는' 게 아니라 애초에 불가능해진다.
import { SECTORS, ENDING_IDS } from '@bb/core'
export { SECTORS, ENDING_IDS }

export const TIERS = [0, 1, 2, 3, 4, 5] as const
export const MOODS = ['normal', 'shaken', 'joy'] as const
export const NPCS = ['daebak', 'cho', 'kim', 'mom'] as const
export const UI_KEYS = [
  'ui.mental', 'ui.condition', 'ui.cash', 'ui.assets', 'ui.up', 'ui.down',
  'ui.lock', 'ui.rumor', 'ui.news', 'ui.card', 'ui.tier', 'ui.calendar',
] as const

// 컷신 키는 packages/core/src/turn/economy.ts의 settleTier가 실제로 만드는 값과 정확히
// 일치해야 한다: `next > cur`일 때 promote.${next} (next는 1..5, 티어 0으로는 승급 불가),
// `next < cur`일 때 demote.${next} (next는 0..4, 티어 5로는 강등 불가). registry.test.tsx의
// 'settleTier 컷신 키 정합성' 블록이 이 대응을 런타임으로 고정한다.
export const PROMOTE_TIERS = [1, 2, 3, 4, 5] as const
export const DEMOTE_TIERS = [0, 1, 2, 3, 4] as const

export type ArtKey =
  | `char.tier${(typeof TIERS)[number]}.${(typeof MOODS)[number]}`
  | `npc.${(typeof NPCS)[number]}`
  | `cutscene.promote.${(typeof PROMOTE_TIERS)[number]}`
  | `cutscene.demote.${(typeof DEMOTE_TIERS)[number]}`
  | `ending.${(typeof ENDING_IDS)[number]}`
  | `sector.${(typeof SECTORS)[number]}`
  | (typeof UI_KEYS)[number]

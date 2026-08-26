// Ruling 56: SECTORS/ENDING_IDS/TIER_NAMES는 @bb/core의 배열을 그대로 재사용한다(로컬 복제 금지).
// core가 재수출하는 배열 참조를 그대로 쓰므로, core 쪽 목록이 바뀌면 이 파일도 같은 값을
// 참조해 자동으로 따라간다 — 드리프트가 '테스트로 잡히는' 게 아니라 애초에 불가능해진다.
// (TIER_NAMES는 최종 리뷰 Minor B에서 registry.tsx의 TIER_LABELS로 복제돼 있던 것을 옮겼다.)
import { SECTORS, ENDING_IDS, TIER_NAMES } from '@bb/core'
export { SECTORS, ENDING_IDS, TIER_NAMES }

export const TIERS = [0, 1, 2, 3, 4, 5] as const
export const MOODS = ['normal', 'shaken', 'joy'] as const
export const NPCS = ['daebak', 'cho', 'kim', 'mom'] as const
// Task 10: 조연 초상은 화자당 두 무드(기본/다른 모습)로 나뉜다 — docs §5 아트 슬롯 규격의
// `npc.*.{normal,alt}` 행. char.*의 MOODS(normal/shaken/joy)와는 별개 축이라 이름을 분리했다
// — 재사용하면 조연에 없는 'shaken'/'joy'가 타입에 섞여 들어간다.
export const NPC_MOODS = ['normal', 'alt'] as const
// docs §5 아트 슬롯 규격 표의 배경 4행. @bb/core에 대응하는 상수가 없어(장소는 게임 로직이
// 아니라 연출 개념) Ruling 56 원칙에 따라 이 파일 한 곳에만 정의한다 — 복제할 원본이 없다.
export const BACKGROUNDS = ['office', 'home', 'street', 'exchange'] as const
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
  | `npc.${(typeof NPCS)[number]}.${(typeof NPC_MOODS)[number]}`
  | `bg.${(typeof BACKGROUNDS)[number]}`
  | `cutscene.promote.${(typeof PROMOTE_TIERS)[number]}`
  | `cutscene.demote.${(typeof DEMOTE_TIERS)[number]}`
  | `ending.${(typeof ENDING_IDS)[number]}`
  | `sector.${(typeof SECTORS)[number]}`
  | (typeof UI_KEYS)[number]

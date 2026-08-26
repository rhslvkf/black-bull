import { NPCS } from '../art/keys'

/**
 * 조연 4인의 정본 한국어 이름. Task 10(art/registry.tsx)이 처음 만든 맵을 여기로
 * 옮겼다 — Task 17(대화창)도 같은 이름을 필요로 하는데, registry.tsx 안에 갇혀
 * 있으면 art 레이어를 몰라도 되는 화면 코드가 art를 import해야 하고, 무엇보다
 * "화자별 정본 이름"이라는 같은 사실을 두 곳에 적게 된다(1차 개발에서 상수 복제가
 * 반복 결함이었다 — Ruling 56). '최존버'는 회복 카드("최존버와 소주")와 이름이
 * 맞아야 하는 값이라 한 글자만 틀려도 세계관이 갈린다.
 *
 * registry.tsx는 이제 이 맵을 여기서 import해 쓴다 — 값은 그대로, 출처만 하나다.
 */
export const NPC_NAME_KO: Record<(typeof NPCS)[number], string> = {
  daebak: '박대박',
  cho: '최존버',
  kim: '김실장',
  mom: '엄마',
}

/**
 * 한국어 이름 → NPC id 역방향 조회. DialogueBox가 받는 `speaker` prop은 이미 표시용
 * 한국어 이름(예: '김실장')이다 — 화자별 이름표 색을 CSS 토큰(`--speaker-<id>`)으로
 * 찾으려면 이 역방향 맵이 필요하다. NPC_NAME_KO를 손으로 다시 뒤집어 적지 않고
 * 여기서 한 번만 유도한다.
 */
export const NPC_ID_BY_NAME_KO: Record<string, (typeof NPCS)[number]> = Object.fromEntries(
  NPCS.map(id => [NPC_NAME_KO[id], id]),
)

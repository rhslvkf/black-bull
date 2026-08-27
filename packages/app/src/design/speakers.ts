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

const NPC_ID_SET: ReadonlySet<string> = new Set(NPCS)
/** `as` 타입 단언 없이 string을 npc id로 좁히는 유일한 통로(EventModal.tsx의
 *  isNpcName과 같은 기법). */
function isNpcId(x: string): x is (typeof NPCS)[number] {
  return NPC_ID_SET.has(x)
}

/**
 * npc id('kim' 등)든 이미 표시용으로 변환된 한국어 이름('김실장' 등)이든 받아
 * 표시 이름을 돌려준다.
 *
 * Fix Round 1 Minor 2 — 리뷰어가 Task 18에서 실제로 밟게 될 함정을 지목했다:
 * EventModal.tsx의 `def.text.speaker`는 npc id로 온다. Task 18이 `NPC_NAME_KO[id]`
 * 변환을 빼먹고 id를 그대로 DialogueBox에 넘기면, DialogueBox 입장에서는 그저 "알 수 없는
 * 화자 이름"이라 크래시 없이 --speaker-unknown(회색)으로 조용히 떨어진다 — 화면에는
 * "kim"이라는 영문 id가 이름표에 그대로 뜨는데도 아무도 에러를 못 본다.
 *
 * 이 함수를 변환 지점 하나로 세워두면 그 실수 자체가 코드 경로에서 사라진다: id를 넣어도
 * 이름을 넣어도 같은 표시 이름이 나오고(멱등), 알려진 id도 알려진 이름도 아닌 문자열은
 * DialogueBox의 '???' 규약과 동일하게 처리한다.
 */
export function speakerDisplayName(idOrName: string): string {
  if (isNpcId(idOrName)) {
    return NPC_NAME_KO[idOrName]
  }
  if (idOrName in NPC_ID_BY_NAME_KO) {
    return idOrName
  }
  return '???'
}

import { describe, it, expect } from 'vitest'
import { loadCards, loadEvents } from '@bb/core'
import { NPCS } from '../art/keys'
import { NPC_NAME_KO, NPC_ID_BY_NAME_KO, speakerDisplayName } from './speakers'

// Fix Round 1 Major — 리뷰가 design/speakers.ts의 '최존버'를 '최존버2'로 바꿨는데도
// core 451 / app 483 / sim 27이 전부 그린이었다. registry.test.tsx의 검사는 art
// 레이어(ART_ALT) 안에서만 정합성을 보므로, "이 이름이 실제 게임 콘텐츠(카드·이벤트)와
// 맞는가"는 어디서도 보지 않았다. 여기서 core의 실제 데이터(loadCards()·loadEvents())를
// 직접 대조해, 4명 각각의 이름이 그 화자로 등장하는 콘텐츠 문구에 실제로 쓰이는지 고정한다.
// NPCS를 순회하므로 4명 중 누구를 고쳐도(또는 서로 이름을 바꿔치기해도) 정확히 그 화자의
// 검사가 red가 된다 — "한 명만 고정하고 나머지가 공허한 패턴"(리뷰 지적)을 피한다.

const cards = loadCards()
const events = loadEvents()

describe('design/speakers.ts의 NPC_NAME_KO가 core 콘텐츠와 정합한다 (Fix Round 1 Major)', () => {
  NPCS.forEach(id => {
    it(`${id}로 등장하는 이벤트가 실제로 있다 (전제 확인)`, () => {
      const own = events.filter(e => e.text.speaker === id)
      expect(own.length).toBeGreaterThan(0)
    })

    it(`${id}의 정본 이름("${NPC_NAME_KO[id]}")이 그 화자로 등장하는 이벤트 문구에 실제로 쓰인다`, () => {
      const name = NPC_NAME_KO[id]
      const own = events.filter(e => e.text.speaker === id)
      const hit = own.some(e => e.text.title.includes(name) || e.text.body.includes(name))
      expect(hit, `${id}의 이벤트 어디에도 "${name}"이 나오지 않는다`).toBe(true)
    })
  })

  // '최존버'는 특히 카드 텍스트("최존버와 소주")와도 맞아야 하는 이름이다(§2.6) — 이벤트
  // 문구 대조와 별개로 카드 데이터도 직접 대조한다.
  it('최존버 이름이 회복 카드 "최존버와 소주"와 일치한다', () => {
    const drink = cards.find(c => c.id === 'drink')
    expect(drink, '카드 데이터에서 id=drink(최존버와 소주)를 찾지 못했다').toBeDefined()
    expect(drink!.name).toContain(NPC_NAME_KO.cho)
  })
})

describe('speakerDisplayName (Fix Round 1 Minor 2 — Task 18이 id 변환을 빼먹는 사고 방지)', () => {
  it('npc id를 넣으면 정본 한국어 이름이 나온다 (조연 4인 각각)', () => {
    NPCS.forEach(id => {
      expect(speakerDisplayName(id)).toBe(NPC_NAME_KO[id])
    })
  })

  it('이미 변환된 한국어 이름을 넣으면 그대로 돌아온다 (멱등)', () => {
    NPCS.forEach(id => {
      const name = NPC_NAME_KO[id]
      expect(speakerDisplayName(name)).toBe(name)
    })
  })

  it('알려진 id도 알려진 이름도 아니면 ???로 떨어진다', () => {
    expect(speakerDisplayName('unknown_speaker')).toBe('???')
    expect(speakerDisplayName('???')).toBe('???')
  })

  it('NPC_ID_BY_NAME_KO가 4명 전부를 정확히 역방향으로 담고 있다 (회귀 방지용 보조 확인)', () => {
    NPCS.forEach(id => {
      expect(NPC_ID_BY_NAME_KO[NPC_NAME_KO[id]]).toBe(id)
    })
  })
})

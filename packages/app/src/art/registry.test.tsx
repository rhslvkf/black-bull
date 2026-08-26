import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SECTORS as CORE_SECTORS, ENDING_IDS as CORE_ENDING_IDS, TIER_NAMES as CORE_TIER_NAMES } from '@bb/core'
import { ART, ALL_ART_KEYS, ART_ALT } from './registry'
import { Art } from './Art'
import {
  TIERS, MOODS, NPCS, NPC_MOODS, BACKGROUNDS, SECTORS, ENDING_IDS, TIER_NAMES, UI_KEYS,
  PROMOTE_TIERS, DEMOTE_TIERS, type ArtKey,
} from './keys'

// Ruling 56: keys.ts의 SECTORS/ENDING_IDS는 로컬 복제가 아니라 @bb/core를 그대로
// 재수출한 것이어야 한다. 값이 아니라 "같은 배열 참조"인지(toBe)를 검사한다 — 값만
// 비교하면 누군가 로컬에 core와 똑같은 값을 다시 하드코딩해도(=재수출 규약을 깨도)
// 통과해버리기 때문이다. 참조 동일성만이 "복제가 원천적으로 불가능하다"를 보장한다.
describe('SECTORS/ENDING_IDS는 @bb/core 재수출이다 (Ruling 56)', () => {
  it('keys.ts의 SECTORS는 @bb/core의 SECTORS와 동일한 배열 객체다', () => {
    expect(SECTORS).toBe(CORE_SECTORS)
  })
  it('keys.ts의 ENDING_IDS는 @bb/core의 ENDING_IDS와 동일한 배열 객체다', () => {
    expect(ENDING_IDS).toBe(CORE_ENDING_IDS)
  })
  // 최종 리뷰 Minor B: registry.tsx가 TIER_LABELS라는 이름으로 티어 이름 6종을 다시
  // 복제하고 있었다(같은 유형의 재발). 참조 동일성으로 복제를 원천 차단한다.
  it('keys.ts의 TIER_NAMES는 @bb/core의 TIER_NAMES와 동일한 배열 객체다', () => {
    expect(TIER_NAMES).toBe(CORE_TIER_NAMES)
  })
  it('컷신·캐릭터 alt 문구가 core의 티어 이름을 그대로 쓴다', () => {
    // core 이름을 바꾸면 이 단언이 같이 따라간다 — 복제본이 있으면 여기서 어긋난다.
    CORE_TIER_NAMES.forEach((name, i) => {
      expect(ART_ALT[`char.tier${i}.normal` as ArtKey]).toContain(name)
    })
    expect(ART_ALT['cutscene.promote.3']).toContain(CORE_TIER_NAMES[3])
    expect(ART_ALT['cutscene.demote.1']).toContain(CORE_TIER_NAMES[1])
  })
})

describe('아트 레지스트리', () => {
  it('모든 키가 등록되어 있다', () => {
    ALL_ART_KEYS.forEach(k => expect(ART[k], `누락된 아트 키: ${k}`).toBeDefined())
  })
  it('캐릭터 18종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('char.'))).toHaveLength(18)
  })
  it('컷신 10종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('cutscene.'))).toHaveLength(10)
  })
  it('엔딩 8종·조연 8종(4인×2무드)·배경 4종·섹터 8종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('ending.'))).toHaveLength(8)
    expect(ALL_ART_KEYS.filter(k => k.startsWith('npc.'))).toHaveLength(8)
    expect(ALL_ART_KEYS.filter(k => k.startsWith('bg.'))).toHaveLength(4)
    expect(ALL_ART_KEYS.filter(k => k.startsWith('sector.'))).toHaveLength(8)
  })
  it('모든 키가 예외 없이 렌더된다', () => {
    ALL_ART_KEYS.forEach(k => { expect(() => render(<Art id={k} />)).not.toThrow() })
  })
  it('svg 소스는 <svg>를 낸다', () => {
    const { container } = render(<Art id="char.tier0.normal" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
  it('image 소스는 <img>를 낸다 (교체 경로 검증)', () => {
    const original = ART['char.tier0.joy']
    ;(ART as Record<string, unknown>)['char.tier0.joy'] = { kind: 'image', src: '/art/x.webp' }
    const { container } = render(<Art id="char.tier0.joy" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/art/x.webp')
    ;(ART as Record<string, unknown>)['char.tier0.joy'] = original
  })
})

// ArtKey 유니온은 컴파일 타임에만 존재하므로, 실제 방어는 keys.ts의 원본 배열(TIERS,
// MOODS, ... UI_KEYS)로부터 registry.tsx와는 "독립적으로" 기대 키 목록을 다시 만들어
// ART/ALL_ART_KEYS와 양방향(Set 동등성)으로 비교하는 수밖에 없다. 이렇게 하면:
//  - registry.tsx의 루프가 하나라도 빠지면(레지스트리 누락) expectedKeys에는 있고
//    ART/ALL_ART_KEYS에는 없어 실패한다.
//  - registry.tsx에 keys.ts가 모르는 엉뚱한 키가 섞여 들어가면(유니온 누락) 반대로
//    ART/ALL_ART_KEYS에는 있고 expectedKeys에는 없어 실패한다.
describe('ArtKey 유니온 ↔ 레지스트리 양방향 정합성', () => {
  const expectedKeys: string[] = []
  for (const t of TIERS) for (const m of MOODS) expectedKeys.push(`char.tier${t}.${m}`)
  for (const n of NPCS) for (const m of NPC_MOODS) expectedKeys.push(`npc.${n}.${m}`)
  for (const b of BACKGROUNDS) expectedKeys.push(`bg.${b}`)
  for (const t of PROMOTE_TIERS) expectedKeys.push(`cutscene.promote.${t}`)
  for (const t of DEMOTE_TIERS) expectedKeys.push(`cutscene.demote.${t}`)
  for (const id of ENDING_IDS) expectedKeys.push(`ending.${id}`)
  for (const s of SECTORS) expectedKeys.push(`sector.${s}`)
  for (const k of UI_KEYS) expectedKeys.push(k)

  it('기대 키 개수는 68개다', () => {
    expect(expectedKeys).toHaveLength(68)
  })
  it('ART의 키 집합이 기대 키 집합과 정확히 일치한다 (양방향)', () => {
    expect(new Set(Object.keys(ART))).toEqual(new Set(expectedKeys))
  })
  it('ALL_ART_KEYS 집합이 기대 키 집합과 정확히 일치한다 (양방향)', () => {
    expect(new Set(ALL_ART_KEYS)).toEqual(new Set(expectedKeys))
  })
})

// docs/superpowers/specs/2026-08-26-black-bull-vn-redesign.md §5 아트 슬롯 규격 표는
// 사용자가 외부 AI 도구로 실제 이미지를 그려 넣을 "컷" 목록이다(Task 23이 소비한다).
// UI_KEYS(멘탈·현금 등 아이콘 12종)는 그 표에 없는 순수 UI 글리프라 컷이 아니다 — 그래서
// 이 카운트에서는 뺀다. 컷이 하나라도 빠지거나 늘면 Task 23의 프롬프트 문서가 즉시 어긋나야
// 하므로, §5 표의 6행을 그대로 재현해 합계(56)를 고정한다.
describe('스펙 §5 아트 슬롯 규격 — 이미지 생성 대상 "컷" 개수 (UI 아이콘 제외)', () => {
  const cutKeys = ALL_ART_KEYS.filter(k => !(UI_KEYS as readonly string[]).includes(k))
  it('컷 총 개수는 56개다 (18+8+4+10+8+8)', () => {
    expect(cutKeys).toHaveLength(56)
  })
  it('char 18 · npc 8 · bg 4 · cutscene 10 · ending 8 · sector 8', () => {
    expect(cutKeys.filter(k => k.startsWith('char.'))).toHaveLength(18)
    expect(cutKeys.filter(k => k.startsWith('npc.'))).toHaveLength(8)
    expect(cutKeys.filter(k => k.startsWith('bg.'))).toHaveLength(4)
    expect(cutKeys.filter(k => k.startsWith('cutscene.'))).toHaveLength(10)
    expect(cutKeys.filter(k => k.startsWith('ending.'))).toHaveLength(8)
    expect(cutKeys.filter(k => k.startsWith('sector.'))).toHaveLength(8)
  })
})

// 컨트롤러 판정(Ruling 54): packages/core/src/turn/economy.ts:29의 settleTier는
//   const cutscene = next > cur ? `cutscene.promote.${next}` : `cutscene.demote.${next}`
// 를 만든다. settleTier 자체는 @bb/core의 공개 API(index.ts)에 노출되어 있지 않으므로
// (tierOf만 export됨), 여기서는 그 조건식을 독립적으로 재현해 모든 (cur, next) 티어
// 전이 쌍에 대해 만들어질 수 있는 컷신 키가 전부 ART에 존재하는지 고정한다. 티어 수가
// 바뀌면(TIERS 배열 수정) 이 이중 루프도 같이 넓어지므로 새로 생기는 전이의 아트 누락도
// 즉시 잡힌다.
describe('settleTier 컷신 키 정합성 (economy.ts와 동일한 분기)', () => {
  for (const cur of TIERS) {
    for (const next of TIERS) {
      if (next === cur) continue
      const key = (next > cur ? `cutscene.promote.${next}` : `cutscene.demote.${next}`) as ArtKey
      it(`cur=${cur} → next=${next} ⇒ ${key} 가 ART에 존재한다`, () => {
        expect(ART[key], `누락된 컷신 아트: ${key}`).toBeDefined()
      })
    }
  }

  it('도달 불가능한 promote.0 / demote.5는 애초에 키 목록에 없다', () => {
    expect(ALL_ART_KEYS).not.toContain('cutscene.promote.0')
    expect(ALL_ART_KEYS).not.toContain('cutscene.demote.5')
  })
})

// Minor #2: 이미지로 교체됐을 때 <img alt>에 내부 키 문자열이 그대로 노출되면 안 된다.
const HANGUL = /[가-힣]/

describe('ART_ALT — 이미지 교체 시 노출되는 alt는 한국어 설명이다 (Minor #2)', () => {
  it('모든 키에 ART_ALT 항목이 있고, 원본 키 문자열 그대로가 아니다', () => {
    ALL_ART_KEYS.forEach(k => {
      expect(ART_ALT[k], `ART_ALT 누락: ${k}`).toBeDefined()
      expect(ART_ALT[k]).not.toBe(k)
    })
  })
  it('모든 alt 설명에 한글이 포함된다 (내부 영문 키가 그대로 노출되지 않는다)', () => {
    ALL_ART_KEYS.forEach(k => {
      expect(HANGUL.test(ART_ALT[k]!), `한글 설명이 아님: ${k} -> "${ART_ALT[k]}"`).toBe(true)
    })
  })
  it('실제로 image로 교체된 <img>의 alt는 원본 키가 아니라 한국어 설명이다', () => {
    const original = ART['char.tier0.joy']
    ;(ART as Record<string, unknown>)['char.tier0.joy'] = { kind: 'image', src: '/art/x.webp' }
    const { container } = render(<Art id="char.tier0.joy" />)
    const alt = container.querySelector('img')?.getAttribute('alt')
    expect(alt).not.toBe('char.tier0.joy')
    expect(alt && HANGUL.test(alt)).toBe(true)
    ;(ART as Record<string, unknown>)['char.tier0.joy'] = original
  })
})

// docs/superpowers/specs/2026-08-25-black-bull-design.md §2.6 조연 4인의 정본 한국어 이름.
// 이 맵은 registry.tsx의 NPC_NAME_KO와 "독립적으로" 설계 문서 값을 그대로 옮긴 것이다 —
// registry.tsx를 그대로 베껴오면 자기 자신과는 항상 일치해 드리프트를 못 잡기 때문.
// 특히 '최존버'는 게임 내 회복 카드("최존버와 소주")에도 쓰이는 이름이라, 아트 라벨만
// 다른 이름을 쓰면 플레이어가 같은 인물을 두 이름으로 보게 된다.
const CANONICAL_NPC_NAME_KO: Record<string, string> = {
  daebak: '박대박',
  cho: '최존버',
  kim: '김실장',
  mom: '엄마',
}

// Fix Round 1 Major — toContain(부분 문자열)은 '최존버' → '최존버2' 같은 오염을 못 잡는다
// (오염된 값이 정본을 부분 문자열로 포함하기 때문에 여전히 통과한다). ART_ALT는
// `등장인물 <이름> (<무드>)` 형식으로 고정돼 있으므로(registry.tsx) 그 자리에서 이름만
// 정확히 뽑아 정본과 완전히 같은지(toBe) 비교한다.
const ART_ALT_NAME_RE = /^등장인물 (.+) \(/

describe('조연 4인의 한국어 이름은 설계 문서 §2.6 정본과 일치한다', () => {
  NPCS.forEach(n => {
    NPC_MOODS.forEach(m => {
      it(`npc.${n}.${m}의 ART_ALT 이름이 "${CANONICAL_NPC_NAME_KO[n]}"와 정확히 일치한다`, () => {
        const alt = ART_ALT[`npc.${n}.${m}`]
        const match = ART_ALT_NAME_RE.exec(alt)
        expect(match, `ART_ALT 형식이 "등장인물 <이름> (<무드>)"가 아니다: "${alt}"`).not.toBeNull()
        expect(match![1]).toBe(CANONICAL_NPC_NAME_KO[n])
      })
    })
  })
})

// 리뷰 Major B-1 / Minor M-2: <img alt>(ART_ALT, Minor #2)는 이미 한국어였지만, svg
// 컴포넌트 자신이 만드는 aria-label(과 엔딩의 경우 화면에 그려지는 <text>)은 별도
// 경로라 검사되지 않았다 — 엔딩 화면에 "bank"/"legend" 같은 원시 id가, NPC 초상화·UI
// 아이콘의 aria-label에 "kim"/"ui.calendar" 같은 원시 키가 그대로 노출됐다.
// 전체 60개 키를 실제로 렌더해 role="img" 요소의 aria-label에 한글이 없으면 잡는다.
describe('svg 아트의 aria-label에 내부 영문 키/id가 새지 않는다 (리뷰 Major B-1 / M-2)', () => {
  ALL_ART_KEYS.forEach(k => {
    if (ART[k]!.kind !== 'svg') return
    it(`${k}의 aria-label은 한국어다`, () => {
      const { container } = render(<Art id={k} />)
      const label = container.querySelector('[role="img"]')?.getAttribute('aria-label')
      expect(label, `aria-label 누락: ${k}`).toBeTruthy()
      expect(HANGUL.test(label!), `원시 키/id가 새어나감: ${k} -> aria-label="${label}"`).toBe(true)
    })
  })
})

// 엔딩 화면(EndingView)은 aria-label뿐 아니라 이 <text>를 실제 화면에 그린다(makeScene).
// 8개 엔딩 전부 화면에 그려지는 라벨이 한국어 엔딩명인지(원시 id가 아닌지) 고정한다.
describe('엔딩 아트의 화면 라벨은 원시 id가 아니라 한국어 엔딩명이다 (리뷰 Major B-1)', () => {
  ENDING_IDS.forEach(id => {
    it(`ending.${id}의 svg에는 원시 id "${id}" 텍스트가 그려지지 않는다`, () => {
      const key = `ending.${id}` as ArtKey
      const { container } = render(<Art id={key} />)
      const texts = Array.from(container.querySelectorAll('text')).map(t => t.textContent)
      expect(texts, `엔딩 svg에 원시 id가 그대로 그려짐: ${key}`).not.toContain(id)
    })
  })
})

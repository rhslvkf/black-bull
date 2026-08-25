import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ART, ALL_ART_KEYS } from './registry'
import { Art } from './Art'
import {
  TIERS, MOODS, NPCS, SECTORS, ENDING_IDS, UI_KEYS, PROMOTE_TIERS, DEMOTE_TIERS, type ArtKey,
} from './keys'

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
  it('엔딩 8종·조연 4종·섹터 8종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('ending.'))).toHaveLength(8)
    expect(ALL_ART_KEYS.filter(k => k.startsWith('npc.'))).toHaveLength(4)
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
  for (const n of NPCS) expectedKeys.push(`npc.${n}`)
  for (const t of PROMOTE_TIERS) expectedKeys.push(`cutscene.promote.${t}`)
  for (const t of DEMOTE_TIERS) expectedKeys.push(`cutscene.demote.${t}`)
  for (const id of ENDING_IDS) expectedKeys.push(`ending.${id}`)
  for (const s of SECTORS) expectedKeys.push(`sector.${s}`)
  for (const k of UI_KEYS) expectedKeys.push(k)

  it('기대 키 개수는 60개다', () => {
    expect(expectedKeys).toHaveLength(60)
  })
  it('ART의 키 집합이 기대 키 집합과 정확히 일치한다 (양방향)', () => {
    expect(new Set(Object.keys(ART))).toEqual(new Set(expectedKeys))
  })
  it('ALL_ART_KEYS 집합이 기대 키 집합과 정확히 일치한다 (양방향)', () => {
    expect(new Set(ALL_ART_KEYS)).toEqual(new Set(expectedKeys))
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

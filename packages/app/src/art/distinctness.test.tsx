import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Art } from './Art'
import { NPCS, TIERS, BACKGROUNDS, ENDING_IDS, type ArtKey } from './keys'
import { fingerprintOf, signatureOf } from './artFingerprint'

// 리뷰 Fix Round 1 (Major 1~3): 리뷰어가 실측했다 — bg.* 4종을 전부 office 실루엣/
// 그라디언트로 강제해도, ending.* 8종을 전부 legend 톤/글리프로 강제해도, npc.*.alt의
// 링 표시(isAlt)를 항상 false로 고정해도 311/311이 그대로 통과했다. "N종이 서로 다르게
// 보인다"가 어디에도 테스트로 고정돼 있지 않았기 때문이다. 이 파일이 그 구멍을 막는다.
//
// "충분히 다르다"의 기준과 근거는 artFingerprint.ts 상단 주석에 있다 — 요약하면, N개
// 키를 각각 렌더한 지문(색상 집합 + 도형 개수 + 텍스트)이 signatureOf를 거쳐 서로 완전히
// 다른 문자열이어야 한다.
function expectAllDistinct(label: string, keys: readonly ArtKey[], excludeSelector?: string) {
  const sigs = keys.map(k => {
    const { container } = render(<Art id={k} />)
    return signatureOf(fingerprintOf(container, { excludeSelector }))
  })
  const uniq = new Set(sigs)
  expect(uniq.size, `${label}: ${keys.length}개 중 ${uniq.size}개만 서로 다르게 그려짐 (키: ${keys.join(', ')})`)
    .toBe(keys.length)
}

describe('아트 변형 간 시각적 구별 (리뷰 Fix Round 1 Major 1~3)', () => {
  it('배경 4종(bg.office/home/street/exchange)은 서로 다르게 그려진다', () => {
    expectAllDistinct('배경 4종', BACKGROUNDS.map((b): ArtKey => `bg.${b}`))
  })

  it('엔딩 8종은 시각 정체성(색·glyph)만으로도 서로 다르게 그려진다', () => {
    // label(data-role="label", 한국어 엔딩명)은 registry.test.tsx의 ART_ALT 정본 검사가
    // 이미 8개 전부 다름을 고정한다. 여기서 label 텍스트까지 지문에 넣으면, tone/glyph
    // (진짜 시각 정체성)를 전부 legend로 강제해도 label만으로 8개가 갈려 뮤테이션을
    // 놓친다 — 그래서 label을 빼고 tone/glyph만으로 판정한다.
    expectAllDistinct('엔딩 8종', ENDING_IDS.map((id): ArtKey => `ending.${id}`), '[data-role="label"]')
  })

  it('조연 4인 각각 normal과 alt가 서로 다르게 그려진다', () => {
    NPCS.forEach(n => {
      expectAllDistinct(`npc.${n}`, [`npc.${n}.normal`, `npc.${n}.alt`])
    })
  })

  it('캐릭터 무드 3종(normal/shaken/joy)은 티어마다 서로 다르게 그려진다', () => {
    TIERS.forEach(t => {
      expectAllDistinct(`char.tier${t}`, [
        `char.tier${t}.normal`,
        `char.tier${t}.shaken`,
        `char.tier${t}.joy`,
      ])
    })
  })
})

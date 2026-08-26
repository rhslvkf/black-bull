import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArtSlot, registerImage, hasImage, resetImages } from './slots'

// registerImage는 registry.tsx의 공유 ART 레지스트리를 직접 변형한다(전역 상태). 한 테스트가
// 등록한 이미지가 다음 테스트로 새어나가지 않도록, design/testUtils.ts의 matchMediaMock과
// 같은 패턴으로 매 테스트 뒤 자동 정리한다.
afterEach(() => {
  resetImages()
})

describe('ArtSlot', () => {
  it('이미지가 없으면 폴백을 그리되 빈칸이 아니다', () => {
    const { container } = render(<ArtSlot kind="character" id="char.tier0.normal" />)
    const el = container.firstElementChild!
    expect(el.getAttribute('data-fallback')).toBe('true')
    expect(el.querySelectorAll('svg, [class*=silhouette]').length).toBeGreaterThan(0)
  })

  it('이미지가 등록되면 img를 그린다', () => {
    registerImage('char.tier0.normal', '/art/c0.webp')
    const { container } = render(<ArtSlot kind="character" id="char.tier0.normal" />)
    expect(container.querySelector('img')).not.toBeNull()
  })

  it('종횡비가 슬롯 종류로 고정된다', () => {
    const { container } = render(<ArtSlot kind="background" id="bg.office" />)
    expect(getComputedStyle(container.firstElementChild!).aspectRatio).toBe('16 / 9')
  })

  it('alt가 한국어 설명이고 키 문자열이 아니다', () => {
    registerImage('npc.kim.normal', '/art/kim.webp')
    render(<ArtSlot kind="portrait" id="npc.kim.normal" />)
    const alt = screen.getByRole('img').getAttribute('alt')!
    expect(alt).not.toContain('npc.')
    expect(alt).toMatch(/[가-힣]/)
  })
})

// MU5: kind를 무시하고 모든 슬롯이 같은 종횡비를 쓰게 하는 뮤테이션은 브리프의 단일
// background 검사만으로는 잡히지 않는다 — 4종 각각을 독립적으로 고정해야 잡힌다.
describe('ArtSlot — 종류별 종횡비 (MU5)', () => {
  it.each([
    ['character', 'char.tier1.normal', '3 / 4'],
    ['portrait', 'npc.mom.normal', '3 / 4'],
    ['background', 'bg.street', '16 / 9'],
    ['scene', 'cutscene.promote.1', '4 / 3'],
  ] as const)('%s(%s)의 aspect-ratio는 %s다', (kind, id, ratio) => {
    const { container } = render(<ArtSlot kind={kind} id={id} />)
    expect(getComputedStyle(container.firstElementChild!).aspectRatio).toBe(ratio)
  })

  it('character와 background는 서로 다른 종횡비를 쓴다 (kind 무시 뮤테이션 방지)', () => {
    const char = render(<ArtSlot kind="character" id="char.tier0.normal" />)
    const bg = render(<ArtSlot kind="background" id="bg.home" />)
    const charRatio = getComputedStyle(char.container.firstElementChild!).aspectRatio
    const bgRatio = getComputedStyle(bg.container.firstElementChild!).aspectRatio
    expect(charRatio).not.toBe(bgRatio)
  })
})

// MU6: hasImage가 항상 false를 반환하는 뮤테이션은 브리프 테스트만으로는 안 잡힌다(그
// 테스트는 ArtSlot을 거쳐 <img> 존재 여부만 본다) — hasImage 자체를 직접 검사해야 한다.
describe('hasImage (MU6)', () => {
  it('등록 전에는 false다', () => {
    expect(hasImage('char.tier2.joy')).toBe(false)
  })
  it('registerImage 직후에는 true다', () => {
    registerImage('char.tier2.joy', '/art/x.webp')
    expect(hasImage('char.tier2.joy')).toBe(true)
  })
  it('resetImages 뒤에는 다시 false다', () => {
    registerImage('char.tier3.normal', '/art/y.webp')
    resetImages()
    expect(hasImage('char.tier3.normal')).toBe(false)
  })
})

// MU7: resetImages(또는 afterEach 호출)를 빼면 테스트 간 격리가 깨진다는 것을 실제로
// 고정한다. 이 블록은 위 describe들이 이미 등록했던 키(char.tier0.normal 등)를 굳이 다시
// 검사해, "이전 테스트의 registerImage가 여기로 새지 않았다"를 순서에 의존해 확인한다.
describe('테스트 간 아트 등록 격리 (MU7)', () => {
  it('다른 테스트 파일 앞부분에서 registerImage된 키도 여기서는 이미지가 없다', () => {
    // 위 'ArtSlot' describe가 char.tier0.normal / npc.kim.normal을 registerImage했다.
    // afterEach(resetImages)가 실제로 동작한다면 여기서는 반드시 폴백 상태여야 한다.
    expect(hasImage('char.tier0.normal')).toBe(false)
    expect(hasImage('npc.kim.normal')).toBe(false)
    const { container } = render(<ArtSlot kind="character" id="char.tier0.normal" />)
    expect(container.firstElementChild!.getAttribute('data-fallback')).toBe('true')
  })
})

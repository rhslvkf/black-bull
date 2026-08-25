import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { makeCharacter } from './Character'

// Ruling 57: 티어 6종이 "색만 다른 같은 도형"이면 안 된다. fill 속성을 전부 제거한 뒤에도
// 마크업이 서로 달라야 한다 — 그래야 실제로 형태(소품/실루엣)가 다르다는 뜻이다.
function stripFill(html: string) {
  return html.replace(/\sfill="[^"]*"/g, '')
}

describe('캐릭터 티어별 실루엣 (Ruling 57)', () => {
  const tiers = [0, 1, 2, 3, 4, 5]
  const shapesByTier = tiers.map(t => {
    const { container } = render(<>{(() => {
      const C = makeCharacter(t, 'normal')
      return <C />
    })()}</>)
    return stripFill(container.innerHTML)
  })

  it('fill 색상을 제거해도 6개 티어의 마크업이 전부 서로 다르다', () => {
    expect(new Set(shapesByTier).size).toBe(6)
  })

  it('색만 다른 동일 도형이 아니다 (fill 제거 후에도 티어0과 티어5는 다르다)', () => {
    expect(shapesByTier[0]).not.toBe(shapesByTier[5]!)
  })

  it('mood(normal/shaken/joy) 분기는 그대로 유지된다', () => {
    const Normal = makeCharacter(0, 'normal')
    const Shaken = makeCharacter(0, 'shaken')
    const Joy = makeCharacter(0, 'joy')
    const n = render(<Normal />).container.innerHTML
    const s = render(<Shaken />).container.innerHTML
    const j = render(<Joy />).container.innerHTML
    expect(new Set([n, s, j]).size).toBe(3)
  })
})

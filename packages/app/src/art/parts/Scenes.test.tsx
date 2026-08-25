import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { makeScene } from './Scenes'

// Minor #1: 같은 아트 키가 한 화면(같은 DOM)에 두 번 렌더돼도 <linearGradient id>가
// 충돌하면 안 된다 — Task 23 도감처럼 목록+상세를 동시에 띄우는 화면에서 실제로 발생한다.
describe('Scene 그라디언트 id 충돌 방지 (Minor #1)', () => {
  it('같은 라벨을 가진 Scene을 한 컨테이너에 두 번 렌더해도 gradient id가 중복되지 않는다', () => {
    const Scene = makeScene('#6e2b2b', '💀', 'legend')
    const { container } = render(
      <div>
        <Scene />
        <Scene />
      </div>,
    )
    const ids = Array.from(container.querySelectorAll('linearGradient')).map(el => el.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
})

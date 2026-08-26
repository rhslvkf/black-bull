import { describe, it, expect } from 'vitest'
import { isNpcName } from './EventModal'
import { NPCS } from '../art/keys'

// 리뷰 Fix Round 1 (Minor 3): isNpcName을 항상 true로 바꿔도 앱 테스트 전체가 안 잡는다는
// 지적 — 콘텐츠의 speaker는 core의 content.test.ts가 이미 알려진 4인으로만 제한해 실질
// 위험은 낮지만, 가드를 넣은 이유 자체(잘못된 이름을 걸러낸다)가 사라지면 안 되므로
// 가드 로직 자체를 직접 고정한다.
describe('isNpcName (리뷰 Fix Round 1 Minor 3)', () => {
  it('NPCS에 있는 이름은 전부 true다', () => {
    NPCS.forEach(n => expect(isNpcName(n), n).toBe(true))
  })
  it('알려지지 않은 이름은 false다', () => {
    expect(isNpcName('unknown')).toBe(false)
    expect(isNpcName('')).toBe(false)
    expect(isNpcName('daebak2')).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { GRADES, gradeMul, gradeAp, rollGrade, cardStat } from './grade'
import { createRng, type RngState } from '../rng/rng'

describe('등급 상수', () => {
  it('E부터 S까지 여섯 단계다', () => {
    expect(GRADES).toEqual(['E', 'D', 'C', 'B', 'A', 'S'])
  })
  it('등급이 오르면 배율이 단조 증가한다', () => {
    const muls = GRADES.map(gradeMul)
    for (let i = 1; i < muls.length; i++) expect(muls[i]!).toBeGreaterThan(muls[i - 1]!)
  })
  it('등급이 오르면 행동력 소모가 줄지 않는다', () => {
    const aps = GRADES.map(gradeAp)
    for (let i = 1; i < aps.length; i++) expect(aps[i]!).toBeGreaterThanOrEqual(aps[i - 1]!)
  })
  it('가장 낮은 등급도 행동력 1 이상을 쓴다', () => {
    expect(gradeAp('E')).toBeGreaterThanOrEqual(1)
  })
})

describe('rollGrade', () => {
  it('같은 rng·같은 스탯이면 같은 등급 (결정론)', () => {
    expect(rollGrade(createRng(7), 3)[0]).toBe(rollGrade(createRng(7), 3)[0])
  })
  it('rng를 소비해 새 상태를 돌려준다', () => {
    const rng = createRng(7)
    const [, next] = rollGrade(rng, 0)
    expect(next.s).not.toBe(rng.s)
  })
  it('같은 시드로 2000연속 굴린 등급 시퀀스가 완전히 동일하다 (156턴 재현성)', () => {
    const rollMany = (seed: number, statValue: number): string[] => {
      let rng: RngState = createRng(seed)
      const out: string[] = []
      for (let i = 0; i < 2000; i++) {
        const [g, next] = rollGrade(rng, statValue)
        out.push(g)
        rng = next
      }
      return out
    }
    expect(rollMany(42, 4)).toEqual(rollMany(42, 4))
  })
  it('스탯 0에서는 상위 등급이 드물다', () => {
    let rng = createRng(1); const counts: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) { const [g, n] = rollGrade(rng, 0); rng = n; counts[g] = (counts[g] ?? 0) + 1 }
    expect((counts['S'] ?? 0) / 2000).toBeLessThan(0.03)
    expect((counts['E'] ?? 0) + (counts['D'] ?? 0)).toBeGreaterThan(1000)
  })
  it('스탯이 높으면 상위 등급 비율이 실제로 올라간다', () => {
    const share = (stat: number) => {
      let rng = createRng(1); let high = 0
      for (let i = 0; i < 2000; i++) { const [g, n] = rollGrade(rng, stat); rng = n; if (g === 'A' || g === 'S') high++ }
      return high / 2000
    }
    expect(share(8)).toBeGreaterThan(share(0) * 3)
  })
  it('스탯이 다르면 낮은 등급(E/D) 비율이 실제로 줄어든다', () => {
    const lowShare = (stat: number) => {
      let rng = createRng(1); let low = 0
      for (let i = 0; i < 2000; i++) { const [g, n] = rollGrade(rng, stat); rng = n; if (g === 'E' || g === 'D') low++ }
      return low / 2000
    }
    expect(lowShare(8)).toBeLessThan(lowShare(0) * 0.7)
  })
})

describe('cardStat', () => {
  it('카드마다 대응 스탯이 정해져 있다', () => {
    expect(cardStat('analyze')).toBe('analysis')
    expect(cardStat('report')).toBe('analysis')
    expect(cardStat('news')).toBe('info')
    expect(cardStat('community')).toBe('info')
    expect(cardStat('study')).toBe('grit')
    expect(cardStat('forum')).toBe('network')
    expect(cardStat('overtime')).toBe('stamina')
  })
  it('회복 카드는 체력에 걸린다', () => {
    for (const id of ['rest', 'exercise', 'drink', 'hodl']) expect(cardStat(id)).toBe('stamina')
  })
  it('모르는 카드는 null이다', () => {
    expect(cardStat('nope')).toBeNull()
  })
})

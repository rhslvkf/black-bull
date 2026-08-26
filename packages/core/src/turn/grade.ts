import type { CardGrade, Stats } from '../types'
import { BALANCE } from '../balance'
import { type RngState, rngNext } from '../rng/rng'

export const GRADES = ['E', 'D', 'C', 'B', 'A', 'S'] as const satisfies readonly CardGrade[]

export const gradeMul = (g: CardGrade): number => BALANCE.grade.mul[g]
export const gradeAp = (g: CardGrade): number => BALANCE.grade.ap[g]

const CARD_STAT: Record<string, keyof Stats> = {
  analyze: 'analysis', report: 'analysis',
  news: 'info', community: 'info',
  study: 'grit', forum: 'network', overtime: 'stamina',
  rest: 'stamina', exercise: 'stamina', drink: 'stamina', hodl: 'stamina',
}

/** 카드가 어느 스탯에 걸리는가. 모르는 카드면 null. */
export function cardStat(cardId: string): keyof Stats | null {
  return CARD_STAT[cardId] ?? null
}

/** 등급을 굴린다. 스탯이 높을수록 상위 등급 가중치가 지수적으로 커진다. */
export function rollGrade(rng: RngState, statValue: number): [CardGrade, RngState] {
  const w = GRADES.map((g, i) =>
    BALANCE.grade.baseWeights[g] * Math.exp(BALANCE.grade.statShift * statValue * (i / (GRADES.length - 1))))
  const total = w.reduce((a, b) => a + b, 0)
  const [r, next] = rngNext(rng)
  let acc = 0
  for (let i = 0; i < GRADES.length; i++) {
    acc += w[i]!
    if (r * total < acc) return [GRADES[i]!, next]
  }
  return [GRADES[GRADES.length - 1]!, next]
}

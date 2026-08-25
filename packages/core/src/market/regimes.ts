import { Rand, type RngState } from '../rng/rng'
import { BALANCE } from '../balance'
import type { Regime } from '../types'

const NEXT: Record<Regime, [Regime, number][]> = {
  boom:       [['overheat', 5], ['stagnation', 2], ['crash', 1]],
  overheat:   [['crash', 6], ['stagnation', 3], ['boom', 1]],
  crash:      [['stagnation', 5], ['recovery', 5]],
  stagnation: [['recovery', 5], ['boom', 2], ['crash', 2]],
  recovery:   [['boom', 6], ['stagnation', 3], ['crash', 1]],
}
const STARTS: Regime[] = ['boom', 'stagnation', 'recovery', 'overheat']

export function generateRegimes(rng: RngState, totalTurns = BALANCE.totalTurns): [Regime[], RngState] {
  const rand = new Rand(rng)
  for (let attempt = 0; attempt < 50; attempt++) {
    const out: Regime[] = []
    let cur: Regime = STARTS[rand.int(0, STARTS.length - 1)]!
    while (out.length < totalTurns) {
      const len = Math.min(rand.int(8, 30), totalTurns - out.length)
      for (let i = 0; i < len; i++) out.push(cur)
      cur = rand.pickWeighted(NEXT[cur], p => p[1])[0]
    }
    if (out.includes('crash')) return [out, rand.state]
  }
  // 폴백: 마지막 구간을 crash로 덮어 제약을 보장
  const out: Regime[] = Array(totalTurns).fill('stagnation')
  for (let i = totalTurns - 10; i < totalTurns; i++) out[i] = 'crash'
  return [out, rand.state]
}

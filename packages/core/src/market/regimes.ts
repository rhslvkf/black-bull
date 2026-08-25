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

const FALLBACK_CYCLE: Regime[] = ['stagnation', 'recovery', 'boom', 'overheat']

/** 재시도가 모두 crash 없이 끝났을 때 쓰는 결정론적 시퀀스.
 *  8~30 구간 규칙을 지키고, 첫 구간은 crash가 아니며, 마지막 구간을 crash로 둔다. */
export function fallbackRegimes(totalTurns: number): Regime[] {
  const out: Regime[] = []
  const push = (r: Regime, n: number) => { for (let i = 0; i < n; i++) out.push(r) }

  let ci = 0
  while (totalTurns - out.length > 30) {
    push(FALLBACK_CYCLE[ci++ % FALLBACK_CYCLE.length]!, Math.min(30, totalTurns - out.length - 8))
  }
  if (out.length === 0) push(FALLBACK_CYCLE[0]!, totalTurns - 8)
  push('crash', totalTurns - out.length)
  return out
}

export function generateRegimes(rng: RngState, totalTurns?: number): [Regime[], RngState] {
  const turns = totalTurns ?? BALANCE.totalTurns
  if (turns < 16) throw new Error('generateRegimes: totalTurns must be at least 16')

  const rand = new Rand(rng)
  for (let attempt = 0; attempt < 50; attempt++) {
    const out: Regime[] = []
    let cur: Regime = STARTS[rand.int(0, STARTS.length - 1)]!
    while (out.length < turns) {
      const len = Math.min(rand.int(8, 30), turns - out.length)
      for (let i = 0; i < len; i++) out.push(cur)
      cur = rand.pickWeighted(NEXT[cur], p => p[1])[0]
    }
    if (out.includes('crash')) return [out, rand.state]
  }
  return [fallbackRegimes(turns), rand.state]
}

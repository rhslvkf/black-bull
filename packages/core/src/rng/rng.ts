export interface RngState { s: number }

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 }
}

export function rngNext(st: RngState): [number, RngState] {
  const s = (st.s + 0x6d2b79f5) >>> 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, { s }]
}

export class Rand {
  constructor(public state: RngState) {}
  next(): number { const [v, s] = rngNext(this.state); this.state = s; return v }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)) }
  normal(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-12)
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  chance(p: number): boolean { return this.next() < p }
  pickWeighted<T>(items: T[], weight: (t: T) => number): T {
    const total = items.reduce((a, t) => a + weight(t), 0)
    let roll = this.next() * total
    for (const t of items) { roll -= weight(t); if (roll < 0) return t }
    return items[items.length - 1]!
  }
}

import { runBatch } from './runner'
import type { Strategy } from './strategies'

const STRATEGIES = ['cash', 'seedhold', 'buyhold', 'momentum', 'random', 'panic'] as const satisfies readonly Strategy[]

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

function parseStrategy(raw: string): Strategy {
  const found = STRATEGIES.find(s => s === raw)
  if (!found) {
    throw new Error(`알 수 없는 전략: ${raw} (가능한 값: ${STRATEGIES.join(', ')})`)
  }
  return found
}

function parseRuns(raw: string): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`--runs는 양의 정수여야 합니다: '${raw}'`)
  }
  return n
}

const runs = parseRuns(arg('runs', '1000'))
const strategy = parseStrategy(arg('strategy', 'buyhold'))
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

const r = runBatch(runs, strategy)
console.log(`\n전략 ${r.strategy} / ${r.runs}판`)
console.log(`  파산율        ${(r.bankruptRate * 100).toFixed(1)}%`)
console.log(`  자산 중앙값   ${won(r.assetsMedian)}`)
console.log(`  P10 / P90     ${won(r.assetsP10)} / ${won(r.assetsP90)}`)
console.log(`  평균 흔들림   ${r.avgShakenTurns.toFixed(1)}턴`)
console.log(`  흔들림 겪은 판 ${(r.shakenRate * 100).toFixed(1)}%`)
console.log('  엔딩 분포')
Object.entries(r.endingCounts).sort((a, b) => b[1] - a[1])
  .forEach(([id, n]) => console.log(`    ${id.padEnd(12)} ${n} (${((n / r.runs) * 100).toFixed(1)}%)`))

// 종목별 최종가 배율 — 특정 종목이 시드와 무관하게 확정 전멸하는지는 자산 분위수로는 안 보인다.
console.log('  종목별 최종가 배율 (중앙값 / 초기가 이상으로 끝난 비율)')
Object.entries(r.priceMulMedian).sort((a, b) => b[1] - a[1]).forEach(([id, m]) =>
  console.log(`    ${id.padEnd(5)} x${m.toFixed(2).padStart(6)}   ${((r.priceUpRate[id] ?? 0) * 100).toFixed(0).padStart(3)}%`))

console.log('  칭호 부여율')
Object.entries(r.titleRate).sort((a, b) => b[1] - a[1]).forEach(([t, p]) =>
  console.log(`    ${t.padEnd(14)} ${(p * 100).toFixed(1)}%`))

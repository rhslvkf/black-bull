import { BALANCE } from '@bb/core'
import { runBatch } from './runner'
import type { Strategy } from './strategies'

const STRATEGIES = ['cash', 'labor', 'seedhold', 'buyhold', 'momentum', 'random', 'panic', 'leverage'] as const satisfies readonly Strategy[]

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
// 흔들림에 들어간 판 중 못 빠져나온 비율 — 회복 슬롯이 일하고 있는지를 보는 자다.
console.log(`  멘탈 교착률   ${(r.stuckInShakenRate * 100).toFixed(1)}% (흔들림 겪은 판 기준)`)
console.log(`  턴당 행동력   ${r.avgApSpent.toFixed(2)} / 기본 ${BALANCE.action.base}`)
console.log(`  턴당 리롤     ${r.rerollUse.toFixed(2)} / 기본 ${BALANCE.reroll.base}`)
// 신용이 이 판에서 실제로 어떻게 쓰였는지를 리포트 표면에 남긴다. `leverage` 말고는
// 아무도 `takeLoan`을 부르지 않으므로 나머지 일곱은 신용·강제청산·파산이 전부 0이고,
// 그 0이 "존버가 안전해서"가 아니라 "빚을 지지 않아서"임이 이 줄에서 보인다.
console.log(`  최고자산      중앙 ${won(r.peakAssetsMedian)} / 최대 ${won(r.peakAssetsMax)}`)
console.log(`  대출 문턱(${won(BALANCE.tierMins[BALANCE.loan.minTier] ?? 0)}) 도달 ${(r.loanReachRate * 100).toFixed(1)}%  ·  신용 사용 ${(r.marginRate * 100).toFixed(1)}%`)
console.log(`  빚 최고잔액   중앙 ${won(r.peakLoanMedian)} / 최대 ${won(r.peakLoanMax)}  ·  강제청산 ${(r.marginCallRate * 100).toFixed(1)}%`)
console.log(`  판당 주문 수  ${r.avgTrades.toFixed(1)}`)
console.log(`  슬롯 등급(E=0..S=5)  초반 ${r.avgGradeIdxEarly.toFixed(2)} → 후반 ${r.avgGradeIdxLate.toFixed(2)} (Δ${(r.avgGradeIdxLate - r.avgGradeIdxEarly).toFixed(2)})`)
console.log('  엔딩 분포')
Object.entries(r.endingCounts).sort((a, b) => b[1] - a[1])
  .forEach(([id, n]) => console.log(`    ${id.padEnd(12)} ${n} (${((n / r.runs) * 100).toFixed(1)}%)`))

// 종목별 최종가 배율 — 특정 종목이 시드와 무관하게 확정 전멸하는지는 자산 분위수로는 안 보인다.
console.log('  종목별 최종가 배율 (중앙값 / 초기가 이상으로 끝난 비율)')
Object.entries(r.priceMulMedian).sort((a, b) => b[1] - a[1]).forEach(([id, m]) =>
  console.log(`    ${id.padEnd(5)} x${m.toFixed(2).padStart(6)}   ${((r.priceUpRate[id] ?? 0) * 100).toFixed(0).padStart(3)}%`))

console.log('  캐릭터 표정 (턴 점유율 / 한 번이라도 본 판)')
// `as` 없이 Mood 키를 도는 방법 — 리터럴 배열을 돌면 인덱싱이 그대로 타입 안전하다.
for (const m of ['normal', 'shaken', 'joy'] as const) {
  console.log(`    ${m.padEnd(7)} ${(r.moodShare[m] * 100).toFixed(1).padStart(5)}%   ${(r.moodReach[m] * 100).toFixed(0).padStart(3)}%`)
}

// 전략별 카드 선택이 실제로 다른지는 이 분포로만 보인다 — 전부 같은 카드를 고르면
// 전략 게이트가 전략 차이를 재지 못한다.
console.log('  카드 사용 점유율')
Object.entries(r.cardUse).sort((a, b) => b[1] - a[1]).forEach(([id, p]) =>
  console.log(`    ${id.padEnd(10)} ${(p * 100).toFixed(1).padStart(5)}%`))

console.log('  칭호 부여율')
Object.entries(r.titleRate).sort((a, b) => b[1] - a[1]).forEach(([t, p]) =>
  console.log(`    ${t.padEnd(14)} ${(p * 100).toFixed(1)}%`))

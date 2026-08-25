import type { Regime } from './types'

export const BALANCE = {
  totalTurns: 156,
  seedMoney: 3_000_000,
  payPeriod: 4,                     // 4턴 = 1개월
  employedNet: 730_000,             // 재직 시 월 가처분 입금
  unemployedOut: 1_720_000,         // 퇴사 시 월 생활비 출금
  feeRate: 0.00015,
  taxRate: 0.0018,
  meanRev: 0.02,
  /** 적정가(fundamental)의 턴당 성장률. 기업 실적이 자라는 몫이고, 국면 드리프트와 달리
   *  평균회귀가 되돌리지 못한다 — 장기 보유가 보상받는 유일한 원천이다. 0이면 주가는
   *  고정된 적정가 주위를 맴돌 뿐이라 바이앤홀드의 기대수익이 0이 된다(Task 24 진단). */
  fundamentalGrowth: 0.0022,
  minPrice: 50,
  historyLen: 60,
  regime: {
    boom:       { drift: 0.006,  vol: 1.0 },
    overheat:   { drift: 0.012,  vol: 1.4 },
    crash:      { drift: -0.022, vol: 2.5 },
    stagnation: { drift: -0.002, vol: 0.8 },
    recovery:   { drift: 0.008,  vol: 1.2 },
  },
  /** 국면 전이 가중치. 합이 클 필요는 없고 상대 비율만 의미가 있다.
   *  아래 satisfies가 국면 이름 오타를 컴파일 타임에 잡는다(regimes.ts의 캐스트 제거). */
  regimeNext: {
    boom:       [['overheat', 5], ['stagnation', 3], ['crash', 1]],
    overheat:   [['crash', 5], ['stagnation', 4], ['boom', 1]],
    crash:      [['stagnation', 3], ['recovery', 7]],
    stagnation: [['recovery', 6], ['boom', 3], ['crash', 1]],
    recovery:   [['boom', 7], ['stagnation', 3]],
  } satisfies Record<Regime, [Regime, number][]>,
  /** 이벤트 충격 전역 배율. 이벤트 임팩트는 주가를 움직이는 항 중 가장 큰 채널인데
   *  (턴당 |합| 기준으로 국면 드리프트의 몇 배다) 여기 손잡이가 없어 튜닝 대상에서
   *  빠져 있었다 — Fix Round 1. 채널의 '방향 편향'은 이벤트 데이터를 양방향으로
   *  짝지어 없앴고(content.test.ts가 고정한다), 여기서는 '세기'만 조절한다. */
  impact: { mul: 0.85 },
  mental: {
    lossHold: -3, lossHoldUnemployed: -6, worsenFactor: 0.8,
    margin: -8,
    // 현금이 많으면 마음이 편하다. 다만 이 값이 lossHold를 이기면 손실 중에도 멘탈이
    // 올라 흔들림이 영영 발동하지 않는다 — 월급이 매달 들어와 현금비중이 늘 높기
    // 때문에 실제로 그렇게 돼 있었다(Fix Round 1). 문턱을 올리고 회복량을 낮췄다.
    cashCalm: 2, calmCashRatio: 0.7,
    shakenMax: 29, resistPer: 0.06,
    sellBlockLossPct: 20,
  },
  condition: {
    drainEmployed: -4, drainUnemployed: -2, resistPer: 0.06,
    forcedSkipBelow: 20, forcedSkipChance: 0.4, forcedSkipPenalty: -5,
    burnoutTurns: 3, burnoutRecover: 30, burnoutMental: 10,
  },
  loan: { minTier: 3, rate: 0.0025, maxRatio: 0.9, callRatio: 1.3 },
  whale: { minTier: 5, notionalDiv: 2e10, maxImpact: 0.03 },
  tierMins: [0, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 3_000_000_000],
  rival: { start: 35_000_000, driftMul: 1.8 },
  /** 엔딩 자산 경계.
   *  기준선은 '시드머니'가 아니라 **아무것도 안 했을 때의 최종 자산**이다:
   *  시드 300만 + 가처분 73만 × 39개월 ≈ 3,150만 (실측 무매매 중앙값 약 2,900만).
   *  경계를 시드 300만에 걸어두면 3년치 월급까지 통째로 날려야 '적금이나 들걸'이 뜨므로
   *  savings/breakeven이 사실상 도달 불가능해진다(Task 24 진단 — 엔딩이 2종으로 붕괴).
   *  아래 두 값은 무매매 기준선에 맞춰 재설정했고, wise/super는 티어 문턱
   *  (슬기로운개미 1억 / 슈퍼개미 5억)과 일치시켰다. */
  endings: {
    savingsBelow: 25_000_000,    // 미만 -> savings (무매매보다 확실히 못함)
    breakevenHigh: 34_000_000,   // savingsBelow 이상 이 값 이하 -> breakeven (무매매와 비슷)
    wiseMin: 100_000_000,        // 이상 -> wise
    superMin: 500_000_000,       // 이상 -> super
    fireMin: 1_000_000_000,      // 이상 + 퇴사 -> fire
  },
  /** 칭호 판정 문턱. endings.ts에 리터럴로 박혀 있던 값들을 옮겼다 —
   *  실측 결과 7종 중 3종이 94~100% 무조건 부여돼 수집 축이 상수가 돼 있었다(Fix Round 1). */
  titles: {
    momIgnoredMin: 6,     // 엄마 전화·방문을 이 횟수 이상 무시해야 '엄마 몰래'
    hodlerTurns: 52,      // 한 종목 연속 보유 턴 (1년)
    allInCashRatio: 0.05, // 평균 현금비중이 이 값 미만이면 '풀매수'
  },
  maxEventsPerTurn: 2,
} as const

export const TIER_NAMES = ['주린이', '개미', '불개미', '슬기로운 개미', '슈퍼개미', '큰손'] as const

export const BALANCE = {
  totalTurns: 156,
  seedMoney: 3_000_000,
  payPeriod: 4,                     // 4턴 = 1개월
  employedNet: 730_000,             // 재직 시 월 가처분 입금
  unemployedOut: 1_720_000,         // 퇴사 시 월 생활비 출금
  feeRate: 0.00015,
  taxRate: 0.0018,
  meanRev: 0.02,
  minPrice: 50,
  historyLen: 60,
  regime: {
    boom:       { drift: 0.004,  vol: 1.0 },
    overheat:   { drift: 0.012,  vol: 1.4 },
    crash:      { drift: -0.035, vol: 2.5 },
    stagnation: { drift: -0.003, vol: 0.8 },
    recovery:   { drift: 0.008,  vol: 1.2 },
  },
  mental: {
    lossHold: -3, lossHoldUnemployed: -6, worsenFactor: 0.5,
    margin: -8, cashCalm: 5, shakenMax: 29, resistPer: 0.06,
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
  endings: {
    savingsBelow: 2_700_000, breakevenHigh: 3_300_000,
    bankHigh: 6_000_000, wiseHigh: 500_000_000, fireMin: 1_000_000_000,
  },
  maxEventsPerTurn: 2,
} as const

export const TIER_NAMES = ['주린이', '개미', '불개미', '슬기로운 개미', '슈퍼개미', '큰손'] as const

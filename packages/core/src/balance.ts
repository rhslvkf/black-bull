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
  /** 국면 한 구간의 길이(턴). 스펙 §2.3이 명시한 값인데 regimes.ts에 리터럴로 박혀
   *  있었다(최종 리뷰 M3). */
  regimeLen: { min: 8, max: 30 },
  /** 이벤트 충격 전역 배율. 이벤트 임팩트는 주가를 움직이는 항 중 가장 큰 채널인데
   *  (턴당 |합| 기준으로 국면 드리프트의 몇 배다) 여기 손잡이가 없어 튜닝 대상에서
   *  빠져 있었다 — Fix Round 1. 채널의 '방향 편향'은 이벤트 데이터를 양방향으로
   *  짝지어 없앴고(content.test.ts가 고정한다), 여기서는 '세기'만 조절한다. */
  impact: { mul: 0.85 },
  /** 지수 ETF가 **시장 충격**을 받는 배수. 개별 종목·섹터 뉴스는 받지 않는다.
   *  이름과 코드를 맞추기 위한 값이다 — 레버리지는 2배로, 곱버스는 반대로 2배.
   *  (이전에는 배수가 둘 다 ±1이라 '레버리지'가 뉴스에는 레버리지가 아니었다.) */
  etfShockMul: { lev: 2, inv: -2 },
  /** 분석력 스탯이 화면에서 체감되는 전부 — 적정가 밴드의 폭, 리스크 등급, 신뢰도.
   *  전부 analysis.ts에 리터럴로 박혀 있어 `pnpm sim`으로 손댈 수 없었다(최종 리뷰 M3).
   *  추정 오차 sigma = sigmaBase × (1 − 분석력/10) + sigmaFloor. */
  analysis: {
    sigmaBase: 0.45,          // 분석력 0일 때의 추정 오차(로그정규 sigma)
    sigmaFloor: 0.05,         // 분석력 10에서도 남는 오차 — 0으로 두면 만렙이 정답을 본다
    bandMul: 0.8,             // 밴드 반폭 = sigma × 이 값
    bandMin: 0.03,            // 밴드 반폭 하한
    volWeight: 20,            // 리스크 점수의 변동성 항 가중
    overWeight: 2,            // 리스크 점수의 고평가 항 가중
    riskVeryHigh: 2.2, riskHigh: 1.2, riskMid: 0.5,   // 리스크 등급 경계
    confBase: 0.15, confPerAnalysis: 0.085,           // 표시 신뢰도
  },
  /** 정보력 스탯의 효용 전부: 루머가 몇 턴 앞서 보이는지(lead)와 그 확률(chance).
   *  info가 큰 구간부터 첫 매칭을 쓰고, 어디에도 안 걸리면 lead 0(=루머 없음)이다.
   *  events/engine.ts에 리터럴로 박혀 있었다(최종 리뷰 M3). */
  infoTiers: [
    { minInfo: 9, lead: 3, chance: 0.9 },
    { minInfo: 6, lead: 2, chance: 0.7 },
    { minInfo: 3, lead: 1, chance: 0.5 },
  ],
  /** 물타기 카드가 한 번에 쓰는 현금 비율. turn/effects.ts에 박혀 있었다(최종 리뷰 M3). */
  averageDownPct: 0.2,
  mental: {
    lossHold: -3, lossHoldUnemployed: -6, worsenFactor: 0.8,
    margin: -8,
    // 현금이 많으면 마음이 편하다. 다만 이 값이 lossHold를 이기면 손실 중에도 멘탈이
    // 올라 흔들림이 영영 발동하지 않는다 — 월급이 매달 들어와 현금비중이 늘 높기
    // 때문에 실제로 그렇게 돼 있었다(Fix Round 1). 문턱을 올리고 회복량을 낮췄다.
    cashCalm: 2, calmCashRatio: 0.7,
    // 손실 멘탈 피해는 **노출도**(보유평가액 / 총자산)에 비례한다. portfolioLossPct가
    // 보유 원가 대비라서, 이 가중이 없으면 7만원짜리 1주와 몰빵의 피해가 같아진다
    // (재리뷰 N1 실측: 1주 33% vs 시드 90% 37%). 이 게임이 가르치려는 건
    // "주식을 갖고 있느냐"가 아니라 "얼마나 위험하게 굴렸느냐"다.
    // lossExposureFull: 이 노출도에서 피해가 100%가 된다(그 이상은 상한).
    //
    // 이 값은 **그 턴의 순간 노출도**에 걸린다 — '156턴 평균 노출' 같은 기간 평균이
    // 아니다(Fix Round 2 보고서의 서술이 이 점에서 틀렸다). 현금의 30% 이상을 넣는
    // 순간 이미 포화이므로, 매수 직후부터 피해는 최대치로 물린다.
    //
    // **월급 구조에 의존한다.** employedNet(월 73만) × totalTurns(156턴/39개월)의
    // 입금이 매달 현금을 불려 분모(총자산)를 키우기 때문에, 같은 포지션이라도 후반으로
    // 갈수록 노출도가 내려간다. 즉 0.30은 "이 입금 속도" 위에서 고른 값이다 —
    // employedNet·payPeriod·totalTurns를 바꾸면 이 값을 다시 재야 한다
    // (sim의 '멘탈 피해가 노출도를 따라간다' 게이트로 확인한다).
    lossExposureFull: 0.30,
    shakenMax: 29, resistPer: 0.06,
    sellBlockLossPct: 20,
  },
  /** 홈 화면 캐릭터 표정(char.tier{n}.{normal|shaken|joy})의 구간.
   *  흔들림이면 shaken, 그게 아니면서 멘탈이 joyMental 이상이고 **투자 수익률**이
   *  joyRoiPct 이상이면 joy, 나머지는 normal이다. 이전에는 '시드머니 대비 총자산'
   *  ROI만 봤기 때문에 월급 입금만으로 턴 4에 임계를 넘어 normal 6종이 사실상
   *  화면에 뜨지 않았다(최종 리뷰 C1 부작용). */
  mood: { joyMental: 70, joyRoiPct: 5 },
  condition: {
    drainEmployed: -4, drainUnemployed: -2, resistPer: 0.06,
    forcedSkipBelow: 20, forcedSkipChance: 0.4, forcedSkipPenalty: -5,
    burnoutTurns: 3, burnoutRecover: 30, burnoutMental: 10,
  },
  loan: { minTier: 3, rate: 0.0025, maxRatio: 0.9, callRatio: 1.3 },
  whale: { minTier: 5, notionalDiv: 2e10, maxImpact: 0.03 },
  tierMins: [0, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 3_000_000_000],
  /** 티어 강등 히스테리시스 — 현재 티어 문턱의 이 비율 아래로 내려가야 강등된다.
   *  문턱 근처에서 승급·강등 컷신이 매 턴 번갈아 뜨는 것을 막는다(최종 리뷰 M3). */
  tierDemoteRatio: 0.9,
  rival: { start: 35_000_000, driftMul: 1.8 },
  /** 엔딩 자산 경계.
   *  기준선은 '시드머니'가 아니라 **거의 아무것도 안 했을 때의 최종 자산**이다
   *  (`cash` 전략은 완전한 무매매가 아니다 — 물타기 카드·buyStockPct 이벤트가 강제하는
   *   매수로 평균 5%의 잔여 노출이 남는다, Ruling 72):
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

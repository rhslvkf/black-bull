import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import type { GameState } from '../types'
import { maxLoan, takeLoan, repayLoan, accrueInterest, checkMarginCall, marginShortfall } from './margin'
import { buy } from './trade'
import { fee, tax } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const tiered = () => { const s = makeState(); s.player.tier = 3; return s }
/** 유예가 이미 끝난 상태 — 지난주에 경고가 서서 **이번 주가 판정 주간**이다.
 *  청산 산술을 보는 아래 테스트들은 경고가 서는 과정 자체에는 관심이 없으므로 여기서
 *  건너뛴다. 경고가 서는 주에 청산이 **일어나지 않는다**는 것은 '마진콜 한 주 유예'
 *  describe가 따로 고정한다. */
const dueNow = (s: GameState): GameState =>
  ({ ...s, player: { ...s.player, marginCallDueTurn: s.turn } })

describe('margin', () => {
  it('정수가 아닌 금액은 거부된다', () => {
    expect(() => takeLoan(tiered(), 1_000_000.5)).toThrow(/BAD_AMOUNT/)
    expect(() => repayLoan(takeLoan(tiered(), 1_000_000), 500_000.5)).toThrow(/BAD_AMOUNT/)
  })
  it('티어 미달이면 대출 불가', () => {
    expect(maxLoan(makeState())).toBe(0)
    expect(() => takeLoan(makeState(), 1_000_000)).toThrow(GameError)
  })
  it('대출은 현금과 loan을 동시에 늘린다', () => {
    const s = takeLoan(tiered(), 1_000_000)
    expect(s.player.cash).toBe(BALANCE.seedMoney + 1_000_000)
    expect(s.player.loan).toBe(1_000_000)
    expect(s.trackers.usedMargin).toBe(true)
  })
  it('한도 초과는 거부된다', () => {
    const s = tiered()
    expect(() => takeLoan(s, maxLoan(s) + 1)).toThrow(/LOAN_LIMIT/)
  })
  it('상환은 현금과 loan을 줄인다', () => {
    const s = repayLoan(takeLoan(tiered(), 1_000_000), 400_000)
    expect(s.player.loan).toBe(600_000)
    expect(s.player.cash).toBe(BALANCE.seedMoney + 600_000)
  })
  it('보유액 초과 상환은 거부된다', () => {
    expect(() => repayLoan(takeLoan(tiered(), 1_000_000), 2_000_000)).toThrow(/BAD_AMOUNT/)
  })
  it('이자가 loan에 붙는다', () => {
    const s = accrueInterest(takeLoan(tiered(), 1_000_000))
    expect(s.player.loan).toBe(1_000_000 + Math.round(1_000_000 * BALANCE.loan.rate))
  })
  it('대출 없으면 이자도 없다', () => {
    expect(accrueInterest(makeState()).player.loan).toBe(0)
  })
  it('담보 붕괴 시 전량 청산되고 flag가 선다', () => {
    let s = tiered()
    s = takeLoan(s, 2_000_000)
    s = buy(s, 's1', 400)
    s.stocks[0]!.price = 500
    const after = checkMarginCall(dueNow(s))
    expect(after.player.holdings).toHaveLength(0)
    expect(after.flags['marginCalled']).toBe(true)
    // liquidation: gross=200k, fee=30 (PPM arithmetic), tax=360, proceeds=199,610, cash=1,199,010
    // repaid=min(1,199,010, 2M)=1,199,010, final loan=2M-1,199,010=800,990
    expect(after.player.cash).toBe(0)
    expect(after.player.loan).toBe(800_990)
  })
  it('건전하면 청산하지 않는다', () => {
    const s = buy(takeLoan(tiered(), 500_000), 's1', 10)
    expect(checkMarginCall(s).player.holdings).toHaveLength(1)
  })
  it('담보 붕괴 시 손실 매도를 lossCuts에 반영한다', () => {
    let s = tiered()
    s = takeLoan(s, 2_000_000)
    s = buy(s, 's1', 400)
    s.stocks[0]!.price = 500
    const before = s.trackers.lossCuts
    const after = checkMarginCall(dueNow(s))
    expect(after.trackers.lossCuts).toBe(before + 1)
  })
  // 최종 리뷰 m3 — 강제청산은 수수료·거래세를 실제로 떼면서(proceeds 계산이 그 증거)
  // 그 금액을 트래커에 적지 않았다. 잔고증명서(§5)가 보여주는 '수수료·세금' 합계가
  // 강제청산분만큼 조용히 모자랐다는 뜻이다.
  describe('강제청산의 수수료·세금이 트래커에 잡힌다 (최종 리뷰 m3)', () => {
    /** 담보가 무너져 실제로 반대매매가 일어나는 상태. 위 '담보 붕괴 시 전량 청산' 케이스와
     *  같은 수치(gross 200,000 → fee 30 · tax 360)를 그대로 쓴다. */
    function collapsed() {
      let s = tiered()
      s = takeLoan(s, 2_000_000)
      s = buy(s, 's1', 400)
      s.stocks[0]!.price = 500
      return dueNow(s)   // 유예는 지난주에 이미 썼다 — 이 describe는 청산 산술만 본다
    }

    it('전제 확인: 이 상태에서 실제로 강제청산이 일어난다', () => {
      const s = collapsed()
      const after = checkMarginCall(s)
      expect(after.flags['marginCalled']).toBe(true)
      expect(s.player.holdings.length).toBeGreaterThan(0)   // 팔 것이 있었다
      expect(after.player.holdings).toHaveLength(0)
    })

    it('feesPaid·taxPaid가 실제로 커진다 (트래커 값이 변한다)', () => {
      const s = collapsed()
      const after = checkMarginCall(s)
      expect(after.trackers.feesPaid).toBeGreaterThan(s.trackers.feesPaid)
      expect(after.trackers.taxPaid).toBeGreaterThan(s.trackers.taxPaid)
    })

    it('커진 폭이 청산 대금에서 실제로 뗀 금액과 정확히 같다', () => {
      const s = collapsed()
      // 기댓값을 margin.ts에서 베끼지 않고, 청산 대상 보유분에서 직접 계산한다.
      const gross = s.player.holdings.reduce(
        (a, h) => a + h.qty * s.stocks.find(x => x.id === h.stockId)!.price, 0)
      expect(gross).toBe(200_000)          // 위 '전량 청산' 케이스와 같은 수치임을 못박는다
      const after = checkMarginCall(s)
      expect(after.trackers.feesPaid - s.trackers.feesPaid).toBe(fee(gross))   // 30
      expect(after.trackers.taxPaid - s.trackers.taxPaid).toBe(tax(gross))     // 360
    })

    it('청산 대금(현금·대출 잔액)과 트래커가 같은 금액을 가리킨다', () => {
      // 트래커에 적힌 수수료·세금만큼이 실제로 대금에서 빠져 있어야 한다 —
      // 트래커에 아무 숫자나 더하는 구현과 구별하는 지점이다.
      const s = collapsed()
      const gross = s.player.holdings.reduce(
        (a, h) => a + h.qty * s.stocks.find(x => x.id === h.stockId)!.price, 0)
      const after = checkMarginCall(s)
      const feeDelta = after.trackers.feesPaid - s.trackers.feesPaid
      const taxDelta = after.trackers.taxPaid - s.trackers.taxPaid
      const proceeds = gross - feeDelta - taxDelta
      // 상환 후 남은 현금 + 갚은 금액 = 청산 전 현금 + 실수령 대금
      const repaid = s.player.loan - after.player.loan
      expect(after.player.cash + repaid).toBe(s.player.cash + proceeds)
    })

    it('청산이 일어나지 않으면 트래커도 그대로다 (무조건 더하는 구현과 구별)', () => {
      // 판정 주간(dueNow)인데도 담보가 건전하니 청산되지 않는다 — '유예가 끝나면 무조건
      // 판다'는 구현과 구별되는 지점이기도 하다.
      const s = dueNow(buy(takeLoan(tiered(), 500_000), 's1', 10))
      const after = checkMarginCall(s)
      expect(after.player.holdings).toHaveLength(1)   // 청산 안 됨
      expect(after.trackers.feesPaid).toBe(s.trackers.feesPaid)
      expect(after.trackers.taxPaid).toBe(s.trackers.taxPaid)
    })
  })

  it('현금 부족 상환은 거부된다', () => {
    let s = takeLoan(tiered(), 2_700_000)
    s = buy(s, 's1', 500)
    // after buy: cash ≈ 699,250, loan = 2,700,000
    expect(s.player.cash).toBeLessThan(1_000_000)
    expect(s.player.loan).toBeGreaterThan(1_000_000)
    // repay 1M: ≤ loan (2.7M) but > cash (699k) → should throw
    expect(() => repayLoan(s, 1_000_000)).toThrow(/BAD_AMOUNT/)
  })
})

/**
 * 마진콜 한 주 유예 — 담보가 무너진 그 주에는 경고(`player.marginCallDueTurn`)만 서고,
 * **다음 주**에도 못 채웠을 때 비로소 전량 청산된다. 사용자 결정: "경고를 한 주 주고,
 * 회복 못 하면 그때 청산한다."
 *
 * 이 describe의 각 테스트는 대응 뮤테이션(유예 제거·+1을 +0/+2로·>= 를 >로·경고 해제
 * 누락·회복해도 청산)을 실제로 넣어 red를 확인한 뒤 원복했다.
 */
describe('마진콜 한 주 유예', () => {
  /** 담보가 무너진 계좌. 대출 200만, 보유 s1 400주가 10,000 → 500으로 무너져
   *  담보(현금 999,400 + 평가 200,000 = 1,199,400)가 요구치 260만에 크게 못 미친다.
   *  경고는 아직 서 있지 않다(marginCallDueTurn === null). */
  function collapsedAt(turn: number): GameState {
    let s = makeState({ turn, player: { tier: 3 } })
    s = takeLoan(s, 2_000_000)
    s = buy(s, 's1', 400)
    s.stocks[0]!.price = 500
    return s
  }
  /** 지난주에 경고가 서서 `due`주에 판정하기로 된 상태. */
  const warned = (s: GameState, due: number): GameState =>
    ({ ...s, player: { ...s.player, marginCallDueTurn: due } })

  it('전제 확인: 이 계좌의 담보는 실제로 요구치에 못 미친다', () => {
    const s = collapsedAt(7)
    expect(s.player.marginCallDueTurn).toBeNull()
    expect(s.player.holdings).toHaveLength(1)
    expect(s.player.cash + 400 * 500).toBeLessThan(s.player.loan * BALANCE.loan.callRatio)
  })

  it('담보가 무너진 그 주에는 청산하지 않고 다음 주로 경고만 세운다', () => {
    const s = collapsedAt(7)
    const after = checkMarginCall(s)
    expect(after.player.marginCallDueTurn).toBe(8)          // '이번 턴 + 1'이다
    expect(after.player.holdings).toHaveLength(1)           // 한 주도 팔리지 않았다
    expect(after.player.cash).toBe(s.player.cash)
    expect(after.player.loan).toBe(s.player.loan)
    expect(after.flags['marginCalled']).toBeUndefined()     // 청산은 일어나지 않았다
    expect(after.trackers).toEqual(s.trackers)              // lossCuts·수수료도 그대로다
  })

  it('경고가 선 주에는(아직 판정 주간이 아니면) 담보가 그대로여도 아무 일도 없다', () => {
    const s = warned(collapsedAt(7), 8)
    const after = checkMarginCall(s)
    expect(after.player.holdings).toHaveLength(1)
    expect(after.player.marginCallDueTurn).toBe(8)          // 예고 주가 밀리지 않는다
    expect(after.flags['marginCalled']).toBeUndefined()
    expect(after).toEqual(s)
  })

  it('판정 주간이 오고도 담보를 못 채웠으면 전량 청산되고 경고가 내려간다', () => {
    const s = warned(collapsedAt(8), 8)
    const after = checkMarginCall(s)
    expect(after.player.holdings).toHaveLength(0)
    expect(after.flags['marginCalled']).toBe(true)
    expect(after.player.marginCallDueTurn).toBeNull()       // 집행된 예고는 남지 않는다
  })

  it('판정 주간까지 담보를 채우면 청산되지 않고 경고만 내려간다', () => {
    const s = warned(collapsedAt(8), 8)
    s.stocks[0]!.price = 5_000    // 담보 999,400 + 2,000,000 = 2,999,400 ≥ 요구치 2,600,000
    const after = checkMarginCall(s)
    expect(after.player.holdings).toHaveLength(1)           // 팔리지 않았다
    expect(after.player.cash).toBe(s.player.cash)
    expect(after.player.loan).toBe(s.player.loan)
    expect(after.player.marginCallDueTurn).toBeNull()       // 경고가 내려갔다
    expect(after.flags['marginCalled']).toBeUndefined()
  })

  it('빚을 다 갚으면 서 있던 경고가 내려간다', () => {
    // 판정 주간이 왔든(8) 아직 안 왔든(9) 빚이 0이면 위험도 없다.
    for (const due of [8, 9]) {
      const s = makeState({ turn: 8, player: { tier: 3, loan: 0, cash: 0, marginCallDueTurn: due } })
      expect(checkMarginCall(s).player.marginCallDueTurn).toBeNull()
    }
  })

  // ── 경계: 담보 = 대출 × callRatio 는 '회복'이다(>= 이지 > 가 아니다) ──────────────
  // 1_000_000 × 1.3 은 부동소수 오차 없이 정확히 1_300_000이다(별도 단언으로 못박는다).
  const atCollateral = (cash: number, over: Partial<{ turn: number; due: number | null }> = {}) =>
    makeState({
      turn: over.turn ?? 8,
      player: { tier: 3, loan: 1_000_000, cash, holdings: [], marginCallDueTurn: over.due ?? null },
    })

  it('전제 확인: 요구 담보는 정확히 1,300,000원이다 (부동소수 오차 없음)', () => {
    expect(1_000_000 * BALANCE.loan.callRatio).toBe(1_300_000)
  })

  it('담보가 요구치와 정확히 같으면 경고조차 서지 않는다 (경계)', () => {
    const after = checkMarginCall(atCollateral(1_300_000, { turn: 7 }))
    expect(after.player.marginCallDueTurn).toBeNull()
    expect(after.player.cash).toBe(1_300_000)
  })

  it('담보가 요구치와 정확히 같으면 판정 주간이 와도 청산하지 않는다 (경계)', () => {
    const after = checkMarginCall(atCollateral(1_300_000, { due: 8 }))
    expect(after.player.cash).toBe(1_300_000)      // 현금이 상환에 쓰이지 않았다
    expect(after.player.loan).toBe(1_000_000)
    expect(after.player.marginCallDueTurn).toBeNull()
    expect(after.flags['marginCalled']).toBeUndefined()
  })

  it('1원 모자라면 판정 주간에 청산된다 (경계 반대쪽)', () => {
    const after = checkMarginCall(atCollateral(1_299_999, { due: 8 }))
    expect(after.flags['marginCalled']).toBe(true)
    expect(after.player.cash).toBe(299_999)        // 100만을 갚고 남은 돈
    expect(after.player.loan).toBe(0)
  })

  it('1원 모자라면 경고가 선다 (경계 반대쪽 — 경고 단계)', () => {
    const after = checkMarginCall(atCollateral(1_299_999, { turn: 7 }))
    expect(after.player.marginCallDueTurn).toBe(8)
    expect(after.player.cash).toBe(1_299_999)      // 아직 청산은 아니다
  })

  it('세 갈래 어느 쪽도 rng를 소비하지 않는다 (결정론)', () => {
    const warn = collapsedAt(7)
    const liquidate = warned(collapsedAt(8), 8)
    const repaid = makeState({ turn: 8, player: { loan: 0, marginCallDueTurn: 8 } })
    for (const s of [warn, liquidate, repaid]) {
      expect(checkMarginCall(s).rng).toEqual(s.rng)
    }
    // 실제로 서로 다른 갈래를 탔는지 확인한다 — 셋 다 no-op이면 위 단언은 공회전이다.
    expect(checkMarginCall(warn).player.marginCallDueTurn).toBe(8)
    expect(checkMarginCall(liquidate).flags['marginCalled']).toBe(true)
    expect(checkMarginCall(repaid).player.marginCallDueTurn).toBeNull()
  })

  // ── 화면이 읽는 값 ────────────────────────────────────────────────────────────
  describe('marginShortfall — 계좌 화면 배너가 그리는 부족액', () => {
    it('빚이 없으면 0이다', () => {
      expect(marginShortfall(makeState())).toBe(0)
    })
    it('담보가 넉넉하면 0이다', () => {
      expect(marginShortfall(atCollateral(2_000_000))).toBe(0)
    })
    it('요구치와 같아도 0이다 (경계)', () => {
      expect(marginShortfall(atCollateral(1_300_000))).toBe(0)
    })
    it('모자란 만큼을 원 단위로 돌려준다', () => {
      expect(marginShortfall(atCollateral(1_299_999))).toBe(1)
      expect(marginShortfall(atCollateral(1_000_000))).toBe(300_000)
    })
    it('보유 평가액도 담보로 친다', () => {
      // 담보 999,400 + 400주 × 500 = 1,199,400, 요구치 2,600,000 → 1,400,600 모자란다
      expect(marginShortfall(collapsedAt(7))).toBe(1_400_600)
    })
  })
})

describe('fee/tax arithmetic (PPM-based, no floating-point drift)', () => {
  it('fee는 정확한 정수 계산을 따른다', () => {
    expect(fee(200_000)).toBe(30)
    expect(fee(100_000)).toBe(15)
    expect(fee(50)).toBe(1)  // minimum charge
    expect(fee(0)).toBe(0)
  })
  it('tax는 정확한 정수 계산을 따른다', () => {
    expect(tax(200_000)).toBe(360)
    expect(tax(100_000)).toBe(180)
    expect(tax(50)).toBe(1)  // minimum charge
    expect(tax(0)).toBe(0)
  })
})

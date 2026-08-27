import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { maxLoan, takeLoan, repayLoan, accrueInterest, checkMarginCall } from './margin'
import { buy } from './trade'
import { fee, tax } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const tiered = () => { const s = makeState(); s.player.tier = 3; return s }

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
    const after = checkMarginCall(s)
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
    const after = checkMarginCall(s)
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
      return s
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
      const s = buy(takeLoan(tiered(), 500_000), 's1', 10)
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

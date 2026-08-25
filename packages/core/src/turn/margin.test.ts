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

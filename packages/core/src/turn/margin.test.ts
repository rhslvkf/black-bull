import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { maxLoan, takeLoan, repayLoan, accrueInterest, checkMarginCall } from './margin'
import { buy } from './trade'
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
    // liquidation: gross=200k, fee=30, tax=360, proceeds=199,610, cash=1,199,010
    // repaid=min(1,199,010, 2M)=1,199,010
    expect(after.player.cash).toBe(0)
    expect(after.player.loan).toBe(800_989)
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
    let s = takeLoan(tiered(), 1_000_000)
    s = buy(s, 's1', 100)
    // cash는 약 2M 미만, loan은 1M, repay 500k 요청은 loan보다 작지만 cash를 초과할 수 있음
    expect(() => repayLoan(s, s.player.cash + 1)).toThrow(/BAD_AMOUNT/)
  })
})

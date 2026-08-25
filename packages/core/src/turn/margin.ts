import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { holdingValue, totalAssets, priceOf } from './accounting'

export function maxLoan(state: GameState): number {
  if (state.player.tier < BALANCE.loan.minTier) return 0
  return Math.max(0, Math.floor(totalAssets(state) * BALANCE.loan.maxRatio) - state.player.loan)
}

export function takeLoan(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) throw new GameError('BAD_AMOUNT')
  if (state.player.tier < BALANCE.loan.minTier) throw new GameError('TIER_LOCKED')
  if (amount > maxLoan(state)) throw new GameError('LOAN_LIMIT')
  return {
    ...state,
    player: { ...state.player, cash: state.player.cash + amount, loan: state.player.loan + amount },
    trackers: { ...state.trackers, usedMargin: true },
  }
}

export function repayLoan(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) throw new GameError('BAD_AMOUNT')
  if (amount > state.player.loan || amount > state.player.cash) throw new GameError('BAD_AMOUNT')
  return { ...state, player: { ...state.player, cash: state.player.cash - amount, loan: state.player.loan - amount } }
}

export function accrueInterest(state: GameState): GameState {
  if (state.player.loan <= 0) return state
  const interest = Math.round(state.player.loan * BALANCE.loan.rate)
  return { ...state, player: { ...state.player, loan: state.player.loan + interest } }
}

/** 담보(현금+평가액)가 대출의 callRatio 배 아래로 내려가면 전량 강제청산 후 상환. */
export function checkMarginCall(state: GameState): GameState {
  const { loan } = state.player
  if (loan <= 0) return state
  const collateral = state.player.cash + holdingValue(state)
  if (collateral >= loan * BALANCE.loan.callRatio) return state

  let proceeds = 0
  for (const h of state.player.holdings) {
    const gross = h.qty * priceOf(state, h.stockId)
    const feeAmt = gross > 0 ? Math.max(1, Math.floor(gross * BALANCE.feeRate)) : 0
    const taxAmt = gross > 0 ? Math.max(1, Math.floor(gross * BALANCE.taxRate)) : 0
    proceeds += gross - feeAmt - taxAmt
  }
  const cash = state.player.cash + proceeds
  const repaid = Math.min(cash, loan)
  return {
    ...state,
    player: { ...state.player, holdings: [], cash: cash - repaid, loan: loan - repaid },
    flags: { ...state.flags, marginCalled: true },
  }
}

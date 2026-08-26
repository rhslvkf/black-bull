import type { GameState, Holding } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { priceOf, positionLossPct, fee, tax } from './accounting'
import { applyWhaleImpact } from '../market/price'
import { isShaken } from '../mental/mental'

export function canBuy(state: GameState, stockId: string): { ok: boolean; reason?: string } {
  if (state.status !== 'playing') return { ok: false, reason: 'NOT_PLAYING' }
  const def = state.stockDefs.find(d => d.id === stockId)
  if (!def) return { ok: false, reason: 'NO_STOCK' }
  if (state.player.tier < def.tierGate) return { ok: false, reason: 'TIER_LOCKED' }
  return { ok: true }
}

export function canSell(state: GameState, stockId: string): { ok: boolean; reason?: string } {
  if (state.status !== 'playing') return { ok: false, reason: 'NOT_PLAYING' }
  if (!state.player.holdings.some(h => h.stockId === stockId)) return { ok: false, reason: 'NO_QTY' }
  // 흔들림 판정은 core에 하나뿐이어야 한다(최종 리뷰 Minor 2 — 여기가 재구현이었다).
  if (isShaken(state) && positionLossPct(state, stockId) >= BALANCE.mental.sellBlockLossPct) {
    return { ok: false, reason: 'SELL_BLOCKED' }
  }
  return { ok: true }
}

export function maxBuyQty(state: GameState, stockId: string): number {
  const p = priceOf(state, stockId)
  const cash = state.player.cash
  const cost = (q: number) => p * q + fee(p * q)
  let q = Math.max(0, Math.floor(cash / (p * (1 + BALANCE.feeRate))))
  while (cost(q + 1) <= cash) q++
  while (q > 0 && cost(q) > cash) q--
  return q
}

export function buy(state: GameState, stockId: string, qty: number): GameState {
  if (!Number.isInteger(qty) || qty <= 0) throw new GameError('BAD_QTY')
  const chk = canBuy(state, stockId)
  if (!chk.ok) throw new GameError(chk.reason!)

  const price = priceOf(state, stockId)
  const gross = price * qty
  const feeAmt = fee(gross)
  const total = gross + feeAmt
  if (total > state.player.cash) throw new GameError('NO_CASH')

  const prev = state.player.holdings.find(h => h.stockId === stockId)
  const holdings: Holding[] = prev
    ? state.player.holdings.map(h => h.stockId !== stockId ? h : {
        ...h, qty: h.qty + qty,
        avgCost: Math.round((h.qty * h.avgCost + gross) / (h.qty + qty)),
      })
    : [...state.player.holdings, { stockId, qty, avgCost: price, heldTurns: 0 }]

  let stocks = state.stocks
  if (state.player.tier >= BALANCE.whale.minTier) {
    const np = applyWhaleImpact(price, gross, 'buy')
    stocks = stocks.map(s => s.id === stockId ? { ...s, price: np } : s)
  }
  return {
    ...state, stocks,
    player: { ...state.player, cash: state.player.cash - total, holdings },
    trackers: {
      ...state.trackers,
      feesPaid: state.trackers.feesPaid + feeAmt,
      tradeCount: state.trackers.tradeCount + 1,
    },
  }
}

/** 물타기 — 이미 보유 중이고 손실 중인 종목을 예산 범위에서 추가 매수한다.
 *  1차에서는 카드 효과였으나(가장 많이 물린 종목을 자동 선택), 순수한 매매 행위이므로
 *  주간 행동을 소모하지 않는 종목 상세 화면의 버튼으로 옮겼다. */
export function canAverageDown(state: GameState, stockId: string): { ok: boolean; reason?: string } {
  const h = state.player.holdings.find(x => x.stockId === stockId)
  if (!h) return { ok: false, reason: '보유하지 않은 종목이다' }
  if (priceOf(state, stockId) >= h.avgCost) return { ok: false, reason: '평단보다 싸야 물탈 수 있다' }
  if (maxBuyQty(state, stockId) < 1) return { ok: false, reason: '현금이 부족하다' }
  return { ok: true }
}

export function averageDown(state: GameState, stockId: string, budget: number): GameState {
  if (!canAverageDown(state, stockId).ok) return state
  const capped = Math.min(budget, state.player.cash)
  const qty = maxBuyQty({ ...state, player: { ...state.player, cash: capped } }, stockId)
  if (qty < 1) return state
  return buy(state, stockId, qty)
}

export function sell(state: GameState, stockId: string, qty: number): GameState {
  if (!Number.isInteger(qty) || qty <= 0) throw new GameError('BAD_QTY')
  const chk = canSell(state, stockId)
  if (!chk.ok) throw new GameError(chk.reason!)
  const held = state.player.holdings.find(h => h.stockId === stockId)
  if (!held || held.qty < qty) throw new GameError('NO_QTY')

  const price = priceOf(state, stockId)
  const gross = price * qty
  const feeAmt = fee(gross)
  const taxAmt = tax(gross)
  const net = gross - feeAmt - taxAmt
  const isLossCut = price < held.avgCost

  const holdings = held.qty === qty
    ? state.player.holdings.filter(h => h.stockId !== stockId)
    : state.player.holdings.map(h => h.stockId === stockId ? { ...h, qty: h.qty - qty } : h)

  let stocks = state.stocks
  if (state.player.tier >= BALANCE.whale.minTier) {
    const np = applyWhaleImpact(price, gross, 'sell')
    stocks = stocks.map(s => s.id === stockId ? { ...s, price: np } : s)
  }
  return {
    ...state, stocks,
    player: { ...state.player, cash: state.player.cash + net, holdings },
    trackers: {
      ...state.trackers,
      lossCuts: state.trackers.lossCuts + (isLossCut ? 1 : 0),
      feesPaid: state.trackers.feesPaid + feeAmt,
      taxPaid: state.trackers.taxPaid + taxAmt,
      tradeCount: state.trackers.tradeCount + 1,
    },
  }
}

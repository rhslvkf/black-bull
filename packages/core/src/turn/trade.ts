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
  // Task 15 Fix Round 2 #2(리뷰) — canBuy/canSell은 둘 다 맨 먼저 status를 본다.
  // canAverageDown만 이 검사가 없어서, 게임이 끝난 상태(status !== 'playing')에서
  // guard()를 거치지 않고 averageDown을 직접 부르면(app이 아닌 다른 호출자, 또는
  // 앞으로 guard 없이 부르는 경로가 늘어나면) GameError(NOT_PLAYING)가 그대로
  // 던져진다 — buy/sell과 비대칭이었다. canBuy/canSell의 순서를 그대로 따른다.
  if (state.status !== 'playing') return { ok: false, reason: '게임이 끝났다' }
  const h = state.player.holdings.find(x => x.stockId === stockId)
  if (!h) return { ok: false, reason: '보유하지 않은 종목이다' }
  if (priceOf(state, stockId) >= h.avgCost) return { ok: false, reason: '평단보다 싸야 물탈 수 있다' }
  if (maxBuyQty(state, stockId) < 1) return { ok: false, reason: '현금이 부족하다' }
  return { ok: true }
}

/**
 * **계약: 이 함수는 던지지 않는다.** 조건이 안 맞으면 상태를 그대로 돌려준다 —
 * `buy`/`sell`과 달리 호출부가 `guard()`(GameError를 삼키는 통로) 없이 부른다
 * (app store.ts의 `doAverageDown`). 그래서 여기서 새는 예외는 그대로 런타임 크래시다.
 *
 * 최종 리뷰 m1 — 그 계약이 깨져 있었다. `budget`이 `NaN`이면
 * `Math.min(NaN, cash) === NaN` → `maxBuyQty`가 `NaN`을 돌려주고 → `NaN < 1`이
 * **false**라 조기 반환을 그냥 통과해 → `buy(state, id, NaN)`이 `BAD_QTY`를 던졌다.
 * `NaN`과의 비교는 전부 false이므로 부등식 가드는 원리적으로 `NaN`을 막지 못한다.
 * 그래서 두 겹으로 막는다: 입력(`budget`)의 유한성과, 출력(`qty`)의 정수성 —
 * 후자는 `state.player.cash` 자체가 오염된 경우까지 함께 접는다.
 */
export function averageDown(state: GameState, stockId: string, budget: number): GameState {
  if (!canAverageDown(state, stockId).ok) return state
  if (!Number.isFinite(budget)) return state
  const capped = Math.min(budget, state.player.cash)
  const qty = maxBuyQty({ ...state, player: { ...state.player, cash: capped } }, stockId)
  if (!Number.isInteger(qty) || qty < 1) return state
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

import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const FEE_PPM = Math.round(BALANCE.feeRate * 1_000_000)
const TAX_PPM = Math.round(BALANCE.taxRate * 1_000_000)

export const fee = (gross: number) => (gross > 0 ? Math.max(1, Math.floor((gross * FEE_PPM) / 1_000_000)) : 0)
export const tax = (gross: number) => (gross > 0 ? Math.max(1, Math.floor((gross * TAX_PPM) / 1_000_000)) : 0)

export function priceOf(state: GameState, stockId: string): number {
  const s = state.stocks.find(x => x.id === stockId)
  if (!s) throw new GameError('NO_STOCK')
  return s.price
}
export function holdingValue(state: GameState): number {
  return state.player.holdings.reduce((a, h) => a + h.qty * priceOf(state, h.stockId), 0)
}
export function totalAssets(state: GameState): number {
  return state.player.cash + holdingValue(state) - state.player.loan
}
/**
 * 무매매 기준선 — "주식을 한 주도 사지 않았다면 지금 자산이 얼마였을까".
 *
 * 시드머니에 그동안 실제로 정산된 순월급(`trackers.netPayroll`)을 더한 값이다.
 * 시드머니 단독을 기준선으로 쓰면 3년간 누적되는 가처분소득 약 2,850만원이 통째로
 * '투자 수익'으로 계상돼, 주식을 한 주도 안 산 판이 +1,000%를 넘긴다(최종 리뷰 C1).
 * 엔딩 경계(BALANCE.endings)도 같은 기준선에 정박해 있으므로, 화면과 엔딩이 같은
 * 잣대를 쓰게 된다.
 */
export function noTradeBaseline(state: GameState): number {
  return BALANCE.seedMoney + state.trackers.netPayroll
}

/**
 * 투자 수익률(%). 총자산이 무매매 기준선보다 얼마나 위/아래인가.
 * 기준선이 0 이하가 되는 경우(퇴사 후 생활비가 시드를 다 갉아먹은 극단)에는
 * 비율이 의미를 잃으므로 0을 돌려준다.
 */
export function investmentRoi(state: GameState): number {
  const base = noTradeBaseline(state)
  if (base <= 0) return 0
  return ((totalAssets(state) - base) / base) * 100
}

export function cashRatio(state: GameState): number {
  const t = totalAssets(state)
  return t <= 0 ? 0 : Math.min(1, state.player.cash / t)
}
export function portfolioLossPct(state: GameState): number {
  const cost = state.player.holdings.reduce((a, h) => a + h.qty * h.avgCost, 0)
  if (cost <= 0) return 0
  const val = holdingValue(state)
  return val >= cost ? 0 : ((cost - val) / cost) * 100
}
export function positionLossPct(state: GameState, stockId: string): number {
  const h = state.player.holdings.find(x => x.stockId === stockId)
  if (!h || h.avgCost <= 0) return 0
  const p = priceOf(state, stockId)
  return p >= h.avgCost ? 0 : ((h.avgCost - p) / h.avgCost) * 100
}

import raw from '../../data/stocks.json'
import type { Sector, StockDef, StockState, Tier } from '../types'

/** Sector 유니온의 런타임 대응물. satisfies가 유니온 누락·오타를 컴파일 타임에 잡는다. */
export const SECTORS = [
  '반도체', '2차전지', '바이오', '조선', '게임', '금융', '엔터', '방산',
] as const satisfies readonly Sector[]

export const TIER_GATES = [0, 1, 2, 3, 4, 5] as const satisfies readonly Tier[]

export function loadStockDefs(): StockDef[] {
  return (raw as StockDef[]).map(d => ({ ...d }))
}

export function initStockStates(defs: StockDef[]): StockState[] {
  return defs.map(d => ({ id: d.id, price: d.initialPrice, fundamental: d.fundamental, history: [d.initialPrice] }))
}

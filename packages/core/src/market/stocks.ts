import raw from '../../data/stocks.json'
import type { StockDef, StockState } from '../types'

export function loadStockDefs(): StockDef[] {
  return (raw as StockDef[]).map(d => ({ ...d }))
}

export function initStockStates(defs: StockDef[]): StockState[] {
  return defs.map(d => ({ id: d.id, price: d.initialPrice, fundamental: d.fundamental, history: [d.initialPrice] }))
}

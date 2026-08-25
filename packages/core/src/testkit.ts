import type { GameState, StockDef, StockState, Regime } from './types'
import { BALANCE } from './balance'

export function makeStockDef(over: Partial<StockDef> & { id: string }): StockDef {
  return { name: over.id, sector: '금융', tierGate: 0, initialPrice: 10000,
    fundamental: 10000, volatility: 0, beta: 0, hype: 0, ...over }
}
export function makeStock(over: Partial<StockState> & { id: string }): StockState {
  return { price: 10000, fundamental: 10000, history: [10000], ...over }
}
export function makeState(over: Partial<GameState> = {}): GameState {
  return {
    turn: 1, seed0: 1, rng: { s: 1 },
    regimes: Array.from({ length: BALANCE.totalTurns }, (): Regime => 'stagnation'),
    stockDefs: [makeStockDef({ id: 's1' }), makeStockDef({ id: 's2' })],
    stocks: [makeStock({ id: 's1' }), makeStock({ id: 's2' })],
    player: {
      cash: BALANCE.seedMoney, loan: 0, holdings: [],
      mental: 80, condition: 80, burnoutTurns: 0,
      stats: { grit: 1, stamina: 1, info: 0, analysis: 0, network: 1 },
      employed: true, tier: 0,
    },
    pendingImpacts: [], news: [], firedOneShots: [], flags: {},
    pendingChoices: [], rivalAssets: BALANCE.rival.start,
    trackers: { shakenTurns: 0, usedMargin: false, lossCuts: 0,
      maxHeldTurns: 0, cashRatioSum: 0, turnsCounted: 0, netPayroll: 0 },
    prevLossPct: 0, cutscene: null, lastTurnSkip: null, status: 'playing', ending: null,
    ...over,
  }
}

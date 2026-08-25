import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { createRng, Rand } from '../rng/rng'

export interface StockAnalysis {
  fairLow: number; fairHigh: number
  risk: '낮음' | '보통' | '높음' | '매우 높음'
  confidence: number
}

function hashSeed(seed0: number, stockId: string): number {
  let h = (seed0 ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < stockId.length; i++) h = (Math.imul(h ^ stockId.charCodeAt(i), 0x01000193)) >>> 0
  return (Math.imul(h, 0x85ebca6b)) >>> 0
}

export function analyzeStock(state: GameState, stockId: string): StockAnalysis {
  const stock = state.stocks.find(s => s.id === stockId)
  const def = state.stockDefs.find(d => d.id === stockId)
  if (!stock || !def) throw new GameError('NO_STOCK')

  const A = BALANCE.analysis
  const a = state.player.stats.analysis
  const sigma = A.sigmaBase * (1 - a / 10) + A.sigmaFloor
  const rand = new Rand(createRng(hashSeed(state.seed0, stockId)))
  const z = rand.normal(0, 1)
  const est = Math.max(1, stock.fundamental * Math.exp(z * sigma))

  const half = Math.max(A.bandMin, sigma * A.bandMul)
  const fairLow = Math.max(1, Math.round(est * (1 - half)))
  const fairHigh = Math.round(est * (1 + half))

  const over = stock.price / est
  const volScore = def.volatility * A.volWeight
  const score = (over - 1) * A.overWeight + volScore
  const risk: StockAnalysis['risk'] =
    score > A.riskVeryHigh ? '매우 높음' : score > A.riskHigh ? '높음' : score > A.riskMid ? '보통' : '낮음'

  return { fairLow, fairHigh, risk, confidence: Math.min(1, A.confBase + a * A.confPerAnalysis) }
}

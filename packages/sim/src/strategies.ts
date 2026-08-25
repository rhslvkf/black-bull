import {
  type GameState, buy, sell, canSell, canBuy, maxBuyQty, totalAssets,
  loadCards, isCardAvailable, Rand, createRng, priceOf,
} from '@bb/core'

export type Strategy = 'buyhold' | 'panic' | 'momentum' | 'random' | 'cash'

const tradable = (s: GameState) => s.stockDefs.filter(d => canBuy(s, d.id).ok)

function trendOf(s: GameState, id: string): number {
  const h = s.stocks.find(x => x.id === id)!.history
  if (h.length < 4) return 0
  return h[h.length - 1]! / h[h.length - 4]! - 1
}

function sellAll(s: GameState): GameState {
  for (const h of [...s.player.holdings]) {
    if (canSell(s, h.stockId).ok) { try { s = sell(s, h.stockId, h.qty) } catch { /* 봉인 */ } }
  }
  return s
}

function investPct(s: GameState, id: string, pct: number): GameState {
  const budget = s.player.cash * pct
  const qty = Math.min(maxBuyQty(s, id), Math.floor(budget / priceOf(s, id)))
  if (qty <= 0) return s
  try { return buy(s, id, qty) } catch { return s }
}

/** 전략별 매매 + 카드 선택. rand는 호출자가 소유한다. */
export function act(s: GameState, strategy: Strategy, rand: Rand): { state: GameState; cards: string[] } {
  const pool = tradable(s)
  if (pool.length > 0) {
    switch (strategy) {
      case 'buyhold':
        if (s.player.holdings.length === 0) s = investPct(s, pool[0]!.id, 0.9)
        break
      case 'panic': {
        // 오르면 사고 내리면 판다 — 전형적인 흑우
        s = sellAll(s)
        const hot = [...pool].sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0]!
        s = investPct(s, hot.id, 0.95)
        break
      }
      case 'momentum': {
        const hot = [...pool].sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0]!
        if (!s.player.holdings.some(h => h.stockId === hot.id)) { s = sellAll(s); s = investPct(s, hot.id, 0.8) }
        break
      }
      case 'random': {
        if (rand.chance(0.3)) s = sellAll(s)
        if (rand.chance(0.5)) s = investPct(s, pool[rand.int(0, pool.length - 1)]!.id, 0.5)
        break
      }
      case 'cash':
        // 매매를 전혀 하지 않는다 — 월급만 받는 무매매 기준선 (Ruling 52)
        break
    }
  }
  const usable = loadCards().filter(c => isCardAvailable(s, c))
  const card = strategy === 'panic'
    ? (usable.find(c => c.id === 'community') ?? usable[0])
    : usable[rand.int(0, Math.max(0, usable.length - 1))]
  return { state: s, cards: card ? [card.id] : [] }
}

export { createRng, Rand, totalAssets }

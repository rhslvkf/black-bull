import {
  type GameState, buy, sell, canSell, canBuy, maxBuyQty, totalAssets,
  loadCards, isCardAvailable, Rand, createRng, priceOf,
} from '@bb/core'

/**
 * 전략 이름은 게이트 제목·CLI 출력·README 표에 그대로 드러난다. 이름이 실제 동작과
 * 다르면 게이트의 의미도 같이 거짓이 된다(재리뷰 §6).
 *
 * - `cash`     **스스로는** 매매하지 않는다. 월급만 받는 '거의 무매매' 기준선 (Ruling 52).
 *              완전한 무매매는 아니다 — 물타기 카드와 `buyStockPct` 이벤트가 강제로
 *              사게 하는 경로가 남아 평균 노출이 5%쯤 된다(Ruling 72). 전략 코드로는
 *              막을 수 없다. 이 잔여 노출은 `seedhold > cash × 1.03` 게이트를 오히려
 *              **통과하기 어렵게** 만들므로 게이트의 정당성은 훼손되지 않는다.
 * - `seedhold` 턴 1에 **시드머니의 90%만** 넣고 156턴 방치. 이후 들어오는 월급은
 *              영원히 현금으로 둔다 → 총 투입 자본이 최종 자산의 8% 남짓이다.
 *              "얇은 노출로도 파산하지 않는가"를 재는 자다. (이전 이름이 `buyhold`였다)
 * - `buyhold`  **진짜 존버.** 매 턴 현금의 90%를 넣고 절대 팔지 않는다(정액분할매수).
 *              월급이 그대로 시장에 들어가므로 노출이 `panic`·`momentum`과 비교 가능하다.
 * - `momentum` 최근 3턴 상승률 1등으로 갈아탄다
 * - `random`   무작위 매매
 * - `panic`    오르면 사고 내리면 판다 — 전형적인 흑우
 */
export type Strategy = 'cash' | 'seedhold' | 'buyhold' | 'momentum' | 'random' | 'panic'

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
      case 'seedhold':
        // 턴 1에 한 번만 산다. 이후 월급은 현금으로 쌓인다.
        if (s.player.holdings.length === 0) s = investPct(s, pool[0]!.id, 0.9)
        break
      case 'buyhold':
        // 매 턴 현금의 90%를 같은 종목에 넣고 팔지 않는다 — 노출을 계속 유지하는 존버.
        s = investPct(s, pool[0]!.id, 0.9)
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
        // 스스로는 아무 주문도 내지 않는다 — 월급만 받는 '거의 무매매' 기준선 (Ruling 52).
        // 카드·이벤트가 강제하는 매수까지는 막지 못한다(Ruling 72, 평균 노출 5%).
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

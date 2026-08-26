import type { Effect, GameState } from '../types'
import { buy, maxBuyQty } from './trade'
import { priceOf } from './accounting'
import { GameError } from '../error'

const clampStat = (v: number) => Math.max(0, Math.min(10, Math.round(v * 10) / 10))
const bump = (s: GameState, key: string, delta: number): GameState =>
  ({ ...s, flags: { ...s.flags, [key]: Number(s.flags[key] ?? 0) + delta } })

// 티어락·자금부족·존재하지 않는 종목 등 게임 규칙상 실패는 조용히 무시한다(no-op).
// 그 외 예외(코드 버그 등)는 삼키지 않고 다시 던진다.
function buyWithBudget(state: GameState, stockId: string, budget: number): GameState {
  try {
    const price = priceOf(state, stockId)
    const qty = Math.min(maxBuyQty(state, stockId), Math.floor(budget / price))
    if (qty <= 0) return state
    return buy(state, stockId, qty)
  } catch (err) {
    if (err instanceof GameError) return state
    throw err
  }
}

/**
 * `mul`은 카드 등급 배율(gradeMul)이다. **크기가 있는 델타** — 스탯·멘탈·컨디션·현금 —
 * 에만 곱한다. flag/impact/retire/rivalMul/fundamentalMul/buyStockPct는 스위치이거나
 * 이미 배수·비율이라 여기에 등급을 곱하면 의미가 없거나 배율이 두 번 먹는다.
 *
 * 보상만이 아니라 **대가도 함께 커진다** — 음수 델타(야근의 컨디션 −18, 소주의 현금
 * −40,000)에도 같은 배율이 곱해진다. 이것이 등급 규칙 그 자체다(BALANCE.grade 주석).
 *
 * 돈은 정수 KRW이므로 곱한 뒤 반드시 반올림한다 — 실제 위반 사례:
 * 야근(+180,000)의 D등급이 `180000 * 0.7 === 125999.99999999999`,
 * A등급이 `180000 * 2.2 === 396000.00000000006`이다.
 * (−40,000 × 2.2는 정확히 −88,000이라 예시가 되지 못한다 — 리뷰 Fix Round 1에서 정정.)
 */
export function applyEffects(state: GameState, effects: Effect[], mul = 1): GameState {
  let s = state
  for (const e of effects) {
    switch (e.type) {
      case 'stat': {
        const stat = e.stat
        s = { ...s, player: { ...s.player, stats: { ...s.player.stats, [stat]: clampStat(s.player.stats[stat] + e.delta * mul) } } }
        break
      }
      case 'mental': s = bump(s, '__mentalPending', e.delta * mul); break
      case 'condition': s = bump(s, '__conditionPending', e.delta * mul); break
      case 'cash': s = { ...s, player: { ...s.player, cash: Math.max(0, s.player.cash + Math.round(e.delta * mul)) } }; break
      case 'flag':
        s = e.value === 'inc'
          ? bump(s, e.key, 1)
          : { ...s, flags: { ...s.flags, [e.key]: e.value } }
        break
      case 'impact':
        s = { ...s, pendingImpacts: [...s.pendingImpacts, {
          target: e.target, magnitude: e.magnitude,
          dueTurn: s.turn + e.delay, revealTurn: s.turn, revealed: false, title: e.title,
        }] }
        break
      case 'retire': s = { ...s, player: { ...s.player, employed: false } }; break
      case 'rivalMul': s = { ...s, rivalAssets: Math.round(s.rivalAssets * e.value) }; break
      case 'fundamentalMul':
        s = { ...s, stocks: s.stocks.map(x => x.id === e.stockId ? { ...x, fundamental: Math.round(x.fundamental * e.value) } : x) }
        break
      case 'buyStockPct': s = buyWithBudget(s, e.stockId, s.player.cash * e.pct); break
      default: {
        const _exhaustive: never = e
        return _exhaustive
      }
    }
  }
  return s
}

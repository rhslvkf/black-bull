import raw from '../../data/cards.json'
import type { ActionCardDef, GameState } from '../types'
import { GameError } from '../error'
import { isShaken } from '../mental/mental'
import { evalAll } from './conditions'
import { applyEffects } from './effects'

export function loadCards(): ActionCardDef[] { return raw as ActionCardDef[] }

export function isCardAvailable(state: GameState, card: ActionCardDef): boolean {
  if (!evalAll(state, card.requires)) return false
  if ((card.cost?.money ?? 0) > state.player.cash) return false
  const moneyCost = card.effects.find(e => e.type === 'cash' && e.delta < 0)
  if (moneyCost && moneyCost.type === 'cash' && state.player.cash + moneyCost.delta < 0) return false
  if (card.isRecovery) return true          // 스펙 §3.3: 회복 카드는 절대 잠기지 않는다
  if (card.lockedWhenShaken && isShaken(state)) return false
  return true
}

export function playCard(state: GameState, cardId: string): GameState {
  const card = loadCards().find(c => c.id === cardId)
  if (!card) throw new GameError('NO_CARD')
  if (!isCardAvailable(state, card)) throw new GameError('CARD_LOCKED')

  let s = state
  if (card.cost?.money) s = applyEffects(s, [{ type: 'cash', delta: -card.cost.money }])
  if (card.cost?.condition) s = applyEffects(s, [{ type: 'condition', delta: -card.cost.condition }])
  return applyEffects(s, card.effects)
}

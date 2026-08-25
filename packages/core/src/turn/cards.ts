import raw from '../../data/cards.json'
import type { ActionCardDef, GameState } from '../types'
import { GameError } from '../error'
import { isShaken } from '../mental/mental'
import { evalCondition } from './conditions'
import { applyEffects } from './effects'

export function loadCards(): ActionCardDef[] { return raw as ActionCardDef[] }

/** 카드가 잠긴 이유. 잠기지 않았으면 null. 화면이 자물쇠 아이콘만 띄우고 이유를
 *  말해주지 않아 플레이어가 티어 때문인지 돈 때문인지 알 수 없었다(최종 리뷰 Minor 12). */
export type CardLock = 'tier' | 'requires' | 'money' | 'shaken'

export function cardLockReason(state: GameState, card: ActionCardDef): CardLock | null {
  // 스펙 §3.3의 불변식: 회복 카드는 **어떤 상태에서도** 잠기지 않는다. 이 반환은 다른
  // 모든 검사보다 앞에 있어야 한다 — 예전에는 현금 검사가 위에 있어서 '최존버와 소주'
  // (cash −40,000)가 현금 4만원 미만이면 잠겼다(최종 리뷰 Minor A). 현금이 모자라도
  // applyEffects의 클램프가 잔고를 0으로 막아주므로 실행에는 문제가 없다.
  if (card.isRecovery) return null
  const unmet = (card.requires ?? []).find(c => !evalCondition(state, c))
  if (unmet) return unmet.type === 'tierMin' ? 'tier' : 'requires'
  if ((card.cost?.money ?? 0) > state.player.cash) return 'money'
  const moneyCost = card.effects.find(e => e.type === 'cash' && e.delta < 0)
  if (moneyCost && moneyCost.type === 'cash' && state.player.cash + moneyCost.delta < 0) return 'money'
  if (card.lockedWhenShaken && isShaken(state)) return 'shaken'
  return null
}

export function isCardAvailable(state: GameState, card: ActionCardDef): boolean {
  return cardLockReason(state, card) === null
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

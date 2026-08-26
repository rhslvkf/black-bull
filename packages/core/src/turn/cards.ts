import raw from '../../data/cards.json'
import type { ActionCardDef, GameState, CardGrade, Effect } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { isShaken } from '../mental/mental'
import { evalCondition } from './conditions'
import { applyEffects } from './effects'
import { gradeAp, gradeMul } from './grade'

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

/** 이번 턴 쓸 수 있는 행동력. 체력이 오를수록, 퇴사했을수록 늘어나되 상한이 있다. */
export function actionPoints(state: GameState): number {
  const a = BALANCE.action
  const raw = a.base + Math.floor(state.player.stats.stamina / a.staminaPerAp)
    + (state.player.employed ? 0 : a.unemployedBonus)
  return Math.min(a.max, raw)
}

/** 카드 한 장의 행동력 소모. 회복 카드는 등급과 무관하게 0이다 — 행동력이
 *  바닥나도 회복만은 항상 가능해야 한다는 교착 방지 불변식 때문이다. */
export function cardApCost(cardId: string, grade: CardGrade): number {
  const card = loadCards().find(c => c.id === cardId)
  return card?.isRecovery ? 0 : gradeAp(grade)
}

/**
 * 카드 한 장을 낸다. `grade`는 그 카드가 이번 턴 슬롯에 뽑힌 등급이고(호출자가
 * `gradeOfSlot`으로 얻는다), 효과와 **비용 양쪽**에 `gradeMul(grade)`가 곱해진다.
 * 비용을 빼먹으면 상위 등급이 대가 없이 몇 배의 보상만 주는 카드가 된다.
 */
export function playCard(state: GameState, cardId: string, grade: CardGrade): GameState {
  const card = loadCards().find(c => c.id === cardId)
  if (!card) throw new GameError('NO_CARD')
  if (!isCardAvailable(state, card)) throw new GameError('CARD_LOCKED')

  const mul = gradeMul(grade)
  // 비용은 한 번에 모아 **효과와 같은 배율**로 적용한다. money·condition을 따로 두 번
  // 호출하면 한쪽에만 배율을 빠뜨리는 변경이 조용히 가능해지는데, cards.json에
  // cost.condition을 가진 카드가 아직 없어 그 실수를 잡을 테스트를 쓸 수도 없다
  // (뮤테이션 MU6 무탐지 — 보고서 참고). 경로를 하나로 합쳐 그 틈 자체를 없앤다.
  const costs: Effect[] = []
  if (card.cost?.money) costs.push({ type: 'cash', delta: -card.cost.money })
  if (card.cost?.condition) costs.push({ type: 'condition', delta: -card.cost.condition })
  return applyEffects(applyEffects(state, costs, mul), card.effects, mul)
}

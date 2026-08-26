import type { CardGrade } from '@bb/core'
import { useGame } from './store/store'

/**
 * 테스트용 슬롯 주입.
 *
 * Task 6부터 화면에 뜨는 카드는 **이번 턴 슬롯 4장**(행동 3 + 회복 1)뿐이고, 슬롯 밖
 * 카드는 core가 NOT_IN_SLOTS로 거부한다(스토어 guard가 GameError를 삼키므로 화면에는
 * 무반응으로 보인다). 그래서 테스트가 특정 카드를 클릭하거나 `next()`에 넘기려면
 * 그 카드가 이번 턴에 뽑힌 상황을 직접 만들어야 한다.
 *
 * 등급은 중립 C(배율 1.0)로 고정한다 — 기존 수치 단언을 그대로 유지하기 위해서다.
 */
export function pinSlots(action: string[], recovery = 'hodl', grade: CardGrade = 'C'): void {
  const s = useGame.getState().state
  if (!s) throw new Error('pinSlots: 게임 상태가 없다 (newGame 먼저)')
  useGame.setState({ state: { ...s, slots: {
    action: action.map(cardId => ({ cardId, grade })),
    recovery: { cardId: recovery, grade },
  } } })
}

/** 원하는 카드를 그 턴 회복 슬롯에 꽂고 한 주 넘긴다. 턴이 넘어갈 때마다 슬롯이 새로
 *  뽑히므로 여러 턴을 도는 테스트는 매 턴 다시 꽂아야 한다 — 그 반복을 여기 가둔다.
 *  회복 카드는 행동력을 쓰지 않아 어떤 상태에서도 턴을 넘길 수 있다(교착 방지 불변식). */
export function nextTurnWith(cardId = 'hodl'): void {
  pinSlots([], cardId)
  useGame.getState().next([cardId])
}

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

/**
 * **이번 턴에 실제로 뽑힌** 슬롯에서 카드 한 장을 골라 한 주 넘긴다.
 *
 * 기본값은 회복 슬롯 카드다 — 회복 슬롯은 항상 하나 열려 있고 행동력을 쓰지 않아
 * 어떤 상태에서도 턴을 넘길 수 있다(교착 방지 불변식). 카드 id를 넘기면 그 카드를 쓰되,
 * **슬롯을 조작하지 않는다** — 슬롯 밖 카드면 core가 NOT_IN_SLOTS로 거부하고 스토어가
 * 그걸 삼켜 턴이 안 넘어간다(그게 정상 동작이다).
 *
 * (예전 구현은 매 턴 `pinSlots([], cardId)`로 **행동 슬롯을 비워** 카드를 꽂았다.
 *  그러면 156턴 통합 테스트가 뽑힌 슬롯을 한 번도 보지 않고 완주해 존재 이유가 반쯤
 *  사라진다 — 리뷰 Minor 3.)
 */
export function nextTurnWith(cardId?: string): void {
  const s = useGame.getState().state
  if (!s) throw new Error('nextTurnWith: 게임 상태가 없다 (newGame 먼저)')
  useGame.getState().next([cardId ?? s.slots.recovery.cardId])
}

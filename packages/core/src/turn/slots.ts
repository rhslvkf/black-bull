import type { GameState, CardGrade, TurnSlots, SlotCard } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { loadCards } from './cards'
import { rollGrade, cardStat } from './grade'
import { type RngState, Rand } from '../rng/rng'

/** 카드 풀에서 n장을 중복 없이 뽑고, 대응 스탯을 반영해 각 장의 등급을 굴린다. */
function draw(pool: { id: string }[], n: number, state: GameState, rng: RngState): [SlotCard[], RngState] {
  const rand = new Rand(rng)
  const remaining = [...pool]
  const out: SlotCard[] = []
  for (let i = 0; i < n && remaining.length > 0; i++) {
    const pick = remaining.splice(rand.int(0, remaining.length - 1), 1)[0]!
    const stat = cardStat(pick.id)
    const [grade, next] = rollGrade(rand.state, stat ? state.player.stats[stat] : 0)
    rand.state = next
    out.push({ cardId: pick.id, grade })
  }
  return [out, rand.state]
}

/**
 * 이번 턴의 행동 슬롯(BALANCE.slots.action칸)과 회복 슬롯(항상 1칸)을 뽑는다.
 *
 * 계약: `state.rng`를 **읽기만** 하고 상태를 갱신하지 않는다 — 반환된 두 번째 값
 * (소비된 이후의 RngState)을 상태에 반영하는 것은 호출자의 몫이다(initGame, 그리고
 * 이후 턴 루프). 이렇게 분리해야 "굴려만 보고 반영하지 않는" 시나리오(예: 미리보기)와
 * "굴리고 커밋한다"를 같은 함수로 섞지 않을 수 있다.
 */
export function drawSlots(state: GameState): [TurnSlots, RngState] {
  const cards = loadCards()
  const [action, r1] = draw(cards.filter(c => !c.isRecovery), BALANCE.slots.action, state, state.rng)
  const [recovery, r2] = draw(cards.filter(c => c.isRecovery), BALANCE.slots.recovery, state, r1)
  return [{ action, recovery: recovery[0]! }, r2]
}

/** 인맥 스탯에서 파생되는 이번 턴 리롤 횟수. 인맥 0에서도 base만큼은 항상 있다. */
export function rerollCount(state: GameState): number {
  const r = BALANCE.reroll
  return Math.min(r.max, r.base + Math.floor(state.player.stats.network / r.networkPer))
}

/** 행동 슬롯만 다시 굴리고 rerollsLeft를 1 줄인다. 회복 슬롯은 절대 건드리지 않는다
 *  (회복 슬롯은 항상 열려 있어야 한다는 불변식과, 리롤은 '뽑기 운'을 완화하는
 *  수단이지 회복 접근성을 흔드는 수단이 아니라는 설계 의도 둘 다 때문이다). */
export function rerollSlots(state: GameState): GameState {
  if (state.rerollsLeft <= 0) return state
  const cards = loadCards().filter(c => !c.isRecovery)
  const [action, rng] = draw(cards, BALANCE.slots.action, state, state.rng)
  return { ...state, slots: { ...state.slots, action }, rng, rerollsLeft: state.rerollsLeft - 1 }
}

/** 슬롯에서 해당 카드의 등급을 찾는다. 행동 슬롯과 회복 슬롯을 모두 뒤진다.
 *  슬롯에 없는 카드를 물으면 호출자의 버그이므로 조용히 기본값을 주지 않고 던진다. */
export function gradeOfSlot(state: GameState, cardId: string): CardGrade {
  const inAction = state.slots.action.find(s => s.cardId === cardId)
  if (inAction) return inAction.grade
  if (state.slots.recovery.cardId === cardId) return state.slots.recovery.grade
  throw new GameError('NOT_IN_SLOTS')
}

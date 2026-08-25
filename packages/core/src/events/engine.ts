// packages/core/src/events/engine.ts
import type { EventDef, GameState } from '../types'
import { BALANCE } from '../balance'
import { Rand } from '../rng/rng'
import { evalAll } from '../turn/conditions'
import { applyEffects } from '../turn/effects'

export function rumorLead(info: number): number {
  if (info >= 9) return 3
  if (info >= 6) return 2
  if (info >= 3) return 1
  return 0
}
export function rumorChance(info: number): number {
  if (info >= 9) return 0.9
  if (info >= 6) return 0.7
  if (info >= 3) return 0.5
  return 0
}

export function resolveImpacts(state: GameState): [Map<string, number>, GameState] {
  const due = new Map<string, number>()
  const rest = []
  for (const p of state.pendingImpacts) {
    if (p.dueTurn <= state.turn) due.set(p.target, (due.get(p.target) ?? 0) + p.magnitude)
    else rest.push(p)
  }
  return [due, { ...state, pendingImpacts: rest }]
}

export function revealRumors(state: GameState): GameState {
  const info = state.player.stats.info
  const lead = rumorLead(info)
  if (lead === 0) return state

  const rand = new Rand(state.rng)
  const news = [...state.news]
  const pendingImpacts = state.pendingImpacts.map(p => {
    if (p.revealed || p.dueTurn - state.turn > lead) return p
    if (!rand.chance(rumorChance(info))) return p
    news.push({ turn: state.turn, kind: 'rumor', title: `[루머] ${p.title}` })
    return { ...p, revealed: true }
  })
  return { ...state, rng: rand.state, news, pendingImpacts }
}

export function drawEvents(state: GameState, pool: EventDef[]): GameState {
  const rand = new Rand(state.rng)
  let s: GameState = state

  const eligible = pool.filter(e =>
    !(e.oneShot && s.firedOneShots.includes(e.id)) && evalAll(s, e.conditions))

  const picked: EventDef[] = []
  const remaining = [...eligible]
  const count = Math.min(BALANCE.maxEventsPerTurn, remaining.length)
  for (let i = 0; i < count; i++) {
    const e = rand.pickWeighted(remaining, x => x.weight)
    picked.push(e)
    remaining.splice(remaining.indexOf(e), 1)
  }
  s = { ...s, rng: rand.state }

  for (const e of picked) {
    if (e.oneShot) s = { ...s, firedOneShots: [...s.firedOneShots, e.id] }
    s = { ...s, news: [...s.news, { turn: s.turn, kind: 'news', title: e.text.title }] }
    if (e.impact) {
      s = applyEffects(s, [{ type: 'impact', ...e.impact, title: e.text.title }])
    }
    if (e.choices?.length) s = { ...s, pendingChoices: [...s.pendingChoices, { eventId: e.id }] }
    else if (e.effects) s = applyEffects(s, e.effects)
  }
  return s
}

export function resolveChoice(state: GameState, eventId: string, choiceIndex: number, pool: EventDef[]): GameState {
  // 종료된 게임에는 무동작 (Ruling 50) — 던지지 않는다. resolveChoice는 절대 던지지
  // 않는다는 Task 12의 불변식(스토어가 GameError를 삼켜 모달이 얼어붙는 문제) 유지.
  // ended 이후에는 advanceTurn 9단계가 pendingChoices를 비우므로 정상 경로에서는
  // 도달하지 않지만, UI가 낙오된 선택지에 실수로 호출해도 굳어진 ending과 모순되는
  // state 변화가 사후에 반영되지 않도록 여기서도 막는다.
  if (state.status !== 'playing') return state
  // 대기열에 없으면 무동작 — 더블클릭·스테일 호출로 효과가 중복 적용되지 않게 한다
  if (!state.pendingChoices.some(c => c.eventId === eventId)) return state

  const dequeued: GameState = {
    ...state,
    pendingChoices: state.pendingChoices.filter(c => c.eventId !== eventId),
  }

  const choices = pool.find(e => e.id === eventId)?.choices
  const choice = choices?.[choiceIndex]
  // 선택지가 없거나 인덱스가 범위를 벗어나면 효과 없이 대기열만 비운다 (모달 데드락 방지)
  return choice ? applyEffects(dequeued, choice.effects) : dequeued
}

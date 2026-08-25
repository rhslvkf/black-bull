// packages/core/src/events/engine.ts
import type { EventDef, GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
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
  let s: GameState = { ...state, rng: rand.state }

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
  const def = pool.find(e => e.id === eventId)
  const choice = def?.choices?.[choiceIndex]
  if (!def || !choice) throw new GameError('BAD_CHOICE')
  const s = applyEffects(state, choice.effects)
  return { ...s, pendingChoices: s.pendingChoices.filter(c => c.eventId !== eventId) }
}

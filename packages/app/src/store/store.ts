import { create } from 'zustand'
import {
  type GameState, initGame, advanceTurn, buy, sell, resolveChoice, loadEvents, totalAssets,
} from '@bb/core'

export const SAVE_KEY = 'blackbull.save.v1'
export const CODEX_KEY = 'blackbull.codex.v1'
const SAVE_VERSION = 1

export type TabKey = 'home' | 'market' | 'account' | 'codex'
export interface Codex { endings: string[]; titles: string[]; bestAssets: number; runs: number }

const EMPTY_CODEX: Codex = { endings: [], titles: [], bestAssets: 0, runs: 0 }
const events = loadEvents()

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.version === SAVE_VERSION ? (parsed.state as GameState) : null
  } catch { return null }
}
function writeSave(state: GameState) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state })) } catch { /* 용량 초과 무시 */ }
}
function readCodex(): Codex {
  try { return { ...EMPTY_CODEX, ...JSON.parse(localStorage.getItem(CODEX_KEY) ?? '{}') } } catch { return EMPTY_CODEX }
}
function writeCodex(c: Codex) {
  try { localStorage.setItem(CODEX_KEY, JSON.stringify(c)) } catch { /* 무시 */ }
}

interface Store {
  state: GameState | null
  tab: TabKey
  selectedStock: string | null
  codex: Codex
  newGame(seed?: number): void
  next(cards: string[]): void
  doBuy(id: string, qty: number): void
  doSell(id: string, qty: number): void
  choose(eventId: string, idx: number): void
  setTab(t: TabKey): void
  selectStock(id: string | null): void
  clearCutscene(): void
  reset(): void
}

export const useGame = create<Store>((set, get) => {
  /** 상태를 저장하고, 종료된 판이면 도감을 갱신한다. */
  const commit = (next: GameState) => {
    writeSave(next)
    if (next.status === 'ended' && next.ending && get().state?.status !== 'ended') {
      const c = get().codex
      const merged: Codex = {
        endings: [...new Set([...c.endings, next.ending.endingId])],
        titles: [...new Set([...c.titles, ...next.ending.titles])],
        bestAssets: Math.max(c.bestAssets, Math.max(0, totalAssets(next))),
        runs: c.runs + 1,
      }
      writeCodex(merged)
      set({ state: next, codex: merged })
      return
    }
    set({ state: next })
  }
  const guard = (fn: (s: GameState) => GameState) => {
    const s = get().state
    if (!s) return
    try { commit(fn(s)) } catch { /* 규칙 위반은 무시 — UI가 사전 차단한다 */ }
  }

  return {
    state: readSave(),
    tab: 'home',
    selectedStock: null,
    codex: readCodex(),
    newGame(seed = Math.floor(Math.random() * 2 ** 31)) {
      const s = initGame(seed)
      writeSave(s)
      set({ state: s, tab: 'home', selectedStock: null })
    },
    next(cards) { guard(s => advanceTurn(s, cards)) },
    doBuy(id, qty) { guard(s => buy(s, id, qty)) },
    doSell(id, qty) { guard(s => sell(s, id, qty)) },
    choose(eventId, idx) { guard(s => resolveChoice(s, eventId, idx, events)) },
    setTab(tab) { set({ tab }) },
    selectStock(selectedStock) { set({ selectedStock }) },
    clearCutscene() { const s = get().state; if (s) set({ state: { ...s, cutscene: null } }) },
    reset() { set({ state: readSave(), codex: readCodex(), tab: 'home', selectedStock: null }) },
  }
})

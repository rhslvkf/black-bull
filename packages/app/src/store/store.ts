import { create } from 'zustand'
import {
  type GameState, initGame, advanceTurn, buy, sell, resolveChoice, loadEvents, totalAssets,
  GameError,
} from '@bb/core'

/** 저장된 GameState 스키마 버전. 스키마를 바꾸면 이 값을 올린다 (README '저장 스키마' 절). */
export const SAVE_VERSION = 1
/** 키 이름도 버전에서 파생시킨다 — 리터럴로 'v1'을 박아두면 SAVE_VERSION을 올렸을 때
 *  키만 v1로 남아 이름이 거짓말이 된다(리뷰 Minor 2). 키가 바뀌면 구버전 저장은
 *  읽히지 않고 남아 있다가 브라우저가 정리한다 — version 필드 검사와 이중 방어다. */
export const SAVE_KEY = `blackbull.save.v${SAVE_VERSION}`
export const CODEX_KEY = 'blackbull.codex.v1'

export type TabKey = 'home' | 'market' | 'account' | 'codex'
export interface Codex { endings: string[]; titles: string[]; bestAssets: number; runs: number }

const EMPTY_CODEX: Codex = { endings: [], titles: [], bestAssets: 0, runs: 0 }
const events = loadEvents()

/**
 * Task 21 HUD/계좌/마켓 탭이 렌더 즉시 읽는 최소 필드만 형태 검사한다.
 * 전체 스키마(rng/regimes/trackers 등)까지 검사하지 않는 이유는 그 필드들은
 * advanceTurn 내부에서만 읽히고, 잘못돼도 core가 GameError(또는 구조가 완전히
 * 깨졌을 때만 도달하는 내부 불변식 Error)를 던지기 때문이다 — 리뷰 B1 최소 수정 범위.
 */
function isValidGameState(x: unknown): x is GameState {
  if (!x || typeof x !== 'object') return false
  const s = x as Record<string, unknown>
  if (typeof s.turn !== 'number') return false
  if (s.status !== 'playing' && s.status !== 'ended') return false
  if (!s.player || typeof s.player !== 'object') return false
  const player = s.player as Record<string, unknown>
  if (typeof player.cash !== 'number') return false
  if (!Array.isArray(player.holdings)) return false
  if (!Array.isArray(s.stockDefs)) return false
  return true
}
function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.version === SAVE_VERSION && isValidGameState(parsed.state) ? parsed.state : null
  } catch { return null }
}
function writeSave(state: GameState) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state })) } catch { /* 용량 초과 무시 */ }
}
/** Codex의 4개 필드 전부를 형태 검사한다 — Task 23 도감 화면이 그대로 읽는 값들이다(리뷰 B2). */
function isValidCodex(x: unknown): x is Codex {
  if (!x || typeof x !== 'object') return false
  const c = x as Record<string, unknown>
  return Array.isArray(c.endings) && Array.isArray(c.titles)
    && typeof c.bestAssets === 'number' && typeof c.runs === 'number'
}
function readCodex(): Codex {
  try {
    const merged = { ...EMPTY_CODEX, ...JSON.parse(localStorage.getItem(CODEX_KEY) ?? '{}') }
    return isValidCodex(merged) ? merged : EMPTY_CODEX
  } catch { return EMPTY_CODEX }
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
    // GameError(규칙 위반)만 삼킨다. UI가 사전 차단해야 하는 정상적인 거부 경로다.
    // 그 외(TypeError 등 내부 불변식 위반)는 실제 버그 신호이므로 다시 던져 드러낸다 —
    // 조용히 삼키면 "아무 반응 없는 화면"이 되어 디버깅 정보가 전혀 남지 않는다(Ruling 55).
    try { commit(fn(s)) } catch (e) { if (!(e instanceof GameError)) throw e }
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
    clearCutscene() {
      const s = get().state
      if (!s) return
      const next = { ...s, cutscene: null }
      writeSave(next)
      set({ state: next })
    },
    reset() { set({ state: readSave(), codex: readCodex(), tab: 'home', selectedStock: null }) },
  }
})

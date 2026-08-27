import { create } from 'zustand'
import {
  type GameState, initGame, advanceTurn, buy, sell, averageDown, resolveChoice, loadEvents, totalAssets,
  GameError, actionPoints, cardApCost, gradeOfSlot, rerollSlots,
} from '@bb/core'

/** 이미 고른 카드들의 행동력 합. 슬롯 밖 카드(원래는 있을 수 없다)는 0으로 친다 —
 *  gradeOfSlot이 NOT_IN_SLOTS를 던지는 경로를 게이팅 계산에서까지 전파시키지 않기
 *  위해서다. 회복 카드는 cardApCost 자체가 항상 0을 준다(교착 방지 불변식).
 *
 *  export하는 이유: `ActionMeter`가 "몇 칸이 꺼졌는가"를 그리는 데 정확히 같은 계산이
 *  필요하다. togglePick의 게이팅과 ActionMeter의 표시가 서로 다른 계산식을 쓰면(예:
 *  한쪽만 등급을 반영하면) 화면과 실제 예산이 어긋난다 — 단일 출처로 둔다. */
export function apSpent(state: GameState, picked: string[]): number {
  return picked.reduce((sum, id) => {
    try { return sum + cardApCost(id, gradeOfSlot(state, id)) } catch { return sum }
  }, 0)
}

/** 저장된 GameState 스키마 버전. 스키마를 바꾸면 이 값을 올린다 (README '저장 스키마' 절).
 *  실제 방어선은 이 숫자 자체가 아니라 아래 isValidGameState의 필드별 형태 검사다 —
 *  그 검사는 SAVE_VERSION과 무관하게 독립적으로 동작해서, 이 값을 실수로 안 올려도
 *  새 필드가 없는 구버전 저장은 형태 검사에서 걸러진다(Fix Round 1 — 리뷰 Minor,
 *  4→3으로 되돌려 실측 확인함). SAVE_VERSION을 올리는 건 그 위에 얹는 **명시적 신호**다:
 *  스키마가 바뀌었다는 사실을 코드에 남기고, 키 이름(SAVE_KEY)도 함께 바꿔 구버전
 *  저장이 아예 안 읽히게 이중으로 막는다 — 형태 검사 하나에만 기대지 않기 위한 방어다.
 *  v3: 턴 루프가 slots·rerollsLeft를 소비하기 시작했다(Task 6). v2 저장에는 그 필드가
 *  없어 카드 목록이 비고 턴을 넘길 수 없다.
 *  v4: trackers에 feesPaid/taxPaid/peakAssets/maxDrawdownPct/tradeCount 5개가 늘었다
 *  (Task 7). v3 저장에는 이 필드들이 없어 `undefined`로 로드되면 Math.max(undefined, x)가
 *  NaN이 되어 최대 낙폭이 영구히 NaN으로 오염될 수 있다(형태 검사가 실제 방어선이다).
 *  v5: PlayerState에 marginCallDueTurn(마진콜 유예 예고)이 늘었다. v4 저장에는 이 필드가
 *  없어 `undefined`로 로드되면 checkMarginCall의 `=== null` 분기가 전부 어긋나, 담보가
 *  무너져도 경고가 서지 않고 유예가 영원히 끝나지 않는다. */
export const SAVE_VERSION = 5
/** 키 이름도 버전에서 파생시킨다 — 리터럴로 'v1'을 박아두면 SAVE_VERSION을 올렸을 때
 *  키만 v1로 남아 이름이 거짓말이 된다(리뷰 Minor 2). 키가 바뀌면 구버전 저장은
 *  읽히지 않고 남아 있다가 브라우저가 정리한다 — version 필드 검사와 이중 방어다. */
export const SAVE_KEY = `blackbull.save.v${SAVE_VERSION}`
export const CODEX_KEY = 'blackbull.codex.v1'
/** 프롤로그를 봤는지. React state로만 두면 1턴에 새로고침할 때마다 다시 뜬다
 *  (최종 리뷰 Minor 9). GameState 스키마와 무관하므로 자체 키를 쓴다. */
export const PROLOGUE_KEY = 'blackbull.prologue.v1'

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
  // HUD가 렌더 즉시 읽는다(noTradeBaseline → trackers.netPayroll). 빠져 있으면 수익률이
  // NaN%로 표시되므로 다른 렌더 필드와 같은 급으로 검사한다. v1 저장에는 이 필드가
  // 없어 여기서 걸러지고, SAVE_KEY도 v2로 바뀌어 이중으로 막힌다.
  if (!s.trackers || typeof s.trackers !== 'object') return false
  const trackers = s.trackers as Record<string, unknown>
  if (typeof trackers.netPayroll !== 'number') return false
  // 엔딩 화면(잔고증명서)이 렌더 즉시 읽는다(Task 7). v3 저장에는 이 5개가 없어
  // undefined로 로드되면 Math.max(undefined, x)가 NaN이 되어 최대 낙폭이 영구히
  // NaN으로 오염된다 — 다른 렌더 필드와 같은 급으로 검사한다. v3 저장은 여기서
  // 걸러지고, SAVE_KEY도 v4로 바뀌어 이중으로 막힌다.
  if (typeof trackers.feesPaid !== 'number') return false
  if (typeof trackers.taxPaid !== 'number') return false
  if (typeof trackers.peakAssets !== 'number') return false
  if (typeof trackers.maxDrawdownPct !== 'number') return false
  if (typeof trackers.tradeCount !== 'number') return false
  // CardGrid가 렌더 즉시 읽는다(슬롯 4칸이 곧 카드 목록이다). 빠져 있으면 카드가 한 장도
  // 안 뜨고 턴을 넘길 수 없다 — 다른 렌더 필드와 같은 급으로 검사한다. rerollsLeft도
  // 턴 루프가 매 턴 리셋하는 필드라 함께 본다. v2 저장에는 둘 다 없어 여기서 걸러지고,
  // SAVE_KEY도 v3으로 바뀌어 이중으로 막힌다. (리뷰 Minor 2 — 이 검사를 지우면 실제로
  // 잡히는지 store.test.ts의 두 테스트가 고정한다.)
  if (!s.slots || typeof s.slots !== 'object') return false
  if (!('action' in s.slots) || !Array.isArray(s.slots.action)) return false
  if (!('recovery' in s.slots) || !s.slots.recovery || typeof s.slots.recovery !== 'object') return false
  if (typeof s.rerollsLeft !== 'number') return false
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
function readPrologueDone(): boolean {
  try { return localStorage.getItem(PROLOGUE_KEY) === '1' } catch { return false }
}

interface Store {
  state: GameState | null
  tab: TabKey
  selectedStock: string | null
  codex: Codex
  /** 프롤로그를 이미 본 판인가 (새로고침해도 유지된다). */
  prologueDone: boolean
  /** 이번 턴에 고른 카드. 탭을 옮겨도 유지돼야 한다 — HomeScreen의 지역 상태로 두면
   *  App이 화면을 언마운트할 때마다 조용히 사라진다(최종 리뷰 Minor 8). */
  picked: string[]
  newGame(seed?: number): void
  finishPrologue(): void
  togglePick(id: string): void
  next(cards: string[]): void
  doBuy(id: string, qty: number): void
  doSell(id: string, qty: number): void
  /** 물타기 — 시세 탭·종목 상세에서 하는 순수한 매매다(2.4). core의 averageDown은
   *  조건이 안 맞으면 던지지 않고 상태를 그대로 돌려준다(GameError를 던지는 buy/sell과
   *  다르다). Fix Round 1 Minor 2 — guard()는 GameError를 삼키는 통로인데 averageDown은
   *  던질 예외가 없으므로, 같은 이유로 guard를 안 쓰는 doReroll과 모양을 맞춰 여기서도
   *  guard 없이 직접 commit한다. advanceTurn을 거치지 않으므로 턴·행동력·리롤을
   *  소모하지 않는다. */
  doAverageDown(stockId: string, budget: number): void
  choose(eventId: string, idx: number): void
  setTab(t: TabKey): void
  selectStock(id: string | null): void
  clearCutscene(): void
  /** 행동 슬롯을 다시 굴린다(core의 rerollSlots). 회복 슬롯은 건드리지 않는다.
   *  rerollsLeft가 0이면 core가 상태를 그대로 돌려준다 — 여기서 별도로 막지 않아도
   *  안전하다(rerollSlots 자체의 계약). GameError를 던지지 않으므로 guard()를 쓰지
   *  않는다 — guard는 GameError를 삼키는 통로인데 여기엔 삼킬 예외가 없다. */
  doReroll(): void
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
    prologueDone: readPrologueDone(),
    picked: [],
    newGame(seed = Math.floor(Math.random() * 2 ** 31)) {
      const s = initGame(seed)
      writeSave(s)
      set({ state: s, tab: 'home', selectedStock: null, picked: [] })
    },
    finishPrologue() {
      try { localStorage.setItem(PROLOGUE_KEY, '1') } catch { /* 무시 */ }
      set({ prologueDone: true })
    },
    // Ruling 21 배경 — 예전엔 카드 한 장 = 행동력 1로 세는 count 기반 limit이었다.
    // 등급별로 행동력 소모가 달라지는 이번 재설계(§2.2)에서 count 기반 게이팅을 그대로
    // 두면, 등급 C(⚡2) 카드 하나만 골라도 예산 2/2를 이미 다 썼는데 count는 1이라
    // 두 번째 카드까지 고를 수 있어 버린다 — next-turn을 눌러도 core가 NO_AP로 조용히
    // 거부하는(guard가 GameError를 삼키는) 죽은 클릭이 된다. 그래서 여기서는 실제
    // 행동력 예산(actionPoints)과 실제 소모(cardApCost × 등급)를 직접 비교한다.
    togglePick(id) {
      const s = get().state
      if (!s) return
      const p = get().picked
      if (p.includes(id)) { set({ picked: p.filter(x => x !== id) }); return }

      const budget = actionPoints(s)
      let cost: number
      try { cost = cardApCost(id, gradeOfSlot(s, id)) } catch { return } // 슬롯 밖 카드 — 무반응

      // 새 카드 하나만으로 예산을 넘으면 아무 것도 비우지 않고 그냥 거부한다(스왑할
      // 이유가 없다 — 비워도 어차피 안 들어간다). 그 외에는 오래 고른 카드부터 밀어내
      // 예산 안으로 맞춘다(슬라이딩 윈도우 — 예전 count 기반 동작과 같은 감각을 유지).
      if (cost > budget) return
      let next = [...p, id]
      while (next.length > 1 && apSpent(s, next) > budget) next = next.slice(1)
      set({ picked: next })
    },
    next(cards) { guard(s => advanceTurn(s, cards)); set({ picked: [] }) },
    doBuy(id, qty) { guard(s => buy(s, id, qty)) },
    doSell(id, qty) { guard(s => sell(s, id, qty)) },
    doAverageDown(stockId, budget) {
      const s = get().state
      if (!s) return
      commit(averageDown(s, stockId, budget))
    },
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
    doReroll() {
      const s = get().state
      if (!s) return
      commit(rerollSlots(s))
    },
    reset() {
      set({
        state: readSave(), codex: readCodex(), prologueDone: readPrologueDone(),
        tab: 'home', selectedStock: null, picked: [],
      })
    },
  }
})

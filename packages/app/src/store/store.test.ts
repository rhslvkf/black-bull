import { describe, it, expect, beforeEach } from 'vitest'
import { useGame, SAVE_KEY, SAVE_VERSION, CODEX_KEY } from './store'
import { nextTurnWith } from '../testkit'
import { BALANCE } from '@bb/core'

beforeEach(() => { localStorage.clear(); useGame.getState().reset() })

describe('store', () => {
  it('newGame이 상태를 만든다', () => {
    useGame.getState().newGame(1)
    expect(useGame.getState().state!.turn).toBe(1)
    expect(useGame.getState().state!.player.cash).toBe(BALANCE.seedMoney)
  })
  it('newGame 후 localStorage에 저장된다', () => {
    useGame.getState().newGame(1)
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION)
  })
  it('next가 턴을 넘긴다', () => {
    useGame.getState().newGame(1)
    nextTurnWith()
    expect(useGame.getState().state!.turn).toBe(2)
  })
  it('doBuy/doSell이 반영된다', () => {
    useGame.getState().newGame(1)
    const id = useGame.getState().state!.stockDefs[0]!.id
    useGame.getState().doBuy(id, 1)
    expect(useGame.getState().state!.player.holdings).toHaveLength(1)
    useGame.getState().doSell(id, 1)
    expect(useGame.getState().state!.player.holdings).toHaveLength(0)
  })
  it('불가능한 매매는 상태를 깨지 않는다', () => {
    useGame.getState().newGame(1)
    const before = useGame.getState().state!
    useGame.getState().doBuy(before.stockDefs[0]!.id, 99_999_999)
    expect(useGame.getState().state!.player.cash).toBe(before.player.cash)
  })
  it('setTab / selectStock이 동작한다', () => {
    useGame.getState().setTab('market')
    useGame.getState().selectStock('sjc')
    expect(useGame.getState().tab).toBe('market')
    expect(useGame.getState().selectedStock).toBe('sjc')
  })
  it('게임이 끝나면 도감이 갱신된다', () => {
    useGame.getState().newGame(3)
    for (let i = 0; i < 156 && useGame.getState().state!.status === 'playing'; i++) {
      const st = useGame.getState().state!
      st.pendingChoices.forEach(c => useGame.getState().choose(c.eventId, 0))
      nextTurnWith()
    }
    const codex = useGame.getState().codex
    expect(codex.runs).toBe(1)
    expect(codex.endings.length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).runs).toBe(1)
  })
  it('손상된 세이브는 무시된다', () => {
    localStorage.setItem(SAVE_KEY, '{{{')
    expect(() => useGame.getState().reset()).not.toThrow()
    expect(useGame.getState().state).toBeNull()
  })
  it('버전이 다른 세이브는 무시된다', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 99, state: {} }))
    useGame.getState().reset()
    expect(useGame.getState().state).toBeNull()
  })

  /** 종료 상태까지 결정론적으로 진행한다(항상 'hodl' 카드, 항상 선택지 0번). */
  function playToEnd() {
    for (let i = 0; i < 200 && useGame.getState().state!.status === 'playing'; i++) {
      const st = useGame.getState().state!
      st.pendingChoices.forEach(c => useGame.getState().choose(c.eventId, 0))
      nextTurnWith()
    }
  }

  it('같은 시드로 두 번 끝까지 플레이해도 도감의 엔딩은 유니크하게 하나만 쌓인다', () => {
    useGame.getState().newGame(3)
    playToEnd()
    expect(useGame.getState().state!.status).toBe('ended')
    useGame.getState().newGame(3) // 동일 시드 → 결정론적으로 동일한 엔딩
    playToEnd()
    const codex = useGame.getState().codex
    expect(codex.runs).toBe(2)
    expect(codex.endings.length).toBe(1)
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).endings.length).toBe(1)
  })

  it('bestAssets는 더 낮은 결과로 덮어써지지 않는다', () => {
    localStorage.setItem(
      CODEX_KEY,
      JSON.stringify({ endings: [], titles: [], bestAssets: 999_999_999, runs: 0 }),
    )
    useGame.getState().reset()
    useGame.getState().newGame(3)
    playToEnd()
    const codex = useGame.getState().codex
    expect(codex.runs).toBe(1)
    expect(codex.bestAssets).toBe(999_999_999)
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).bestAssets).toBe(999_999_999)
  })

  it('버전은 맞지만 구조가 깨진(필드 오염) 세이브는 무시된다', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: { turn: 'NOT_A_NUMBER' } }))
    useGame.getState().reset()
    expect(useGame.getState().state).toBeNull()
  })

  it('타입이 깨진 도감은 무시되고 빈 도감으로 대체된다', () => {
    localStorage.setItem(
      CODEX_KEY,
      JSON.stringify({ endings: 'oops', titles: null, bestAssets: 'x', runs: 'y' }),
    )
    useGame.getState().reset()
    const codex = useGame.getState().codex
    expect(codex.endings).toEqual([])
    expect(codex.titles).toEqual([])
    expect(codex.bestAssets).toBe(0)
    expect(codex.runs).toBe(0)
  })

  it('clearCutscene 후 새로고침(reset)해도 컷신이 되살아나지 않는다', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    // 컷신이 떠 있는 상태를 저장해 둔 뒤 로드
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: { ...s, cutscene: 'cutscene.promote.1' } }))
    useGame.getState().reset()
    expect(useGame.getState().state!.cutscene).toBe('cutscene.promote.1')
    useGame.getState().clearCutscene()
    expect(useGame.getState().state!.cutscene).toBeNull()
    useGame.getState().reset() // 새로고침 시뮬레이션: localStorage에서 다시 읽는다
    expect(useGame.getState().state!.cutscene).toBeNull()
  })

  it('구조적으로 깨진 state에서 core가 던지는 일반 Error는 삼키지 않고 다시 던진다', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    // stockDefs에 없는 종목이 stocks에 섞여 들어간, 최소 형태 검사는 통과하지만
    // 내부적으로는 깨진 state — stepPrices가 GameError가 아닌 일반 Error를 던진다.
    const broken = { ...s, stocks: [...s.stocks, { id: '__missing__', price: 1, fundamental: 1, history: [1] }] }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: broken }))
    useGame.getState().reset()
    expect(useGame.getState().state!.stocks.length).toBe(broken.stocks.length) // 로드 자체는 통과했다(sanity)
    expect(() => nextTurnWith()).toThrow()
  })
})

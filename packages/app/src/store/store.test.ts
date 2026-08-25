import { describe, it, expect, beforeEach } from 'vitest'
import { useGame, SAVE_KEY, CODEX_KEY } from './store'
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
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).version).toBe(1)
  })
  it('next가 턴을 넘긴다', () => {
    useGame.getState().newGame(1)
    useGame.getState().next(['hodl'])
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
      useGame.getState().next(['hodl'])
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
      useGame.getState().next(['hodl'])
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
})

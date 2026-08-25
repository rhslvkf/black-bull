import { describe, it, expect, beforeEach } from 'vitest'
import { useGame, SAVE_KEY } from './store/store'
import { loadEvents, BALANCE, ENDING_IDS, type EndingId } from '@bb/core'

const events = loadEvents()

/** UI 스토어만으로 156턴을 완주한다. */
function playToEnd(seed: number) {
  const g = useGame.getState()
  g.newGame(seed)
  for (let i = 0; i < BALANCE.totalTurns + 5; i++) {
    const s = useGame.getState().state!
    if (s.status === 'ended') break
    while (useGame.getState().state!.pendingChoices.length > 0) {
      const c = useGame.getState().state!.pendingChoices[0]!
      const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
      if (n > 0) useGame.getState().choose(c.eventId, 0)
      else break
    }
    useGame.getState().next(['hodl'])
  }
  return useGame.getState().state!
}

beforeEach(() => { localStorage.clear(); useGame.getState().reset() })

describe('통합: 스토어로 완주', () => {
  it('여러 시드에서 끝까지 가고 알려진 엔딩이 나온다', () => {
    for (const seed of [1, 2, 3, 7, 13]) {
      const s = playToEnd(seed)
      expect(s.status, `seed ${seed}`).toBe('ended')
      // endingId.length > 0만 보면 'unknown' 같은 값도 통과한다 — 실제 엔딩 id인지 본다.
      expect(ENDING_IDS as readonly string[], `seed ${seed}`).toContain(s.ending!.endingId)
      // 도중에 멈춰서 끝난 게 아니라 마지막 턴까지 갔는지도 본다.
      expect(s.turn, `seed ${seed}`).toBe(BALANCE.totalTurns)
    }
  })
  it('완주 후 도감과 세이브가 남는다', () => {
    const s = playToEnd(4)
    expect(useGame.getState().codex.runs).toBe(1)
    expect(useGame.getState().codex.endings).toContain(s.ending!.endingId as EndingId)
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
  })
  it('새로고침(reset)해도 진행이 복원된다', () => {
    useGame.getState().newGame(9)
    useGame.getState().next(['hodl'])
    useGame.getState().next(['hodl'])
    const turn = useGame.getState().state!.turn
    expect(turn).toBeGreaterThan(1)          // 애초에 진행이 안 됐으면 복원도 무의미하다
    useGame.setState({ state: null })
    useGame.getState().reset()
    expect(useGame.getState().state!.turn).toBe(turn)
  })
  it('완주 중 멘탈·컨디션이 범위를 벗어나지 않는다', () => {
    const s = playToEnd(21)
    expect(s.player.mental).toBeGreaterThanOrEqual(0)
    expect(s.player.mental).toBeLessThanOrEqual(100)
    expect(s.player.condition).toBeGreaterThanOrEqual(0)
    expect(s.player.condition).toBeLessThanOrEqual(100)
  })
  it('매매를 섞어 완주해도 끝까지 가고 보유가 유지된다 (스토어의 거래 경로 포함)', () => {
    // 위 완주 테스트들은 next()만 부르므로 doBuy/doSell을 한 번도 지나지 않는다(리뷰 Minor 3).
    const g = useGame.getState()
    g.newGame(11)
    g.next(['hodl'])
    g.doBuy('sjc', 20)
    expect(useGame.getState().state!.player.holdings).toHaveLength(1)
    for (let i = 0; i < BALANCE.totalTurns + 5; i++) {
      const s = useGame.getState().state!
      if (s.status === 'ended') break
      while (useGame.getState().state!.pendingChoices.length > 0) {
        const c = useGame.getState().state!.pendingChoices[0]!
        const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
        if (n > 0) useGame.getState().choose(c.eventId, 0)
        else break
      }
      // 80턴차에 절반을 판다 — 매도 경로도 통합 수준에서 한 번은 지난다.
      const cur = useGame.getState().state!
      if (cur.turn === 80 && cur.player.holdings.length > 0) useGame.getState().doSell('sjc', 10)
      useGame.getState().next(['hodl'])
    }
    const end = useGame.getState().state!
    expect(end.status).toBe('ended')
    expect(end.turn).toBe(BALANCE.totalTurns)
    expect(end.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(10)
  })
  it('여러 판을 이어서 돌리면 도감 회차가 누적된다', () => {
    playToEnd(31)
    playToEnd(32)
    expect(useGame.getState().codex.runs).toBe(2)
  })
})

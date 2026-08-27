import { describe, it, expect } from 'vitest'
import { currentState, renderWithState } from './testUtils'
import { useGame } from './store/store'

// 리뷰 Fix Round 1 (Minor 2) — renderWithState를 import하면 자동 등록되는 afterEach
// 정리(localStorage.clear() + useGame.getState().reset())가 codex/prologueDone도
// 실제로 비우는지 회귀 테스트로 고정한다. 이 파일 하나 안에서 앞 테스트가 오염시키고
// 뒤 테스트가 깨끗한 상태를 보는 것으로 확인한다 — 두 it() 사이에 vitest의 afterEach가
// 정확히 한 번 실행된다.
describe('renderWithState의 스토어 정리 (Ruling 19, Minor 2 회귀)', () => {
  it('(1) 이 테스트가 codex와 프롤로그 완료 여부를 오염시킨다', () => {
    renderWithState({})
    useGame.getState().finishPrologue()
    useGame.setState({ codex: { endings: ['legend'], titles: ['타이틀'], bestAssets: 999, runs: 3 } })
    expect(useGame.getState().prologueDone).toBe(true)
    expect(useGame.getState().codex.runs).toBe(3)
  })

  it('(2) 다음 테스트는 오염되지 않은 깨끗한 상태를 본다', () => {
    // 여기 도달하기 전에 testUtils.tsx의 afterEach가 이미 실행됐다. 이 단언이 실패하면
    // Task 16(도감)·Task 20(프롤로그)이 renderWithState를 쓸 때 이전 테스트의 codex나
    // prologueDone이 새어 들어가고 있다는 뜻이다.
    expect(useGame.getState().prologueDone).toBe(false)
    expect(useGame.getState().codex).toEqual({ endings: [], titles: [], bestAssets: 0, runs: 0 })
  })
})


/**
 * Task 16 Fix Round 1 Major 2 — `renderWithState`의 `player`·`trackers` 부분 병합이
 * "얕은 덮어쓰기(전체 대체)"로 후퇴해도 잡히는 테스트가 하나도 없었다(리뷰 지적).
 * `{ ...base, ...patch }`가 `patch`(또는 `patch ?? base`)로 바뀌면, patch에 없는 키는
 * `Partial<...>` 타입이라 결과 객체에서 통째로 사라진다(undefined) — 넘기지 않은 필드가
 * "기본값 그대로"인지(undefined가 아니라 실제 새 판의 초기값과 같은지)를 직접 본다.
 * Task 21(엔딩 잔고증명서)이 곧 trackers의 peakAssets·maxDrawdownPct·tradeCount를 쓰므로
 * 이 병합이 조용히 깨지면 그 태스크가 통째로 헛돈다 — 공용 헬퍼라 여기서 못박는다.
 */
describe('renderWithState의 부분 병합 (Task 16 Fix Round 1 Major 2)', () => {
  it('trackers 부분 override는 넘기지 않은 필드를 새 판의 기본값 그대로 남긴다', () => {
    renderWithState({ trackers: { feesPaid: 12345 } })
    const t = currentState().trackers
    expect(t.feesPaid).toBe(12345) // 넘긴 값은 반영된다
    // 넘기지 않은 나머지 10개 필드 — 전체 대체로 후퇴하면 전부 undefined가 된다.
    expect(t.taxPaid).toBe(0)
    expect(t.peakAssets).toBe(0)
    expect(t.maxDrawdownPct).toBe(0)
    expect(t.tradeCount).toBe(0)
    expect(t.netPayroll).toBe(0)
    expect(t.shakenTurns).toBe(0)
    expect(t.usedMargin).toBe(false)
    expect(t.lossCuts).toBe(0)
    expect(t.maxHeldTurns).toBe(0)
    expect(t.cashRatioSum).toBe(0)
    expect(t.turnsCounted).toBe(0)
  })

  it('player 부분 override(중첩 stats 포함)도 넘기지 않은 필드를 새 판의 기본값 그대로 남긴다', () => {
    renderWithState({ player: { stats: { grit: 7 } } })
    const p = currentState().player
    expect(p.stats.grit).toBe(7) // 넘긴 값은 반영된다
    // stats 중첩 병합 — grit만 넘겼는데 나머지 스탯이 사라지면 안 된다.
    expect(p.stats.stamina).toBe(0)
    expect(p.stats.info).toBe(0)
    expect(p.stats.analysis).toBe(0)
    expect(p.stats.network).toBe(0)
    // player 최상위 필드 — stats만 넘겼는데 cash·holdings 등이 사라지면 안 된다.
    expect(p.cash).toBe(3_000_000) // BALANCE.seedMoney(core/balance.ts)
    expect(p.loan).toBe(0)
    expect(p.holdings).toEqual([])
    expect(p.mental).toBe(100)
    expect(p.condition).toBe(100)
    expect(p.employed).toBe(true)
    expect(p.tier).toBe(0)
  })
})

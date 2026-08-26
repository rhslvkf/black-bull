import { describe, it, expect } from 'vitest'
import { renderWithState } from './testUtils'
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

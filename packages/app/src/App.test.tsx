import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import App from './App'
import { useGame } from './store/store'
import { loadEvents } from '@bb/core'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

// 리뷰 M-3: advance.ts의 5단계(이벤트/pendingChoices)가 7단계(settleTier/cutscene)보다
// 먼저 실행되므로, 한 번의 advanceTurn 안에서 승급/강등과 이벤트가 동시에 뽑히면
// cutscene !== null && pendingChoices.length > 0가 실제로 동시에 성립할 수 있다(도달
// 가능한 상태). App.tsx는 <EventModal/><CutsceneView/><EndingView/> 순서로 DOM에 렌더해
// 같은 z-index(20)에서 나중에 그려지는 형제가 위에 뜨는 방식으로 "엔딩 > 컷신 > 이벤트"
// 우선순위를 만든다. 이 순서를 실제로 렌더해 고정한다 — 렌더 순서가 바뀌면(예: 실수로
// EventModal을 맨 뒤로 옮기면) 이 테스트가 잡아야 한다.
function goHome() {
  // 최초 플레이는 프롤로그가 뜨므로 건너뛰기로 통과한다.
  fireEvent.click(screen.getByTestId('prologue-skip'))
}

describe('오버레이 우선순위 (리뷰 M-3)', () => {
  it('컷신과 대기 선택지가 동시에 있으면 컷신이 위(마지막 .overlay)에 그려진다', () => {
    render(<App />)
    goHome()
    const ev = loadEvents().find(e => (e.choices?.length ?? 0) >= 2)!
    const s = useGame.getState().state!
    act(() => { useGame.setState({ state: {
      ...s, cutscene: 'cutscene.promote.1', pendingChoices: [{ eventId: ev.id }],
    } }) })

    // 이벤트 모달과 컷신 둘 다 DOM에 존재해야 한다(동시 성립 확인).
    expect(screen.getByTestId('event-modal')).toBeDefined()
    expect(screen.getByTestId('cutscene')).toBeDefined()

    // 마지막 .overlay가 위에 그려진다(같은 z-index에서 나중 형제가 위). App.tsx의 렌더
    // 순서(EventModal → CutsceneView → EndingView)가 지켜지는 한 컷신이 마지막이어야 한다.
    const overlays = document.querySelectorAll('.overlay')
    expect(overlays[overlays.length - 1]!.getAttribute('data-testid')).toBe('cutscene')
  })

  it('엔딩 상태에서 컷신이 남아 있어도 엔딩이 위(마지막 .overlay)에 그려진다', () => {
    render(<App />)
    goHome()
    const s = useGame.getState().state!
    // advance.ts 9단계는 pendingChoices만 강제로 비우고 cutscene은 그대로 둔다(Ruling 50) —
    // 그래서 status==='ended'와 cutscene!==null이 동시에 성립할 수 있다.
    act(() => { useGame.setState({ state: {
      ...s, status: 'ended', cutscene: 'cutscene.promote.1',
      ending: { endingId: 'super', endingName: '슈퍼개미', titles: [], finalAssets: 700_000_000 },
    } }) })

    expect(screen.getByTestId('cutscene')).toBeDefined()
    expect(screen.getByTestId('ending')).toBeDefined()

    const overlays = document.querySelectorAll('.overlay')
    expect(overlays[overlays.length - 1]!.getAttribute('data-testid')).toBe('ending')
  })
})

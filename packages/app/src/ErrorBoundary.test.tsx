import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Root } from './Root'
import { ErrorBoundary } from './ErrorBoundary'
import { useGame, SAVE_KEY, SAVE_VERSION, CODEX_KEY } from './store/store'
import { nextTurnWith } from './testkit'

// React는 바운더리가 잡은 예외도 콘솔에 한 번 더 찍는다 — 테스트 출력만 조용히 만든다.
let spy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  localStorage.clear()
  useGame.setState({ state: null, tab: 'home', selectedStock: null })
  spy = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => { spy.mockRestore() })

function Boom(): JSX.Element { throw new Error('렌더 폭발') }

describe('ErrorBoundary', () => {
  it('자식이 정상이면 그대로 통과시킨다 (바운더리가 화면을 가리지 않는다)', () => {
    render(<ErrorBoundary><p data-testid="ok">정상</p></ErrorBoundary>)
    expect(screen.getByTestId('ok')).toBeDefined()
    expect(screen.queryByTestId('error-boundary')).toBeNull()
  })

  it('자식 렌더가 던지면 흰 화면 대신 복구 화면을 그린다', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByTestId('error-boundary')).toBeDefined()
    expect(screen.getByTestId('error-recover')).toBeDefined()
    // 어떤 오류였는지 화면에 남긴다 (조용히 삼키지 않는다)
    expect(screen.getByText('렌더 폭발')).toBeDefined()
  })
})

describe('ErrorBoundary — 손상된 저장으로 렌더가 죽는 실제 경로', () => {
  /**
   * 스토어의 형태 검사(isValidGameState)를 통과하지만 렌더 중에 죽는 저장을 만든다.
   * holdings가 stocks에 없는 종목을 가리키면 Hud → totalAssets → priceOf가
   * GameError('NO_STOCK')를 던진다. 스토어 guard는 액션 경로에만 있으므로 렌더는 못 막는다.
   */
  function writeBrokenSave() {
    // 프롤로그(codex.runs===0 && turn===1)가 뜨면 Hud가 아예 렌더되지 않아 죽지도 않는다.
    // 2회차 이상으로 만들어 실제 플레이 화면이 렌더되게 한다.
    localStorage.setItem(CODEX_KEY, JSON.stringify({ endings: ['bank'], titles: [], bestAssets: 7, runs: 1 }))
    useGame.getState().newGame(1)
    // 몇 턴 진행해 둔다 — 1턴차에서 깨뜨리면 "복구가 새 판을 열었다"와 "진행이 살아남았다"가
    // 구분되지 않는다(둘 다 turn === 1). 아래 '다시 시도' 테스트가 그 구분에 기댄다.
    for (let i = 0; i < 5; i++) nextTurnWith()
    const s = useGame.getState().state!
    const broken = {
      ...s,
      player: { ...s.player, holdings: [{ stockId: '존재하지않는종목', qty: 1, avgCost: 1000, heldTurns: 0 }] },
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: broken }))
    useGame.setState({ state: null })
    useGame.getState().reset()   // 손상된 저장을 다시 읽어들인다
  }

  it('손상된 저장을 읽으면 Root가 복구 화면을 보여준다', () => {
    writeBrokenSave()
    render(<Root />)
    expect(screen.getByTestId('error-boundary')).toBeDefined()
  })

  it('복구 버튼을 누르면 저장이 지워지고 1턴짜리 새 판이 시작된다', () => {
    writeBrokenSave()
    render(<Root />)
    fireEvent.click(screen.getByTestId('error-recover'))

    // 복구 화면이 사라지고 실제로 새 판이 돌아간다
    expect(screen.queryByTestId('error-boundary')).toBeNull()
    const s = useGame.getState().state!
    expect(s.turn).toBe(1)          // 진행이 초기화됐다 = 정말로 새 판이다
    expect(s.player.holdings).toEqual([])
    // 도감(회차 기록)은 지우지 않는다 — 지우는 건 손상 의심 대상인 세이브뿐이다
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).runs).toBe(1)
  })

  it('다시 시도 버튼은 저장을 지우지 않고 진행을 유지한다 (일시적 예외용)', () => {
    // 유일한 버튼이 '세이브 삭제 + 새 판'이면 코드 버그 한 번에 140턴이 사라진다(리뷰 Minor 1).
    writeBrokenSave()
    const saved = localStorage.getItem(SAVE_KEY)
    const turnBefore = useGame.getState().state!.turn
    expect(turnBefore).toBeGreaterThan(1)
    render(<Root />)
    expect(screen.getByTestId('error-boundary')).toBeDefined()

    // 손상 원인을 바깥에서 고쳐 두고(=일시적 예외였던 상황) 다시 시도한다.
    const s = useGame.getState().state!
    act(() => { useGame.setState({ state: { ...s, player: { ...s.player, holdings: [] } } }) })
    fireEvent.click(screen.getByTestId('error-retry'))

    expect(screen.queryByTestId('error-boundary')).toBeNull()
    expect(useGame.getState().state!.turn).toBe(turnBefore)   // 진행이 살아 있다
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
    expect(saved).not.toBeNull()
  })
  it('복구하지 않으면 자동으로 되살아나지 않는다 (바운더리가 상태를 붙들고 있다)', () => {
    // 바운더리가 매 렌더마다 error를 스스로 지운다면 이 테스트가 무한 반복/통과 실패로 드러난다.
    writeBrokenSave()
    const { rerender } = render(<Root />)
    rerender(<Root />)
    expect(screen.getByTestId('error-boundary')).toBeDefined()
  })
})

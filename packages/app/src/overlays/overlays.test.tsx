import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EventModal } from './EventModal'
import { CutsceneView } from './CutsceneView'
import { EndingView } from './EndingView'
import { PrologueView } from './PrologueView'
import { CodexScreen } from '../screens/CodexScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { useGame, SAVE_KEY } from '../store/store'
import { loadEvents, ENDINGS, TITLES } from '@bb/core'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('EventModal', () => {
  it('대기 중인 선택지가 없으면 아무것도 안 그린다', () => {
    const { container } = render(<EventModal />)
    expect(container.firstChild).toBeNull()
  })
  it('선택지를 렌더하고 고르면 대기열이 빈다', () => {
    const ev = loadEvents().find(e => (e.choices?.length ?? 0) >= 2)!
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
    render(<EventModal />)
    expect(screen.getByText(ev.text.title)).toBeDefined()
    expect(screen.getAllByTestId(/^choice-/)).toHaveLength(ev.choices!.length)
    fireEvent.click(screen.getAllByTestId(/^choice-/)[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(0)
  })
  it('여러 선택지가 대기 중이면 순서대로 전부 해소된다', () => {
    const evs = loadEvents().filter(e => (e.choices?.length ?? 0) >= 2).slice(0, 2)
    expect(evs).toHaveLength(2)
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: evs.map(e => ({ eventId: e.id })) } })
    render(<EventModal />)
    expect(screen.getByText(evs[0]!.text.title)).toBeDefined()
    fireEvent.click(screen.getAllByTestId(/^choice-/)[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(1)
    expect(useGame.getState().state!.pendingChoices[0]!.eventId).toBe(evs[1]!.id)
    expect(screen.getByText(evs[1]!.text.title)).toBeDefined()
    fireEvent.click(screen.getAllByTestId(/^choice-/)[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(0)
  })
  it('선택지를 고르면 홈 화면의 한 주 넘기기가 다시 활성화된다', () => {
    const ev = loadEvents().find(e => (e.choices?.length ?? 0) >= 2)!
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
    render(<><HomeScreen /><EventModal /></>)
    fireEvent.click(screen.getByTestId('card-hodl'))
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getAllByTestId(/^choice-/)[0]!)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(false)
  })
})

describe('CutsceneView', () => {
  it('cutscene이 없으면 안 뜬다', () => {
    expect(render(<CutsceneView />).container.firstChild).toBeNull()
  })
  it('승급 컷신을 띄우고 닫는다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, cutscene: 'cutscene.promote.1' } })
    render(<CutsceneView />)
    expect(screen.getByTestId('cutscene')).toBeDefined()
    fireEvent.click(screen.getByTestId('cutscene-close'))
    expect(useGame.getState().state!.cutscene).toBeNull()
  })
  it('컷신을 닫으면 새로고침해도 다시 뜨지 않는다', () => {
    // useGame.setState()로 직접 바꾸면 store의 액션(writeSave)을 건너뛰어 localStorage가
    // 갱신되지 않으므로, 이 테스트가 실제로 지속성 경로를 검증하지 못하고 통과해버린다.
    // 실제 저장 파일 포맷 그대로 localStorage에 써서 store가 그것을 읽어들이게 한다.
    const s = useGame.getState().state!
    const withCutscene = { ...s, cutscene: 'cutscene.promote.1' }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, state: withCutscene }))
    act(() => { useGame.getState().reset() })
    expect(useGame.getState().state!.cutscene).toBe('cutscene.promote.1')

    render(<CutsceneView />)
    fireEvent.click(screen.getByTestId('cutscene-close'))
    // 새로고침 시뮬레이션: reset()은 localStorage에서 다시 읽어온다.
    act(() => { useGame.getState().reset() })
    expect(useGame.getState().state!.cutscene).toBeNull()
    expect(render(<CutsceneView />).container.firstChild).toBeNull()
  })
})

describe('EndingView', () => {
  it('진행 중이면 안 뜬다', () => {
    expect(render(<EndingView />).container.firstChild).toBeNull()
  })
  it('엔딩명·칭호·자산을 보여주고 다시 시작할 수 있다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, status: 'ended', ending: {
      endingId: 'super', endingName: '슈퍼개미', titles: ['박대박을 이긴'], finalAssets: 700_000_000,
    } } })
    render(<EndingView />)
    expect(screen.getByText(/슈퍼개미/)).toBeDefined()
    expect(screen.getByText(/박대박을 이긴/)).toBeDefined()
    expect(screen.getByText('700,000,000원')).toBeDefined()
    fireEvent.click(screen.getByTestId('restart'))
    expect(useGame.getState().state!.status).toBe('playing')
    expect(useGame.getState().state!.turn).toBe(1)
  })
})

describe('PrologueView', () => {
  it('끝까지 넘기면 onDone이 불린다', () => {
    let done = false
    render(<PrologueView onDone={() => { done = true }} />)
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('prologue-next'))
    expect(done).toBe(true)
  })
  it('건너뛰기가 있다', () => {
    let done = false
    render(<PrologueView onDone={() => { done = true }} />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    expect(done).toBe(true)
  })
})

describe('CodexScreen', () => {
  it('미수집 엔딩은 ???로 가려진다', () => {
    render(<CodexScreen />)
    // 엔딩 목록과 칭호 목록 각각에서 ???가 항목 수만큼 정확히 나와야 한다 —
    // 두 목록을 합산한 개수만 세면 한쪽(예: 엔딩)이 실명을 그대로 노출해도
    // 다른 쪽(칭호)의 ???가 이를 가려 테스트가 조용히 통과해버린다.
    expect(screen.getAllByText('???')).toHaveLength(ENDINGS.length + TITLES.length)
    for (const e of ENDINGS) expect(screen.queryByText(e.name)).toBeNull()
    for (const t of TITLES) expect(screen.queryByText(t.name)).toBeNull()
  })
  it('수집한 엔딩은 이름이 보인다', () => {
    useGame.setState({ codex: { endings: ['super'], titles: ['박대박을 이긴'], bestAssets: 700_000_000, runs: 1 } })
    render(<CodexScreen />)
    expect(screen.getByText('슈퍼개미')).toBeDefined()
    expect(screen.getByText(/1회/)).toBeDefined()
  })
})

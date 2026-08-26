import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { EventModal } from './EventModal'
import { CutsceneView } from './CutsceneView'
import { EndingView } from './EndingView'
import { PrologueView } from './PrologueView'
import { CodexScreen } from '../screens/CodexScreen'
import { HomeScreen } from '../screens/HomeScreen'
import { useGame, SAVE_KEY, SAVE_VERSION } from '../store/store'
import { loadEvents, ENDINGS, TITLES } from '@bb/core'
import { pinSlots } from '../testkit'

// 카드 목록이 슬롯에서 나오므로(Task 6) 테스트가 클릭할 카드를 매 판 꽂아 둔다.
beforeEach(() => {
  localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1)
  pinSlots(['overtime', 'analyze', 'news'])
})

describe('오버레이 max-width (리뷰 M-5)', () => {
  // jsdom은 실제 CSS를 계산하지 않으므로(MarketScreen.test.tsx의 터치 타깃 검증과 동일한
  // 이유), index.css 소스에서 .overlay 규칙 블록을 직접 파싱해 고정한다. 넓은 화면
  // (데스크톱 등 480px보다 큰 뷰포트)에서 오버레이 반투명 배경이 앱 본체(.app,
  // max-width:480px)보다 넓게 퍼지지 않는지를 보장한다.
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
  const css = readFileSync(cssPath, 'utf-8')
  const overlayBlock = css.match(/(?:^|\n)\.overlay\s*\{[^}]*\}/)?.[0] ?? ''

  it('.overlay 규칙이 index.css에 존재한다', () => {
    expect(overlayBlock).not.toBe('')
  })
  it('.overlay는 앱 본체와 같은 max-width: 480px로 제한된다', () => {
    expect(overlayBlock).toMatch(/max-width:\s*480px/)
  })
})

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
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getAllByTestId(/^choice-/)[0]!)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(false)
  })
  it('선택지가 없는 이벤트는 "확인" 버튼 하나만 뜨고, 누르면 대기열이 빈다 (리뷰 M-4)', () => {
    // drawEvents(engine.ts)는 choices가 있는 이벤트만 pendingChoices에 넣으므로 정상
    // 플레이에서는 선택지 없는 이벤트가 여기까지 오지 않는다. 그래도 EventModal의
    // `(def.choices ?? [{ label: '확인', effects: [] }])` 폴백은 방어 코드로 존재하고,
    // 실제 콘텐츠 데이터에 choices 필드가 없는 이벤트가 있으므로(p_alone_dinner 등)
    // 그 데이터로 폴백 경로를 직접 고정한다.
    const ev = loadEvents().find(e => !e.choices)!
    expect(ev).toBeDefined()
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
    render(<EventModal />)
    expect(screen.getByText(ev.text.title)).toBeDefined()
    const buttons = screen.getAllByTestId(/^choice-/)
    expect(buttons).toHaveLength(1)
    expect(buttons[0]!.textContent).toBe('확인')
    fireEvent.click(buttons[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(0)
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
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: withCutscene }))
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
    // 리뷰 Major B-1 수정으로 엔딩 아트(svg)에도 한국어 엔딩명이 그려지므로,
    // 텍스트만으로 찾으면 svg의 <text>와 <h2>가 둘 다 걸려 모호해진다.
    // h2로 좁혀 "엔딩명이 제목으로 보인다"는 원래 취지를 유지한다.
    expect(screen.getByRole('heading', { name: '슈퍼개미' })).toBeDefined()
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
    // Task 16 — 수집한 엔딩의 도장 그래픽(<Art id="ending.*">, §5.1)이 svg 안에도 같은
    // 한국어 이름을 그린다(EndingView와 같은 이유, art/parts/Scenes.tsx의
    // data-role="label"). 그 svg 텍스트와 목록 항목의 이름 텍스트가 한 행 안에 함께
    // 있어 getByText로는 행으로 좁혀도 여전히 모호하므로(둘 다 걸린다), EndingView
    // 테스트가 h2로 좁힌 것과 같은 취지로 이름을 표시하는 실제 엘리먼트(strong)를
    // 직접 짚어 "이름이 보인다"는 원래 취지를 유지한다.
    const row = screen.getByTestId('codex-ending-super')
    expect(row.querySelector('strong')?.textContent).toBe('슈퍼개미')
    expect(screen.getByText(/1회/)).toBeDefined()
  })
})

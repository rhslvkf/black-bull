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
import { loadEvents, ENDINGS, TITLES, type EventDef } from '@bb/core'
import { pinSlots } from '../testkit'
import { renderEvent, currentState } from '../testUtils'
import { matchMediaMock } from '../design/testUtils'
import { ALL_ART_KEYS } from '../art/registry'

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

// Task 18 — EventModal의 VN 합성(§4.1: 제목 배너 + 배경 레이어 + 화자 스탠딩/시황 아트 +
// 대화창). 브리프 Step 1의 실패 테스트를 Ruling 18(jest-dom 없음 → 순수 DOM)·Ruling 19
// (renderEvent 헬퍼)에 맞춰 옮긴다. 검사 내용 자체는 브리프와 동일하다.
describe('EventModal VN (Task 18)', () => {
  it('화자가 있으면 초상화 슬롯을 그린다', () => {
    renderEvent({ id: 's_kim_offer', speaker: 'kim' })
    expect(screen.getByTestId('speaker-portrait').getAttribute('data-art-id')).toBe('npc.kim.normal')
  })

  it('화자가 없으면 초상화 대신 섹터/시황 아트가 나온다', () => {
    renderEvent({ id: 'n_fx_1400', speaker: undefined })
    expect(screen.queryByTestId('speaker-portrait')).toBeNull()
    expect(() => screen.getByTestId('event-visual')).not.toThrow()
  })

  it('제목 배너가 이벤트 제목을 보여준다', () => {
    renderEvent({ id: 's_kim_offer', title: '낯이 익은 사람' })
    expect(screen.getByTestId('event-title').textContent).toBe('낯이 익은 사람')
  })

  it('배경 슬롯이 함께 그려진다', () => {
    renderEvent({ id: 's_kim_offer', speaker: 'kim' })
    expect(screen.getByTestId('event-bg').getAttribute('data-slot-kind')).toBe('background')
  })

  // MU6 — 이 태스크의 핵심 함정(Task 17 리뷰가 남긴 경고). EventDef.text.speaker는 npc
  // **id**('kim')로 온다. speakerDisplayName 변환을 빼먹고 id를 그대로 DialogueBox에
  // 넘기면 크래시 없이 --speaker-unknown(회색)으로 조용히 떨어지고, 이름표에는 'kim'이
  // 영문 그대로 뜬다 — 이 테스트는 정확히 그 변환이 실제로 일어나는지를 고정한다.
  it('이름표에는 npc id가 아니라 변환된 한국어 표시 이름이 뜬다 (MU6)', () => {
    renderEvent({ id: 's_kim_offer', speaker: 'kim' })
    expect(screen.getByTestId('speaker-tag').textContent).toBe('김실장')
  })

  // MU7 — 이벤트 종류(회사·시황·개인·사회·스토리)에 따라 실제로 다른 배경이 나오는지.
  // 배경 아트(bg.*)는 registry.tsx가 svg role="img"에 "배경: <지명>" aria-label을 박아
  // 두므로(전역 검색이 아니라 event-bg 안으로 좁힌 선택자로) 그 라벨을 관찰창으로 쓴다.
  it('이벤트 종류에 따라 다른 배경이 나온다 (MU7)', () => {
    const bgLabelFor = (category: EventDef['category']): string | null => {
      const { unmount } = renderEvent({ id: `cat-${category}`, category })
      const label = screen.getByTestId('event-bg').querySelector('svg[role="img"]')?.getAttribute('aria-label') ?? null
      unmount()
      return label
    }
    const byCategory: Record<EventDef['category'], string | null> = {
      news: bgLabelFor('news'),
      company: bgLabelFor('company'),
      personal: bgLabelFor('personal'),
      social: bgLabelFor('social'),
      story: bgLabelFor('story'),
    }
    expect(byCategory.news).toBe('배경: 거래소')
    expect(byCategory.company).toBe('배경: 사무실')
    expect(byCategory.personal).toBe('배경: 집')
    expect(byCategory.social).toBe('배경: 거리')
    expect(byCategory.story).toBe('배경: 거래소')
    // 5개 카테고리가 실제로 4종 배경 중 하나 이상씩 서로 다르게 갈리는지 — 단일 배경
    // 하드코딩(모든 값이 같음)을 직접 배제한다.
    expect(new Set(Object.values(byCategory)).size).toBeGreaterThan(1)
  })

  // MU8 — <ArtSlot> 대신 <Art>를 직접 쓰면 Task 10의 폴백 레이어(data-fallback)가
  // 사라진다. speaker-portrait·event-bg 둘 다 ArtSlot이 그리는 내부 래퍼를 갖고 있는지
  // 직접 확인한다(전체 텍스트가 아니라 각 슬롯 내부로 선택자를 좁혔다).
  it('초상화·배경 슬롯이 ArtSlot의 폴백 레이어를 통해 그려진다 (MU8)', () => {
    renderEvent({ id: 's_kim_offer', speaker: 'kim' })
    expect(screen.getByTestId('speaker-portrait').querySelector('[data-fallback]')).not.toBeNull()
    expect(screen.getByTestId('event-bg').querySelector('[data-fallback]')).not.toBeNull()
  })

  // MU9 — 선택지가 없는(=원래 "확인" 버튼 하나뿐인) 이벤트에서, 대화창을 탭해 대사를
  // 다 읽었다는 신호를 주면 그 자체가 이벤트를 닫아야 한다. 안 닫히면 대화창만 뜬 채
  // 진행이 멈춘다.
  it('선택지가 없는 이벤트는 대화창을 탭하면 닫힌다 (MU9)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true) // 탭 한 번에 곧장 done이 되도록
    renderEvent({ id: 'ev_solo', body: '짧은 본문' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(currentState().pendingChoices).toHaveLength(0)
  })

  // MU9-보강 — 실제 선택지가 있는 이벤트는 대화창 탭이 아무 선택도 대신 확정하면 안
  // 된다(사용자가 아래 선택지에서 직접 골라야 한다). 5번 확인 항목 — "선택지가 떠
  // 있을 때 대화창 탭이 무슨 일을 하는지": 스킵/포커스 이동 외에는 아무 일도 안
  // 한다(대기열 그대로, 선택지도 그대로 남는다) — Task 19가 하단 시트로 분리하기
  // 전까지는 안전하다.
  it('선택지가 있는 이벤트는 대화창을 탭해도 자동으로 닫히지 않는다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderEvent({ id: 'ev_multi', choices: [{ label: 'A', effects: [] }, { label: 'B', effects: [] }] })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(currentState().pendingChoices).toHaveLength(1)
    expect(screen.getAllByTestId(/^choice-/)).toHaveLength(2)
  })

  // MU10 — 타이핑이 끝나기 전의 첫 탭은 스킵만 해야 한다. 곧장 이벤트가 닫히면
  // 대사를 읽을 수 없다. reduced-motion을 켜지 않아 실제로 타이핑 중인 상태에서 검증한다.
  it('타이핑이 끝나기 전에 탭해도 이벤트가 닫히지 않는다 (MU10)', () => {
    renderEvent({ id: 'ev_solo_typing', body: '아주 긴 본문입니다. '.repeat(10) })
    expect(screen.getByTestId('dialogue-text').textContent).not.toBe('아주 긴 본문입니다. '.repeat(10))
    fireEvent.click(screen.getByTestId('dialogue-box')) // 첫 탭 = 스킵만
    expect(currentState().pendingChoices).toHaveLength(1)
  })

  // MU11 — npc.*.alt 무드 사용 여부. EventDef에는 이벤트별로 어떤 무드(normal/alt)를
  // 써야 하는지 알려주는 필드가 없다(§4.1도 이 태스크에 무드 전환 규칙을 요구하지
  // 않는다) — 그래서 지금은 항상 normal을 쓴다. alt 8종은 만들어져 있지만(§5) 이를
  // 소비할 조건이 아직 콘텐츠 스키마에 없으므로, "항상 normal"이 버그가 아니라 현재
  // 상태임을 여기서 직접 고정한다(향후 태스크가 조건을 추가하면 이 테스트를 갱신한다).
  it('현재는 화자 초상에 항상 normal 무드를 쓴다 — alt를 트리거할 데이터 필드가 없다 (MU11)', () => {
    for (const speaker of ['daebak', 'cho', 'kim', 'mom']) {
      const { unmount } = renderEvent({ id: `mood-${speaker}`, speaker })
      expect(screen.getByTestId('speaker-portrait').getAttribute('data-art-id')).toBe(`npc.${speaker}.normal`)
      unmount()
    }
  })

  // MU12 — 전역 제약 "터치 타깃 44px 이상". 44는 계획서 요구값이지 구현 상수가 아니므로
  // (DialogueBox.test.tsx의 로그 토글 검증과 같은 방식으로) 테스트 안에 리터럴로 못박는다.
  // 선택지 버튼은 index.css의 .choices button 규칙(외부 스타일시트)에서 오므로, jsdom이
  // 실제로 계산하지 않는 레이아웃 대신 오버레이 max-width 테스트(파일 상단)와 같은 방식
  // 으로 소스를 직접 파싱한다.
  describe('선택지 버튼의 터치 타깃이 44px 이상이다 (Global Constraints, MU12)', () => {
    const cssPath2 = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
    const css2 = readFileSync(cssPath2, 'utf-8')
    const choicesButtonRule = css2.match(/(?:^|\n)\.choices button\s*\{[^}]*\}/)?.[0] ?? ''

    it('.choices button 규칙의 min-height가 44px 이상이다', () => {
      const MIN_TOUCH_TARGET_PX = 44
      expect(choicesButtonRule).not.toBe('')
      const m = choicesButtonRule.match(/min-height:\s*([\d.]+)px/)
      expect(m, `.choices button 규칙에 min-height가 없다: "${choicesButtonRule}"`).not.toBeNull()
      expect(parseFloat(m![1]!)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    })
  })

  // 전수 검사 — loadEvents()의 실제 콘텐츠 전부를 대기 이벤트로 띄워, 화자·배경·아트
  // 키가 전부 유효한지 확인한다(브리프 "추가로 확인할 것"). 존재하지 않는 아트 키를
  // 가리키면 Art.tsx가 조용히 null을 반환해 폴백 없이 빈 자리가 되므로, 각 슬롯 안에
  // 실제로 svg(또는 이미지)가 그려졌는지까지 확인해야 그 실패를 잡는다.
  describe('실제 콘텐츠 카탈로그 전수 검사', () => {
    it('loadEvents()의 모든 이벤트가 화자/배경/시황 슬롯을 깨짐 없이 그린다', () => {
      const events = loadEvents()
      expect(events.length).toBeGreaterThan(0)
      for (const ev of events) {
        const s = currentState()
        useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
        const { unmount } = render(<EventModal />)

        const bgArt = screen.getByTestId('event-bg').querySelector('svg[role="img"], img')
        expect(bgArt, `${ev.id}: 배경 아트가 비어 있다`).not.toBeNull()

        if (ev.text.speaker) {
          const portrait = screen.getByTestId('speaker-portrait')
          const artId = portrait.getAttribute('data-art-id')
          expect(artId, `${ev.id}: 초상화 아트 키가 없다`).toBe(`npc.${ev.text.speaker}.normal`)
          expect(ALL_ART_KEYS, `${ev.id}: ${artId}가 알려진 아트 키가 아니다`).toContain(artId)
          expect(portrait.querySelector('svg[role="img"], img'), `${ev.id}: 초상화가 비어 있다`).not.toBeNull()
          expect(screen.queryByTestId('event-visual'), `${ev.id}: 화자가 있는데 시황 아트도 함께 떴다`).toBeNull()
        } else {
          const visual = screen.getByTestId('event-visual')
          expect(visual.querySelector('svg[role="img"], img'), `${ev.id}: 시황 아트가 비어 있다`).not.toBeNull()
          expect(screen.queryByTestId('speaker-portrait'), `${ev.id}: 화자가 없는데 초상화도 함께 떴다`).toBeNull()
        }

        unmount()
      }
    })
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

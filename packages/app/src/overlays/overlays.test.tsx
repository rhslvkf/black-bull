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
import { loadEvents, ENDINGS, TITLES, TIER_NAMES, type EventDef } from '@bb/core'
import { pinSlots } from '../testkit'
import { renderEvent, renderWithState, currentState, renderEnding } from '../testUtils'
import { matchMediaMock } from '../design/testUtils'
import { ALL_ART_KEYS } from '../art/registry'
import { PROMOTE_TIERS, DEMOTE_TIERS } from '../art/keys'

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

// 리뷰 Fix Round 1(Critical 1) — §0·§4.3은 프롤로그·컷신을 "장면"으로 규정한다. 장면은
// 화면을 온전히 차지해야지, 게임 화면 위에 얹힌 반투명 레이어여서는 안 된다(진짜
// 모달인 EventModal은 `.overlay`의 반투명 배경을 그대로 써도 된다 — 그래서 이 검사는
// `.overlay` 자체가 아니라 `.overlay.prologue`·`.overlay.cutscene[data-tone=...]`처럼
// 더 구체적인 선택자로 좁힌 규칙만 본다). jsdom은 실제 합성 결과를 계산하지 않으므로
// (Ruling 20과 같은 이유) index.css 소스에서 이 세 규칙 블록을 직접 파싱해, 알파
// 채널(rgba(...)의 네 번째 인자, 또는 별도 opacity 속성)을 전혀 쓰지 않는지 고정한다.
// alpha를 다시 올리는 방향의 회귀(1차 수정이 그랬듯 rgba(..., .96) 등)를 여기서 잡는다.
describe('프롤로그·컷신은 완전 불투명 장면이다 (Critical 1 Fix Round 1)', () => {
  const cssPathOpaque = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
  const cssOpaque = readFileSync(cssPathOpaque, 'utf-8')
  const prologueBgRule = cssOpaque.match(/\.overlay\.prologue\s*\{[^}]*\}/)?.[0] ?? ''
  const cutscenePromoteBgRule = cssOpaque.match(/\.overlay\.cutscene\[data-tone="up"\]\s*\{[^}]*\}/)?.[0] ?? ''
  const cutsceneDemoteBgRule = cssOpaque.match(/\.overlay\.cutscene\[data-tone="down"\]\s*\{[^}]*\}/)?.[0] ?? ''

  it('세 규칙이 전부 index.css에 존재한다', () => {
    expect(prologueBgRule, '.overlay.prologue 규칙을 못 찾았다').not.toBe('')
    expect(cutscenePromoteBgRule, '.overlay.cutscene[data-tone="up"] 규칙을 못 찾았다').not.toBe('')
    expect(cutsceneDemoteBgRule, '.overlay.cutscene[data-tone="down"] 규칙을 못 찾았다').not.toBe('')
  })

  it('세 규칙 모두 알파 채널(rgba/opacity)을 전혀 쓰지 않는다', () => {
    for (const rule of [prologueBgRule, cutscenePromoteBgRule, cutsceneDemoteBgRule]) {
      expect(rule, `알파가 섞인 rgba(...)를 쓰고 있다: "${rule}"`).not.toMatch(/rgba\(/)
      // Task 22 MU13 재검토 — `/opacity\s*:/`(속성 선언 형태)만 보면
      // `transition: opacity 200ms`처럼 opacity를 트랜지션 대상으로만 얹는 우회를
      // 놓친다(EndingView.test.tsx에서 실측). "opacity"라는 단어 자체가 이 규칙
      // 블록에 전혀 나오지 않아야 한다.
      expect(rule, `opacity가 이 블록 안에 언급돼 있다(트랜지션 대상 포함): "${rule}"`).not.toMatch(/opacity/)
    }
  })
})

describe('EventModal', () => {
  it('대기 중인 선택지가 없으면 아무것도 안 그린다', () => {
    const { container } = render(<EventModal />)
    expect(container.firstChild).toBeNull()
  })
  // Task 19 — 선택지가 하단 시트로 옮겨간 뒤로는 대사를 다 읽어야만(§4.2) choice-*
  // 버튼이 뜬다. 아래 EventModal 기본 스위트는 "선택 자체가 대기열을 정확히 비우는지"
  // 만 보는 테스트라 대화창 타이핑 자체는 관심사가 아니므로, reduced-motion으로 매
  // 이벤트가 마운트 즉시 다 읽힌 것으로 만들어 시트를 곧장 연다 — MU9(하단 시트의
  // reduced-motion 존중) 자체의 고정은 별도로 ChoiceSheet.test.tsx가 맡는다.
  // 정규식도 `choice-sheet`(시트 컨테이너 자신의 testid)까지 잘못 걸리지 않도록
  // `\d+$`로 좁힌다 — choice-N 버튼만 골라야 한다.
  it('선택지를 렌더하고 고르면 대기열이 빈다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const ev = loadEvents().find(e => (e.choices?.length ?? 0) >= 2)!
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
    render(<EventModal />)
    expect(screen.getByText(ev.text.title)).toBeDefined()
    expect(screen.getByTestId('choice-sheet')).toBeDefined()
    expect(screen.getAllByTestId(/^choice-\d+$/)).toHaveLength(ev.choices!.length)
    fireEvent.click(screen.getAllByTestId(/^choice-\d+$/)[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(0)
  })
  it('여러 선택지가 대기 중이면 순서대로 전부 해소된다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const evs = loadEvents().filter(e => (e.choices?.length ?? 0) >= 2).slice(0, 2)
    expect(evs).toHaveLength(2)
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: evs.map(e => ({ eventId: e.id })) } })
    render(<EventModal />)
    expect(screen.getByText(evs[0]!.text.title)).toBeDefined()
    fireEvent.click(screen.getAllByTestId(/^choice-\d+$/)[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(1)
    expect(useGame.getState().state!.pendingChoices[0]!.eventId).toBe(evs[1]!.id)
    expect(screen.getByText(evs[1]!.text.title)).toBeDefined()
    fireEvent.click(screen.getAllByTestId(/^choice-\d+$/)[0]!)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(0)
  })
  it('선택지를 고르면 홈 화면의 한 주 넘기기가 다시 활성화된다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const ev = loadEvents().find(e => (e.choices?.length ?? 0) >= 2)!
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
    render(<><HomeScreen /><EventModal /></>)
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getAllByTestId(/^choice-\d+$/)[0]!)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(false)
  })
  // Task 19 재검토 — 이전(리뷰 M-4)에는 선택지가 없는 이벤트에 EventModal이 방어적으로
  // "확인" 버튼 하나짜리 폴백 목록을 그렸다. 이제 그 폴백을 없앴다: 선택지가 없는
  // 이벤트는 애초에 ChoiceSheet를 전혀 렌더하지 않고, 대화창 탭 자체가 유일한 진행
  // 수단이다(Task 18이 넘긴 분기 — "선택지 없음 vs 있음" 둘로 충분하다는 재검토 결론,
  // EventModal.tsx의 handleDialogueAdvance 주석 참고). 그 새 계약을 여기서 고정한다.
  it('선택지가 없는 이벤트는 시트가 전혀 뜨지 않고, 대화창 탭이 대기열을 비운다 (Task 19 재검토, 구 리뷰 M-4)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const ev = loadEvents().find(e => !e.choices)!
    expect(ev).toBeDefined()
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
    render(<EventModal />)
    expect(screen.getByText(ev.text.title)).toBeDefined()
    expect(screen.queryByTestId('choice-sheet')).toBeNull()
    expect(screen.queryAllByTestId(/^choice-\d+$/)).toHaveLength(0)
    fireEvent.click(screen.getByTestId('dialogue-box'))
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
  // 한다(대기열 그대로, 선택지도 그대로 남는다) — Task 19가 실제로 하단 시트로
  // 분리했고, 이 테스트가 그 계약을 고정한다.
  it('선택지가 있는 이벤트는 대화창을 탭해도 자동으로 닫히지 않는다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderEvent({ id: 'ev_multi', choices: [{ label: 'A', effects: [] }, { label: 'B', effects: [] }] })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(currentState().pendingChoices).toHaveLength(1)
    expect(screen.getAllByTestId(/^choice-\d+$/)).toHaveLength(2)
  })

  // MU11(브리프) — Task 17이 넘긴 방어("선택지 대기 중 대화창 탭 비활성화"). reduced-motion
  // 이라 마운트 즉시 대사가 끝나 시트가 이미 열려 있는 상태에서, 대화창을 한 번 더
  // 탭해도(=시트가 열려 있는 동안의 탭) 대기열도 시트도 그대로여야 한다 — 탭이 실수로
  // choose를 대신 확정하면 사용자가 고른 적 없는 선택이 적용되는 최악의 버그다.
  it('시트가 열려 있는 동안 대화창을 또 탭해도 대기열이 바뀌지 않는다 (MU11)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderEvent({ id: 'ev_multi_open', choices: [{ label: 'A', effects: [{ type: 'cash', delta: -1 }] }, { label: 'B', effects: [] }] })
    expect(screen.getByTestId('choice-sheet')).toBeDefined() // 전제 확인 — 이미 열려 있다.
    const before = currentState().player.cash
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(currentState().pendingChoices).toHaveLength(1)
    expect(currentState().player.cash).toBe(before)
    expect(screen.getByTestId('choice-sheet')).toBeDefined()
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
  // Task 19부터 선택지 버튼은 index.css의 .choice-sheet-list button 규칙(외부
  // 스타일시트)에서 온다 — jsdom이 실제로 계산하지 않는 레이아웃 대신 오버레이
  // max-width 테스트(파일 상단)와 같은 방식으로 소스를 직접 파싱한다. (ChoiceSheet.tsx
  // 자신도 같은 값을 인라인 style로 내려 컴포넌트 테스트에서 직접 실측한다 —
  // ChoiceSheet.test.tsx. 이 CSS 파싱은 그 값을 스타일시트에서도 이중으로 고정한다.)
  describe('선택지 버튼의 터치 타깃이 44px 이상이다 (Global Constraints, MU12)', () => {
    const cssPath2 = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
    const css2 = readFileSync(cssPath2, 'utf-8')
    const choicesButtonRule = css2.match(/(?:^|\n)\.choice-sheet-list button\s*\{[^}]*\}/)?.[0] ?? ''

    it('.choice-sheet-list button 규칙의 min-height가 44px 이상이다', () => {
      const MIN_TOUCH_TARGET_PX = 44
      expect(choicesButtonRule).not.toBe('')
      const m = choicesButtonRule.match(/min-height:\s*([\d.]+)px/)
      expect(m, `.choice-sheet-list button 규칙에 min-height가 없다: "${choicesButtonRule}"`).not.toBeNull()
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
      // Fix Round 2 — Fix Round 1의 `visited` 카운터는 자기충족적이었다: 루프를
      // `events.slice(0, 1)`로 줄이면서 동시에 `visited`를 `events.length`로 직접
      // 대입하는 "결합 공격"을 리뷰가 실제로 적용해 515/515를 그대로 통과시켰다 —
      // 숫자 하나는 루프가 실제로 무엇을 처리했는지와 손쉽게 분리될 수 있다.
      // 카운터 대신 "루프 안에서 실제로 검사한 이벤트 id"를 Set으로 모아, 끝에서
      // `loadEvents()`의 전체 id 집합과 정확히 같은지 비교한다 — id 하나라도
      // 건너뛰면(또는 중복 검사로 다른 id가 통째로 빠지면) 두 집합이 달라져 잡힌다.
      // 하드코딩한 76을 박지 않고 `events`에서 그대로 유도했으므로 콘텐츠가 늘어도
      // 자동으로 따라간다.
      const expectedIds = new Set(events.map(e => e.id))
      // Fix Round 2(재리뷰) — Set만으로는 아직 뚫린다: `visitedIds`를 선언 시점에
      // 전체 id로 미리 채워 넣고(padding) 루프를 `events.slice(0, 1)`로 줄이면,
      // `Set.add`가 이미 있는 id를 다시 넣어도 크기가 그대로라 최종 비교가 우연히
      // 통과해버린다(리뷰가 실측한 결합 공격). 배열(`push`)은 중복을 넣어도 항상
      // 길이가 늘어나므로, 같은 방식으로 미리 채워 넣으면 길이가 어긋나 바로 잡힌다
      // — 그래서 실제로 검사한 id는 배열에 기록하고, 개수(length)와 내용(Set으로
      // 변환한 뒤 비교) 두 가지를 모두 `events`에서 그대로 유도한 값과 대조한다.
      // Fix Round 3(재재리뷰) — 배열 push도 완전히 안전하진 않았다: `visitedIds`를
      // 루프 "밖"에 별도로 선언해 두는 한, `events.slice(1)`(첫 번째만 뺀 나머지)로
      // 정교하게 미리 채우고 루프를 `events.slice(0, 1)`로 줄이면 push가 첫 번째 id
      // 하나만 더해도 length·Set 내용 둘 다 우연히 원본과 똑같아진다(실측: 여전히
      // green — "패딩 전체"가 아니라 "루프가 뺄 만큼만 정교하게 패딩"하는 결합
      // 공격에는 length 비교만으론 못 잡는다). 근본 원인은 "루프가 채우는 배열"이
      // 루프 진입 전에 독립적으로 선언·초기화될 수 있다는 데 있다 — 초기값을 건드릴
      // 자리가 존재하는 한 루프의 실제 실행 범위와 최종 배열 내용이 분리될 수 있다.
      // `events.map(...)`의 반환값 자체를 visitedIds로 쓰면 이 구멍이 구조적으로
      // 사라진다: 별도로 선언·미리 채워 넣을 자리가 아예 없고, 루프 범위를 줄이면
      // (`events.slice(0, 1).map(...)`) 결과 배열 길이도 그 자리에서 함께 줄어든다.
      const visitedIds = events.map(ev => {
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
        return ev.id
      })
      // 길이 검사가 슬라이스 공격을 잡는 핵심이다 — 개수 자체가 `loadEvents()`에서
      // 유도한 값과 정확히 같아야 한다(하드코딩 없음). visitedIds가 map의 반환값
      // 자체이므로 별도로 미리 채워 넣을 자리가 없다(Fix Round 3).
      expect(visitedIds.length).toBeGreaterThan(0)
      expect(visitedIds.length).toBe(events.length)
      // 내용도 실제로 맞는 id들인지 확인한다(순서 무관, 중복은 length 검사가 이미 배제).
      expect(new Set(visitedIds)).toEqual(expectedIds)
    })
  })

  // Task 19 전수 검사 — loadEvents()의 선택지 있는 이벤트(26종) 전부를 대기시켜 시트가
  // 정상적으로 열리고, 버튼 개수·라벨이 실제 choices 배열과 정확히 같은 순서로
  // 대응하는지 확인한다. Task 18과 같은 방식(visitedIds 배열을 loadEvents()에서
  // 유도한 전체 목록과 길이·내용으로 대조)을 따른다 — 카운터 하나만 세면 결합
  // 공격(패딩+slice)에 뚫린다는 게 이 리포의 반복 결함이었다.
  describe('선택지 하단 시트 전수 검사 (Task 19)', () => {
    it('선택지가 있는 모든 이벤트가 시트를 열고, 라벨이 인덱스 순서대로 정확히 대응하며, 각 인덱스를 골라도 대기열이 빈다', () => {
      matchMediaMock('(prefers-reduced-motion: reduce)', true) // 탭 없이 즉시 done → 매 이벤트 시트가 바로 뜨도록
      const eventsWithChoices = loadEvents().filter(e => (e.choices?.length ?? 0) > 0)
      expect(eventsWithChoices.length).toBeGreaterThan(0)
      const expectedIds = new Set(eventsWithChoices.map(e => e.id))

      // Fix Round 1(Minor 1, 재리뷰) — 배열 push도 "루프 밖에 별도로 선언된 변수"라는
      // 자리가 있는 한 완전히 안전하지 않다: `visitedIds`를 `eventsWithChoices.slice(1)`
      // (첫 번째만 뺀 나머지)로 정교하게 미리 채우고 루프를 `eventsWithChoices.slice(0, 1)`
      // 로 줄이면, push가 첫 번째 id 하나만 더해도 length·Set 내용 둘 다 원본과 우연히
      // 같아진다(실측: 540/540 green — 26개 중 1개만 실제로 검사됐는데도 안 잡힘).
      // Task 18(overlays.test.tsx "실제 콘텐츠 카탈로그 전수 검사")도 동일 구조라 똑같이
      // 뚫린다는 걸 같은 방식으로 실측 확인했다 — "Task 18은 이미 안전하다"는 재리뷰
      // 추정은 틀렸다. 두 테스트 모두 `events.map(...)`의 반환값 자체를 visitedIds로
      // 쓰는 방식으로 고쳤다 — 별도로 선언·미리 채워 넣을 자리가 아예 없어지므로, 루프
      // 범위를 줄이면(`eventsWithChoices.slice(0, 1).map(...)`) 결과 배열 길이도 그
      // 자리에서 함께 줄어든다.
      const visitedIds = eventsWithChoices.map(ev => {
        const choices = ev.choices!

        // 라벨·개수가 실제 choices와 인덱스별로 정확히 대응하는지(MU7·MU8 방어).
        {
          const s = useGame.getState().state!
          useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
          const { unmount } = render(<EventModal />)
          expect(screen.getByTestId('choice-sheet'), `${ev.id}: 시트가 안 열렸다`).toBeDefined()
          const buttons = screen.getAllByTestId(/^choice-\d+$/)
          expect(buttons.length, `${ev.id}: 선택지 개수가 안 맞는다`).toBe(choices.length)
          buttons.forEach((btn, i) => {
            expect(btn.textContent, `${ev.id}: choice-${i} 라벨이 choices[${i}]와 다르다`).toBe(choices[i]!.label)
          })
          unmount()
        }

        // 각 인덱스를 실제로 골라도 대기열이 정확히 비는지(마지막 인덱스까지 — 경계값도 확인).
        for (const idx of [0, choices.length - 1]) {
          const s = useGame.getState().state!
          useGame.setState({ state: { ...s, pendingChoices: [{ eventId: ev.id }] } })
          const { unmount } = render(<EventModal />)
          fireEvent.click(screen.getByTestId(`choice-${idx}`))
          expect(useGame.getState().state!.pendingChoices, `${ev.id}: choice-${idx} 선택 후 대기열이 안 비었다`).toHaveLength(0)
          unmount()
        }

        return ev.id
      })

      expect(visitedIds.length).toBeGreaterThan(0)
      expect(visitedIds.length).toBe(eventsWithChoices.length)
      expect(new Set(visitedIds)).toEqual(expectedIds)
    })
  })

  // Fix Round 1(Major) — 화자 초상이 배경 SVG의 지명 라벨(우하단)을 가리는 문제이 리뷰
  // 스크린샷으로 확인됐다("거리"→"ㅣ리"로 잘림). jsdom은 실제 CSS 레이아웃을 계산하지
  // 않으므로, index.css의 .speaker-portrait 좌표와 Backgrounds.tsx의 라벨 좌표를 소스
  // 그대로 읽어(인라인 좌표를 계산으로 확인하라는 리뷰 지시) 겹침이 구조적으로 불가능한지
  // 고정한다. 정확한 텍스트 폭은 잴 수 없으므로 "라벨은 오른쪽 절반에 있다"·"인물은
  // 왼쪽 절반을 벗어나지 않는다"는 더 보수적인 불변식으로 겹침을 원천 차단한다.
  describe('화자 초상이 배경 지명 라벨을 가리지 않는다 (Fix Round 1 Major)', () => {
    const cssPath3 = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
    const css3 = readFileSync(cssPath3, 'utf-8')
    const portraitRule = css3.match(/(?:^|\n)\.speaker-portrait\s*\{[^}]*\}/)?.[0] ?? ''

    const bgSrcPath = join(dirname(fileURLToPath(import.meta.url)), '../art/parts/Backgrounds.tsx')
    const bgSrc = readFileSync(bgSrcPath, 'utf-8')

    it('배경 라벨은 뷰박스 오른쪽 절반에 있다 (전제 확인)', () => {
      const viewBoxM = bgSrc.match(/viewBox="0 0 (\d+) (\d+)"/)
      const labelM = bgSrc.match(/data-role="label" x="(\d+)"/)
      expect(viewBoxM, 'Backgrounds.tsx의 viewBox를 못 찾았다').not.toBeNull()
      expect(labelM, 'Backgrounds.tsx의 라벨 x 좌표를 못 찾았다').not.toBeNull()
      const viewBoxWidth = Number(viewBoxM![1])
      const labelX = Number(labelM![1])
      const labelXPct = (labelX / viewBoxWidth) * 100
      expect(labelXPct).toBeGreaterThan(50)
    })

    it('.speaker-portrait의 오른쪽 경계는 무대 왼쪽 절반을 벗어나지 않는다', () => {
      expect(portraitRule).not.toBe('')
      const leftM = portraitRule.match(/left:\s*([\d.]+)%/)
      const widthM = portraitRule.match(/width:\s*([\d.]+)%/)
      expect(leftM, `.speaker-portrait에 left(%)가 없다: "${portraitRule}"`).not.toBeNull()
      expect(widthM, `.speaker-portrait에 width(%)가 없다: "${portraitRule}"`).not.toBeNull()
      const left = Number(leftM![1])
      const width = Number(widthM![1])
      const rightEdgePct = left + width
      // 라벨(오른쪽 절반, 실측 x=150/160≈93.75%) 쪽으로 침범할 여지를 아예 없앤다 —
      // 정확한 텍스트 폭 대신 "50% 지점 자체를 넘지 않는다"는 더 강한 불변식을 쓴다.
      expect(rightEdgePct).toBeLessThanOrEqual(50)
    })
  })

  // Fix Round 2(재리뷰) — object-fit이 어떤 테스트에도 안 걸리면 `contain`을 `fill`로
  // 바꿔도 아무도 모른다. 지금은 폴백 SVG가 `width:auto`라 비율이 저절로 맞아 화면상
  // 안 보이지만, Task 23이 실제 알파 이미지를 꽂고 max-width 클램프가 걸리면 그때
  // 인물이 찌그러진 채 표면화된다 — 미리 고정해 둔다. Ruling 20이 말하는 "인라인
  // 노출"은 var()처럼 jsdom이 못 읽는 값에 필요한 것이고, `contain`은 인스턴스마다
  // 안 바뀌는 상수 리터럴이라 소스(index.css) 하나만 읽으면 된다 — 값을 컴포넌트
  // 인라인 스타일에 다시 적어 두 곳에 두지 않는다(리뷰 지시).
  describe('초상 슬롯은 알파 이미지가 찌그러지지 않도록 object-fit: contain을 쓴다 (Fix Round 2)', () => {
    const cssPath4 = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
    const css4 = readFileSync(cssPath4, 'utf-8')
    const portraitArtRule = css4.match(/(?:^|\n)\.speaker-portrait-art \.art-slot-content\s*\{[^}]*\}/)?.[0] ?? ''

    it('.speaker-portrait-art .art-slot-content 규칙이 존재하고 object-fit: contain이다', () => {
      expect(portraitArtRule, 'index.css에서 .speaker-portrait-art .art-slot-content 규칙을 못 찾았다').not.toBe('')
      expect(portraitArtRule).toMatch(/object-fit:\s*contain/)
    })
  })
})

// Task 20 — 컷신을 VN 문법(DialogueBox 나레이션 + 아트 스테이지 + 제목 배너)으로 맞춘다.
// 브리프 Step 1의 실패 테스트를 Ruling 18(jest-dom 없음 → 순수 DOM)에 맞춰 옮긴다.
// 검사 내용 자체는 브리프와 동일하다.
describe('CutsceneView', () => {
  it('cutscene이 없으면 안 뜬다', () => {
    expect(render(<CutsceneView />).container.firstChild).toBeNull()
  })

  it('승급 컷신이 새 티어 이름을 보여준다 (브리프 Step 1)', () => {
    renderWithState({ cutscene: 'cutscene.promote.2', player: { tier: 2 } }, <CutsceneView />)
    expect(screen.getByTestId('cutscene-title').textContent).toBe('불개미')
  })

  // MU1/MU2 — 브리프의 '불개미'는 하드코딩 문자열이지만, 여기서는 실제 core 상수
  // (@bb/core의 TIER_NAMES, app이 복제할 수 없는 진짜 출처)와 직접 비교한다. app이
  // 티어 이름을 로컬로 다시 적으면(1차 개발의 반복 결함) 값이 우연히 같지 않은 한 잡힌다.
  it('제목은 app 로컬 문자열이 아니라 @bb/core의 TIER_NAMES에서 나온다 (MU1·MU2)', () => {
    renderWithState({ cutscene: 'cutscene.demote.3', player: { tier: 3 } }, <CutsceneView />)
    expect(screen.getByTestId('cutscene-title').textContent).toBe(TIER_NAMES[3])
  })

  it('강등 컷신은 승급과 다른 톤이다 (브리프 Step 1)', () => {
    const toneOf = (k: string): string | null => {
      const { unmount } = renderWithState({ cutscene: k }, <CutsceneView />)
      const t = screen.getByTestId('cutscene').getAttribute('data-tone')
      unmount()
      return t
    }
    expect(toneOf('cutscene.promote.2')).not.toBe(toneOf('cutscene.demote.1'))
  })

  // MU3/MU4 — "다르다"만 보면 톤이 통째로 뒤바뀌어도(승급에 강등 톤을 붙여도) 통과한다.
  // 각 방향의 정확한 톤 값까지 고정해 스왑을 직접 잡는다.
  it('승급 톤은 up, 강등 톤은 down으로 고정된다 (MU3·MU4)', () => {
    const { unmount: u1 } = renderWithState({ cutscene: 'cutscene.promote.3' }, <CutsceneView />)
    expect(screen.getByTestId('cutscene').getAttribute('data-tone')).toBe('up')
    u1()
    const { unmount: u2 } = renderWithState({ cutscene: 'cutscene.demote.2' }, <CutsceneView />)
    expect(screen.getByTestId('cutscene').getAttribute('data-tone')).toBe('down')
    u2()
  })

  it('닫으면 다시 뜨지 않는다 (브리프 Step 1)', () => {
    renderWithState({ cutscene: 'cutscene.promote.2' }, <CutsceneView />)
    fireEvent.click(screen.getByTestId('cutscene-close'))
    expect(currentState().cutscene).toBeNull()
  })

  // MU5 — 닫기가 store의 clearCutscene(실제 저장 경로)을 거치지 않으면 새로고침마다
  // 컷신이 다시 뜬다. useGame.setState()로 직접 바꾸면 writeSave를 건너뛰므로, 실제
  // 저장 파일 포맷 그대로 localStorage에 써서 store가 그것을 읽어들이게 한다.
  it('컷신을 닫으면 새로고침해도 다시 뜨지 않는다 (MU5)', () => {
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

  // MU12 — 전역 제약 "prefers-reduced-motion 존중"(§6). CutsceneView.tsx가 인라인
  // style(animation)로 재생/생략을 결정하므로(ChoiceSheet.tsx와 같은 기법, Ruling 20)
  // jsdom에서도 직접 실측할 수 있다.
  //
  // Task 22 — 애니메이션 대상이 바깥 `cutscene`(불투명 장면 배경)에서 안쪽
  // `cutscene-content`(내용) 래퍼로 옮겨졌다(index.css의 `.cutscene-content` 주석,
  // CutsceneView.tsx 주석 참고) — 불투명 장면 불변식(Ruling 28)과 §6 크로스페이드
  // 요구가 충돌해, 불변식을 우선하기 위한 조정이다. 검사 내용(reduced-motion이면
  // 없다 / 아니면 걸린다)은 그대로이고, 대상 요소만 바로잡는다.
  it('prefers-reduced-motion이면 크로스페이드 애니메이션이 없다 (MU12)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ cutscene: 'cutscene.promote.1' }, <CutsceneView />)
    expect(screen.getByTestId('cutscene-content').style.animation).toBe('none')
  })
  it('모션을 허용하면 컷신 크로스페이드 애니메이션이 걸린다', () => {
    renderWithState({ cutscene: 'cutscene.promote.1' }, <CutsceneView />)
    expect(screen.getByTestId('cutscene-content').style.animation).toContain('cutscene-crossfade')
  })

  // Task 22 — 위 두 테스트를 "안쪽 래퍼"로 옮긴 대칭으로, 바깥(불투명 장면 배경 자체인
  // `cutscene`)에는 어떤 모션 상황에서도 애니메이션이 걸리면 안 된다는 것을 직접
  // 고정한다. CSS 소스 텍스트 파싱(위 "완전 불투명 장면이다" describe)은 인라인
  // style을 보지 못하므로(Task 21 재리뷰 MU-B) 이 런타임 검사가 그 구멍을 메운다 —
  // 누군가 크로스페이드를 다시 바깥 요소로 옮기면(과거 실제로 그랬던 코드) 여기서
  // 즉시 잡힌다.
  it('불투명 장면 배경(cutscene) 자체는 어떤 모션 설정에서도 애니메이션이 걸리지 않는다 (오버레이 불투명 불변식 우선)', () => {
    const first = renderWithState({ cutscene: 'cutscene.promote.1' }, <CutsceneView />)
    expect(screen.getByTestId('cutscene').style.animation).toBe('')
    first.unmount()

    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const second = renderWithState({ cutscene: 'cutscene.demote.2' }, <CutsceneView />)
    expect(screen.getByTestId('cutscene').style.animation).toBe('')
    second.unmount()
  })

  // MU13 — 전역 제약 "터치 타깃 44px 이상". 44는 계획서 요구값이지 구현 상수가 아니므로
  // (ChoiceSheet.test.tsx·DialogueBox.test.tsx와 같은 방식으로) 테스트 안에 리터럴로 못박는다.
  it('닫기 버튼의 터치 타깃이 44px 이상이다 (Global Constraints, MU13)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    renderWithState({ cutscene: 'cutscene.promote.1' }, <CutsceneView />)
    const btn = screen.getByTestId('cutscene-close')
    expect(parseFloat(btn.style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(btn.style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  // 전수 검사(브리프 "추가로 확인할 것") — PROMOTE_TIERS(1..5) + DEMOTE_TIERS(0..4) 10키
  // 전부를 렌더해 제목·톤·아트가 정상인지 확인한다. 수집은 `.map()` 반환값에서 유도한다
  // (overlays.test.tsx의 "실제 콘텐츠 카탈로그 전수 검사"가 겪은 결합 공격을 피하는
  // 같은 기법 — 사전 선언한 배열에 미리 채워 넣고 루프만 슬라이스하는 공격은 반환값
  // 자체를 쓰면 성립하지 않는다).
  describe('컷신 10키 전수 검사 (§5 PROMOTE_TIERS/DEMOTE_TIERS)', () => {
    it('승급 5종 + 강등 5종 전부가 올바른 제목·톤·아트로 그려진다', () => {
      const promoteKeys = PROMOTE_TIERS.map(t => `cutscene.promote.${t}`)
      const demoteKeys = DEMOTE_TIERS.map(t => `cutscene.demote.${t}`)
      const allKeys = [...promoteKeys, ...demoteKeys]
      expect(allKeys.length).toBe(10)

      const visited = allKeys.map(key => {
        const [, kind, tierStr] = key.split('.')
        const tier = Number(tierStr)
        const { unmount } = renderWithState({ cutscene: key }, <CutsceneView />)

        expect(screen.getByTestId('cutscene-title').textContent, `${key}: 제목이 틀렸다`).toBe(TIER_NAMES[tier])
        expect(screen.getByTestId('cutscene').getAttribute('data-tone'), `${key}: 톤이 틀렸다`)
          .toBe(kind === 'promote' ? 'up' : 'down')
        const art = screen.getByTestId('cutscene-stage').querySelector('svg[role="img"], img')
        expect(art, `${key}: 아트가 비어 있다`).not.toBeNull()
        expect(art?.getAttribute('aria-label'), `${key}: 아트 라벨이 안 맞는다`)
          .toBe(`${TIER_NAMES[tier]} ${kind === 'promote' ? '승급' : '강등'}`)

        unmount()
        return key
      })

      expect(visited.length).toBe(allKeys.length)
      expect(new Set(visited)).toEqual(new Set(allKeys))
    })

    // MU11 — 아트 키가 실제 cutscene.* 카탈로그에 없는 값으로 바뀌면(오타·잘못된 계산),
    // <Art>는 조용히 아무것도 그리지 않는다(존재하지 않는 id는 registry에 없다). 그
    // "조용한 빈 화면"이 폴백처럼 보이며 넘어가지 않는지를 직접 확인한다.
    it('존재하지 않는 컷신 키는 아트 없이 조용히 넘어가지 않고, 아트 자리가 비어 있다는 사실 자체를 관측할 수 있다 (MU11)', () => {
      // economy.ts의 settleTier는 '주린이'(티어 0)로는 절대 promote.0을 만들지 않는다
      // (PROMOTE_TIERS=[1..5]) — 그래서 registry.tsx에도 'cutscene.promote.0'이 없다.
      // 제목·톤은 정규식 파싱만으로 유도되므로 이 키에도 여전히 그려진다(방어적 표시) —
      // 하지만 아트는 registry에 없는 키라 비어 있어야 한다. "제목은 있는데 아트가
      // 없다"는 상태 자체가 관측 가능해야, 실제 구현이 유효하지 않은 키를 <Art>에 그대로
      // 흘려보내는 버그(=화면이 통째로 비어 아무것도 관측 못 하는 경우)와 구별된다.
      renderWithState({ cutscene: 'cutscene.promote.0' }, <CutsceneView />)
      expect(screen.getByTestId('cutscene-title').textContent).toBe(TIER_NAMES[0])
      expect(screen.getByTestId('cutscene-stage').querySelector('svg[role="img"], img')).toBeNull()
    })
  })
})

// Task 21 — 이모지 배지 카드에서 잔고증명서 형식으로 전면 재작성됐다. 브리프가
// 요구하는 문서 항목별 검증(예수금·수수료·낙폭·id 비노출·증권사명·계좌 마스킹 등)은
// EndingView.test.tsx·EndingView.legal.test.tsx가 전담한다 — 여기서는 "이 오버레이가
// 진행 중엔 안 뜨고, 실제 스토어 액션(다시 하기)과 맞물려 동작한다"만 남긴다.
describe('EndingView', () => {
  it('진행 중이면 안 뜬다', () => {
    expect(render(<EndingView />).container.firstChild).toBeNull()
  })
  it('엔딩명·칭호를 보여주고 다시 시작할 수 있다', () => {
    renderEnding({ endingId: 'super', titles: ['박대박을 이긴'], cash: 700_000_000 })
    expect(screen.getByTestId('ending-name').textContent).toBe('슈퍼개미')
    expect(screen.getByTestId('title-0').textContent).toBe('박대박을 이긴')
    expect(screen.getByTestId('doc-cash').textContent).toContain('700,000,000원')
    fireEvent.click(screen.getByTestId('restart'))
    expect(useGame.getState().state!.status).toBe('playing')
    expect(useGame.getState().state!.turn).toBe(1)
  })
})

// Task 20 — 프롤로그를 VN 문법(화자 초상 + DialogueBox)으로 맞춘다. 더 이상 `onDone` prop을
// 받지 않는다 — CutsceneView·EventModal과 같은 방식으로 스스로 스토어를 읽어 "지금
// 떠야 하는가"를 판단하고 스스로 닫는다(App.test.tsx의 goHome() 계약도 그대로 유지된다).
// 브리프 Step 1의 실패 테스트를 Ruling 18(jest-dom 없음 → 순수 DOM)에 맞춰 옮긴다.
describe('PrologueView', () => {
  it('화자 초상화와 대화창을 함께 그린다 (브리프 Step 1)', () => {
    renderWithState({}, <PrologueView />)
    expect(screen.getByTestId('speaker-portrait')).toBeDefined()
    expect(screen.getByTestId('dialogue-box')).toBeDefined()
  })

  it('건너뛰면 즉시 게임이 시작된다 (브리프 Step 1)', () => {
    renderWithState({}, <PrologueView />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    expect(screen.queryByTestId('prologue')).toBeNull()
  })

  // MU9 — 건너뛰기가 prologueDone을 세우지 않으면 새로고침(reset, App.test.tsx와 같은
  // 시뮬레이션)마다 프롤로그가 다시 뜬다. 브리프는 "화면에서 사라지는 것"만 보므로
  // (바로 위 테스트), 지속성 자체를 별도로 고정한다.
  it('건너뛰면 prologueDone이 스토어(localStorage)에 저장되어 새로고침해도 다시 뜨지 않는다 (MU9)', () => {
    renderWithState({}, <PrologueView />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    expect(useGame.getState().prologueDone).toBe(true)

    act(() => { useGame.getState().reset() }) // 새로고침 시뮬레이션: localStorage에서 다시 읽는다
    expect(useGame.getState().prologueDone).toBe(true)
    render(<PrologueView />)
    expect(screen.queryByTestId('prologue')).toBeNull()
  })

  // 프롤로그 조건이 아니면(이미 봤거나, 첫 판이 아니거나) 오버레이 자체가 없다 — App.tsx가
  // 더 이상 조건부로 마운트/언마운트하지 않고 항상 <PrologueView />를 렌더하므로, 이
  // 자기 판단 로직 자체를 직접 고정해야 한다.
  it('이미 본 판에서는(prologueDone) 아무것도 안 뜬다', () => {
    renderWithState({}, <PrologueView />, { prologueDone: true })
    expect(screen.queryByTestId('prologue')).toBeNull()
  })

  // MU10 — Task 17 리뷰가 지목한 함정과 동일: 화자가 있는 장면에서 speakerDisplayName을
  // 거치지 않고 npc id('daebak')를 그대로 넘기면, 이름표는 크래시 없이 영문 id 또는
  // 회색 '???'로 조용히 깨진다. 이름표에 실제로 변환된 한국어 표시 이름이 뜨는지 고정한다.
  it('화자가 있는 장면은 이름표에 npc id가 아니라 변환된 한국어 표시 이름이 뜬다 (MU10)', () => {
    renderWithState({}, <PrologueView />)
    expect(screen.getByTestId('speaker-tag').textContent).toBe('박대박')
  })

  // 나레이션 장면(화자 없음)은 이름표를 그리지 않는다 — DialogueBox의 speaker=null 규약
  // (design/speakers.ts 주석 "나레이션에 그대로 쓸 수 있다")을 실제로 쓰고 있는지 고정한다.
  it('나레이션 장면으로 넘어가면 이름표가 사라진다', () => {
    renderWithState({}, <PrologueView />)
    fireEvent.click(screen.getByTestId('prologue-next')) // 1번째(화자 있음) → 2번째(나레이션)
    expect(screen.queryByTestId('speaker-tag')).toBeNull()
  })

  it('마지막 장면까지 다음을 누르면 프롤로그가 사라지고 게임이 시작된다', () => {
    renderWithState({}, <PrologueView />)
    // 장면 개수를 이 테스트에 다시 하드코딩하지 않는다 — "prologue-next가 사라질 때까지"
    // 반복한다(무한 루프 방지용 상한만 넉넉히 둔다).
    for (let i = 0; i < 20 && screen.queryByTestId('prologue-next'); i++) {
      fireEvent.click(screen.getByTestId('prologue-next'))
    }
    expect(screen.queryByTestId('prologue')).toBeNull()
    expect(useGame.getState().prologueDone).toBe(true)
  })

  // MU13 — 전역 제약 "터치 타깃 44px 이상". 44는 계획서 요구값이지 구현 상수가 아니므로
  // 테스트 안에 리터럴로 못박는다.
  it('건너뛰기·다음 버튼의 터치 타깃이 44px 이상이다 (Global Constraints, MU13)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    renderWithState({}, <PrologueView />)
    expect(parseFloat(screen.getByTestId('prologue-skip').style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(screen.getByTestId('prologue-next').style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })
})

// 리뷰 Fix Round 1(Critical 2) — 브리프의 "화면 완결성" 검사(위)만으로는 장면이 통째로
// 사라지거나(4→3) 화자 없는 두 장면의 순서가 뒤바뀌어도 아무것도 못 잡는다(리뷰 실측:
// 556개 전부 통과했다). PrologueView의 SCENES를 그대로 import해 비교하면 자기충족
// (배열이 바뀌면 기대값도 같이 바뀐다)이라 절대 아무것도 못 잡으므로, 각 장면의
// 화자·본문을 여기 리터럴로 박아 실제 렌더 결과와 대조한다.
describe('프롤로그 서사 무결성 — 장면 개수·순서·화자 (Critical 2 Fix Round 1)', () => {
  const EXPECTED_SCENES: ReadonlyArray<{ speaker: string | null; text: string }> = [
    { speaker: '박대박', text: '회식 자리. 박대박이 계좌를 돌린다.\n"+3,240만원 (+412%)"' },
    { speaker: null, text: '집에 오는 길 내내 그 숫자가 떠나지 않는다.' },
    { speaker: null, text: '새벽 2시. 증권사 앱을 깔고 적금을 깬다.\n시드 300만원.' },
    { speaker: null, text: '"나만 없어 주식."\n\n그렇게 3년이 시작됐다.' },
  ]

  it(`정확히 ${EXPECTED_SCENES.length}개 장면이 이 순서·화자·본문 그대로 재생된다`, () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true) // 본문이 즉시 완성되도록(타이핑 대기 없이 즉시 비교)
    renderWithState({}, <PrologueView />)

    EXPECTED_SCENES.forEach((expected, i) => {
      const isLast = i === EXPECTED_SCENES.length - 1

      if (expected.speaker === null) {
        expect(screen.queryByTestId('speaker-tag'), `장면 ${i}: 화자가 없어야 하는데 있다`).toBeNull()
      } else {
        expect(screen.getByTestId('speaker-tag').textContent, `장면 ${i}: 화자가 다르다`).toBe(expected.speaker)
      }
      expect(screen.getByTestId('dialogue-text').textContent, `장면 ${i}: 본문이 다르다`).toBe(expected.text)
      // 버튼 라벨('다음'/'시작')이 이 테스트가 기대하는 장면 개수와 어긋나면(예: 장면이
      // 하나 지워져 실제로는 더 일찍 '시작'이 뜨면) 여기서 바로 드러난다.
      expect(
        screen.getByTestId('prologue-next').textContent,
        `장면 ${i}: 버튼 라벨이 다르다(마지막 장면 판정이 기대와 어긋난다)`,
      ).toBe(isLast ? '시작' : '다음')

      fireEvent.click(screen.getByTestId('prologue-next'))
    })

    // 위 루프의 마지막 클릭(마지막 장면의 '시작')이 실제로 프롤로그를 끝냈는지 —
    // 장면이 기대보다 하나 더 있으면(삭제의 역, 즉 늘어난 경우) 여기서 아직 남아 있다.
    expect(screen.queryByTestId('prologue')).toBeNull()
    expect(useGame.getState().prologueDone).toBe(true)
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

import { afterEach } from 'vitest'
import { act, render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import { ENDINGS, resolveChoice, type EndingId, type EndingResult, type EventChoice, type EventDef, type GameState, type Holding, type PlayerState, type Stats, type Trackers } from '@bb/core'
import { useGame, type Codex, type TabKey } from './store/store'
import { HomeScreen } from './screens/HomeScreen'
import { StockDetail } from './screens/StockDetail'
import { CodexScreen } from './screens/CodexScreen'
import { EventModal } from './overlays/EventModal'
import { EndingView } from './overlays/EndingView'

/**
 * Task 11 Ruling 19 — 뒤따르는 모든 화면 태스크(Task 12~22)가 이 헬퍼를 쓴다.
 *
 * `GameState`의 부분 객체를 받아 실제 새 판(고정 시드) 위에 병합한다. `player`와 그 안의
 * `stats`, 그리고 `trackers`는 중첩까지 부분 객체로 받는다 — core의 `testkit.makeState`가
 * 쓰는 것과 같은 확장 규칙이다(그쪽은 core 전용이라 여기서 재사용할 수 없어 같은 규칙을
 * 그대로 옮겼다). 앞으로 다른 최상위 필드도 중첩 부분 객체가 필요해지면, `player`·
 * `trackers`처럼 여기 분해해 각자의 작은 병합 함수(`mergePlayer`류)를 하나 추가하면 된다 —
 * 얕은 스프레드(`{ ...base, ...rest }`)만으로는 `trackers.feesPaid` 하나만 override해도
 * 나머지 트래커 필드가 통째로 날아간다(Task 16이 겪은 문제).
 */
export type GameStateOverride = Partial<Omit<GameState, 'player' | 'trackers'>> & {
  player?: Partial<Omit<PlayerState, 'stats'>> & { stats?: Partial<Stats> }
  trackers?: Partial<Trackers>
}

/** `player`(및 중첩 `stats`) 부분 override를 실제 `base.player` 위에 병합한다. */
function mergePlayer(base: PlayerState, patch: GameStateOverride['player']): PlayerState {
  if (!patch) return base
  const { stats, ...rest } = patch
  return { ...base, ...rest, stats: stats ? { ...base.stats, ...stats } : base.stats }
}

/** `trackers` 부분 override를 실제 `base.trackers` 위에 병합한다. */
function mergeTrackers(base: Trackers, patch: Partial<Trackers> | undefined): Trackers {
  return patch ? { ...base, ...patch } : base
}

/**
 * `GameState` 최상위 필드가 아닌 스토어(zustand) 전용 필드 override.
 *
 * Task 11 리뷰에서 확인된 한계 — `GameStateOverride`(위)는 `GameState`의 필드만 다룰 수
 * 있는데, `tab`·`selectedStock`·`codex`·`prologueDone`은 `GameState`가 아니라 스토어
 * 자체의 필드다(store.ts의 `Store` 인터페이스 참조). `renderDetail`이 `selectedStock` 하나를
 * 위해 렌더 뒤 `act()`로 따로 얹던 것과 같은 이유로, `reset()`·`newGame()`이 이 필드들을
 * 매번 기본값으로 되돌리기 때문에 override는 그 두 호출 **뒤에** 적용해야 한다.
 *
 * `codex`는 부분 객체로 받는다 — `Codex`의 네 필드(`endings`·`titles`·`bestAssets`·`runs`)
 * 중 테스트가 관심 있는 것만 얹고 나머지는 기본값(`readCodex()`가 준 빈 도감)을 유지한다.
 */
export interface StoreOverride {
  tab?: TabKey
  selectedStock?: string | null
  codex?: Partial<Codex>
  prologueDone?: boolean
}

/**
 * `newGame(1)`로 실제 게임 상태를 만든 뒤(콘텐츠 로더가 채운 진짜 stockDefs·카드 풀을
 * 그대로 쓰기 위해서다 — core의 합성 `makeState`와 달리 여기서는 스토어가 실제로 굴리는
 * 콘텐츠와 같은 값이어야 화면이 기대하는 참조 무결성이 깨지지 않는다), override를 얕게
 * 병합해 스토어에 심고 `ui`(기본값 `<HomeScreen />`)를 렌더한다.
 *
 * `slots`는 `GameState`의 최상위 필드라 override에 그대로 넣으면 명시적으로 주입된다
 * (Ruling 2) — 등급은 매 턴 새로 굴려지므로, 특정 카드가 특정 등급으로 뜬다고 가정하는
 * 테스트는 core가 export하는 `slotsWith(cardId, grade)`로 슬롯을 직접 박아야 한다.
 *
 * `storeOverride`(세 번째 인자, Task 16 추가)는 `GameState`가 아닌 스토어 전용 필드를
 * 심는다 — `renderWithCodex`가 이 인자 하나만 재사용해 도감 override를 구현한다. 두
 * 헬퍼가 각자 상태를 만들면(예: `renderWithCodex`가 별도로 `useGame.setState`를 부르면)
 * 사본이 갈릴 수 있어, `renderWithCodex`는 반드시 이 함수를 거친다.
 */
export function renderWithState(
  override: GameStateOverride = {},
  ui: ReactElement = <HomeScreen />,
  storeOverride: StoreOverride = {},
): RenderResult {
  useGame.getState().reset()
  useGame.getState().newGame(1)
  const base = useGame.getState().state
  if (!base) throw new Error('renderWithState: newGame(1) 이후에도 상태가 비어 있다')

  const { player: playerOver, trackers: trackersOver, ...rest } = override
  const player = mergePlayer(base.player, playerOver)
  const trackers = mergeTrackers(base.trackers, trackersOver)
  const state: GameState = { ...base, ...rest, player, trackers }

  useGame.setState({ state })

  if (storeOverride.tab !== undefined) useGame.setState({ tab: storeOverride.tab })
  if (storeOverride.selectedStock !== undefined) useGame.setState({ selectedStock: storeOverride.selectedStock })
  if (storeOverride.prologueDone !== undefined) useGame.setState({ prologueDone: storeOverride.prologueDone })
  if (storeOverride.codex) {
    const baseCodex = useGame.getState().codex
    useGame.setState({ codex: { ...baseCodex, ...storeOverride.codex } })
  }

  return render(ui)
}

/**
 * Task 16 — 도감 화면(및 그와 같은 모양의 화면)을 위한 렌더 헬퍼.
 *
 * `codexOverride`는 스토어의 `codex` 필드(`GameState`가 아니다) 부분 객체다. `gameOverride`는
 * 나머지 `GameState` override(확장 지점, 보통 도감 화면은 쓰지 않는다). 내부적으로
 * `renderWithState`의 세 번째 인자(`storeOverride`)를 그대로 재사용하므로 — 이 헬퍼가
 * 독자적으로 `useGame.setState`를 부르지 않는다 — `renderWithState`가 심은 상태와 항상
 * 같은 스토어 인스턴스 위에서 동작한다(사본이 갈리지 않는다).
 */
export function renderWithCodex(
  codexOverride: Partial<Codex> = {},
  gameOverride: GameStateOverride = {},
  ui: ReactElement = <CodexScreen />,
): RenderResult {
  return renderWithState(gameOverride, ui, { codex: codexOverride })
}

/**
 * Task 15 — 종목 상세(및 그와 같은 모양의 화면, Task 22+)를 위한 렌더 헬퍼.
 *
 * `stockId`·`price`·`cash`·`holdings`는 브리프가 쓰는 편의 필드다. `price`는 `stocks`
 * 배열 안 한 원소의 필드라 `GameStateOverride`로는(그 타입은 최상위 필드 전체 교체만
 * 지원한다) 표현할 수 없어 여기서 따로 받는다. `cash`·`holdings`는 `player` 아래로
 * 매핑해 `renderWithState`에 넘긴다 — 두 헬퍼가 각자 상태를 만들면 사본이 갈리므로
 * (Task 15 지시) 반드시 `renderWithState`를 거친다.
 *
 * `selectedStock`은 `GameState`가 아니라 스토어의 별도 필드라 `renderWithState`의
 * override로는 심을 수 없다(그 함수는 `newGame(1)`·`reset()` 뒤에 override를 얹는데,
 * 그 두 호출이 `selectedStock`을 이미 `null`로 되돌린다). 그래서 렌더가 끝난 뒤
 * `act()` 안에서 한 번 더 얹는다 — `StockDetail`이 `useGame`을 구독하고 있어 그 시점에
 * 다시 렌더된다.
 *
 * `override`는 확장 지점이다. 이 세 편의 필드에 없는 `GameState` 최상위 필드(Task 22+가
 * 필요로 할 `slots`·`player.mental` 등)는 `GameStateOverride` 그대로 얹으면 된다 —
 * 상태에 없는 합성 플래그(`blocked` 같은)는 만들지 않는다(계획서 Ruling 2).
 */
export interface RenderDetailOptions {
  /** 상세를 열 종목 id. */
  stockId: string
  /** 그 종목의 현재가 편의 필드. 지정하면 history 끝에도 같은 값을 반영한다. */
  price?: number
  /** `player.cash` 편의 필드. */
  cash?: number
  /** `player.holdings` 편의 필드. */
  holdings?: Holding[]
  /** 위 세 편의 필드에 없는 나머지 override(확장 지점). */
  override?: GameStateOverride
  /** 렌더할 화면. 기본값 `<StockDetail />` — Task 22+가 다른 상세류 화면에 재사용할 때
   *  바꿔 끼운다. */
  ui?: ReactElement
}

export function renderDetail(opts: RenderDetailOptions): RenderResult {
  const { stockId, price, cash, holdings, override = {}, ui = <StockDetail /> } = opts

  const player: GameStateOverride['player'] = { ...override.player }
  if (cash !== undefined) player.cash = cash
  if (holdings !== undefined) player.holdings = holdings
  const merged: GameStateOverride = {
    ...override,
    ...(Object.keys(player).length > 0 ? { player } : {}),
  }

  const result = renderWithState(merged, ui)

  act(() => {
    const s = useGame.getState().state
    if (!s) throw new Error('renderDetail: newGame(1) 이후에도 상태가 비어 있다')
    const stocks = price === undefined
      ? s.stocks
      : s.stocks.map(x => x.id === stockId ? { ...x, price, history: [...x.history.slice(0, -1), price] } : x)
    useGame.setState({ state: { ...s, stocks }, selectedStock: stockId })
  })

  return result
}

/**
 * Task 18 — `EventModal`(VN 오버레이) 테스트용 편의 필드. `EventDef.text`는
 * `title`·`body`·`speaker`를 중첩해서 담지만, 테스트에서는 평평하게 쓰는 편이
 * 읽기 쉬워 여기서 한 번만 조립한다. `id` 외 나머지는 전부 선택 — 지정하지 않은
 * 필드는 아래 기본값(`DEFAULT_RENDER_EVENT_TEXT`)을 쓴다.
 */
export interface RenderEventOptions {
  /** 이벤트 id. 실제 콘텐츠에 있는 id가 아니어도 된다 — EventModal에 이 이벤트
   *  하나만 주입하므로 실제 카탈로그와 무관하게 렌더된다. */
  id: string
  /** npc id('kim') 또는 화자 없음(undefined). EventModal이 speakerDisplayName으로
   *  표시 이름으로 바꾸는지가 이 태스크의 핵심 검증 지점이다 — 여기서는 항상
   *  id를 넘긴다(실제 콘텐츠 데이터의 형태 그대로). */
  speaker?: string
  title?: string
  body?: string
  category?: EventDef['category']
  choices?: EventChoice[]
  impact?: EventDef['impact']
}

const DEFAULT_RENDER_EVENT_TEXT = { title: '테스트 이벤트', body: '테스트 본문' }

/**
 * `EventModal`을 특정 이벤트가 대기 중인 상태로 렌더한다. `renderWithState`를 그대로
 * 재사용해 상태를 심고(Ruling 19 — 헬퍼마다 각자 상태를 만들면 사본이 갈린다), 조립한
 * 합성 `EventDef` 하나를 `EventModal`의 `events` prop(테스트 전용 주입 지점)으로
 * 직접 건넨다 — 실제 `loadEvents()` 카탈로그를 몽키패치하거나 vi.mock으로 가로채지
 * 않고도, 실제 콘텐츠에 없는 제목·화자 조합을 자유롭게 고정할 수 있다.
 */
export function renderEvent(opts: RenderEventOptions): RenderResult {
  const def: EventDef = {
    id: opts.id,
    category: opts.category ?? 'news',
    weight: 1,
    text: {
      title: opts.title ?? DEFAULT_RENDER_EVENT_TEXT.title,
      body: opts.body ?? DEFAULT_RENDER_EVENT_TEXT.body,
      speaker: opts.speaker,
    },
    choices: opts.choices,
    impact: opts.impact,
  }
  return renderWithState({ pendingChoices: [{ eventId: def.id }] }, <EventModal events={[def]} />)
}

/**
 * Task 19 — `ChoiceSheet`(선택지 하단 시트) 테스트용 편의 헬퍼. 브리프가 쓰는 세 옵션
 * (`text`·`pending`·`choiceCashDelta`)만 지원한다.
 */
export interface RenderEventWithChoicesOptions {
  /** 대화창에 보일 본문. 기본값은 짧은 더미 문장. */
  text?: string
  /** 함께 대기시킬 합성 이벤트 개수(기본 1). 2 이상이면 서로 다른 이벤트를 순서대로
   *  `pendingChoices`에 쌓는다 — "여러 선택지가 대기 중이면 순서대로 해소된다"(§4.2)
   *  검증용. 첫 이벤트에만 `text`·`choiceCashDelta`가 반영된다 — 실제로 클릭할 대상은
   *  항상 `pendingChoices[0]`이므로 나머지는 이 헬퍼를 쓰는 테스트의 관심사가 아니다. */
  pending?: number
  /** 첫 이벤트의 choice-0(`cash` 효과) delta(원). 지정하지 않으면 choice-0은 효과가
   *  없다. choice-1은 항상 다른 고정값(-1원)의 `cash` 효과를 갖는다 — 두 선택지의
   *  효과를 서로 다르게 둬야, 선택지 인덱스가 뒤집히는 버그(MU7 — choice-0을 눌렀는데
   *  choice-1의 효과가 적용됨)를 자산 변화량 비교만으로도 잡을 수 있다. */
  choiceCashDelta?: number
}

const DEFAULT_CHOICE_EVENT_TEXT = { title: '선택 테스트 이벤트', body: '테스트 본문' }

/**
 * `EventModal`을 선택지 있는 이벤트가 대기 중인 상태로 렌더한다. `renderWithState`를
 * 그대로 재사용한다(Ruling 19 — 헬퍼마다 각자 상태를 만들면 사본이 갈린다). `renderEvent`
 * (위)는 이벤트를 한 번에 하나만 주입하므로 `pending`이 2 이상인 경우를 표현할 수 없어,
 * 이 헬퍼는 `renderWithState`를 직접 거친다 — 그래도 상태 조립 규칙(`pendingChoices` +
 * `EventModal`의 `events` prop 조합)은 `renderEvent`와 동일하다.
 *
 * 실제 콘텐츠(§4.2, Task 18 리뷰가 확인한 사실)에는 선택지가 1개인 이벤트가 없다 —
 * 선택지가 있으면 항상 2개다. 그래서 여기서 만드는 합성 이벤트도 항상 choices 2개를
 * 갖는다.
 */
export function renderEventWithChoices(opts: RenderEventWithChoicesOptions = {}): RenderResult {
  const { text = DEFAULT_CHOICE_EVENT_TEXT.body, pending = 1, choiceCashDelta } = opts

  const makeChoices = (cashDelta: number | undefined): EventChoice[] => [
    { label: '선택 A', effects: cashDelta === undefined ? [] : [{ type: 'cash', delta: cashDelta }] },
    { label: '선택 B', effects: [{ type: 'cash', delta: -1 }] },
  ]

  const defs: EventDef[] = Array.from({ length: Math.max(1, pending) }, (_, i) => ({
    id: i === 0 ? 'choice-test-0' : `choice-test-${i}`,
    category: 'news',
    weight: 1,
    text: { title: DEFAULT_CHOICE_EVENT_TEXT.title, body: i === 0 ? text : `본문 ${i}` },
    choices: i === 0 ? makeChoices(choiceCashDelta) : makeChoices(undefined),
  }))

  const result = renderWithState(
    { pendingChoices: defs.map(d => ({ eventId: d.id })) },
    <EventModal events={defs} />,
  )

  // store.ts의 choose()는 모듈 스코프에 캐시된 실제 loadEvents() 카탈로그만
  // resolveChoice의 pool로 쓴다(`const events = loadEvents()`) — EventModal의 `events`
  // prop(렌더링 전용 주입 지점)과는 완전히 별개다. 그래서 이 헬퍼가 만든 합성 이벤트로
  // "선택 효과가 실제로 적용된다"를 검증하려면 choose() 자체가 그 합성 pool을 봐야
  // 한다. `renderEvent`(Task 18)의 "실제 카탈로그를 몽키패치하거나 vi.mock으로
  // 가로채지 않는다"는 렌더링(제목·화자)만 확인하면 충분했던 그 헬퍼의 범위 얘기고,
  // 이 헬퍼는 브리프가 요구하는 효과 적용 자체를 검증해야 한다 — 그래서 모듈
  // 몽키패치(vi.mock) 대신 이 렌더 세션의 스토어 액션 하나만(zustand state의 함수)
  // 합성 pool을 쓰도록 교체한다. 다른 테스트 파일·다른 렌더에는 전혀 영향이 없다.
  useGame.setState({
    choose(eventId, idx) {
      const s = useGame.getState().state
      if (!s) return
      useGame.setState({ state: resolveChoice(s, eventId, idx, defs) })
    },
  })

  return result
}

/** 지금 스토어가 들고 있는 게임 상태. `renderWithState` 호출 뒤 core 함수(예: `actionPoints`)를
 *  같은 상태에 직접 먹여야 하는 테스트에서 쓴다. 상태가 없으면(판이 없으면) 던진다 —
 *  `renderWithState`를 먼저 부르지 않고 쓰면 그 자체가 테스트 작성 실수다. */
export function currentState(): GameState {
  const s = useGame.getState().state
  if (!s) throw new Error('currentState: 게임 상태가 없다 (renderWithState를 먼저 불러라)')
  return s
}

/**
 * Task 22 — "렌더 후 상태를 바꾼다"는 애니메이션 테스트(§6 "상태 전이")의 공통 전제다.
 * `renderWithState`가 마운트 시점의 초기 상태를 심는 것과 달리, 이 헬퍼는 **이미 렌더된
 * 컴포넌트가 구독 중인 스토어를 그 자리에서 갱신**해 리렌더를 유발한다 — 롤업·보간처럼
 * "값이 바뀌는 순간"을 봐야 하는 테스트(자산 롤업, 흔들림 진입 등)에는 `renderWithState`
 * 하나만으로는 표현할 수 없다.
 *
 * 병합 규칙은 `renderWithState`와 완전히 같다(`player`·`trackers` 중첩 부분 객체 지원) —
 * 두 헬퍼가 각자 다른 병합 로직을 쓰면 "renderWithState에서는 되는데 setState에서는 안
 * 되는" 비대칭이 생긴다.
 *
 * React `act()` 안에서 갱신한다 — 그러지 않으면 "state update not wrapped in act" 경고와
 * 함께 effect(useCountUp의 rAF 시작, useShakePulse의 진입 판정 등)가 이 호출 안에서
 * 동기적으로 플러시된다는 보장이 없어진다.
 */
export function setState(patch: GameStateOverride): void {
  act(() => {
    const base = useGame.getState().state
    if (!base) throw new Error('setState: 게임 상태가 없다 (renderWithState를 먼저 불러라)')
    const { player: playerOver, trackers: trackersOver, ...rest } = patch
    const player = mergePlayer(base.player, playerOver)
    const trackers = mergeTrackers(base.trackers, trackersOver)
    const state: GameState = { ...base, ...rest, player, trackers }
    useGame.setState({ state })
  })
}

/**
 * Task 21 — `EndingView`(잔고증명서) 테스트용 편의 헬퍼. 브리프가 쓰는 다섯 옵션
 * (`cash`·`holdingValue`·`trackers`·`endingId`·`titles`)만 지원한다.
 */
export interface RenderEndingOptions {
  /** `player.cash` 편의 필드. 기본값 0. */
  cash?: number
  /** 보유 주식 평가금액 편의 필드. `GameState.stocks`·`player.holdings`는 `GameState`의
   *  최상위 필드라 `GameStateOverride`로 직접 표현하기 번거로워(정확히 이 값이 되도록
   *  가격·수량을 역산해야 한다) `renderDetail`과 같은 방식으로 렌더 뒤 `act()`에서
   *  기준 종목 하나의 가격을 이 값으로, 수량을 1로 맞춘다. 기본값 0(보유 없음). */
  holdingValue?: number
  trackers?: Partial<Trackers>
  /** 기본값 'bank' — 브리프의 '은행 이자보단 낫지' 케이스와 같은 엔딩이라, 옵션을
   *  아무것도 안 준 렌더(실존 증권사명·계좌번호 마스킹 테스트)도 항상 유효한
   *  엔딩 화면을 얻는다. */
  endingId?: EndingId
  titles?: string[]
}

/**
 * `EndingView`를 게임이 끝난(`status: 'ended'`) 상태로 렌더한다. `renderWithState`를
 * 그대로 재사용한다(Ruling 19). `endingName`은 이 헬퍼가 만드는 것이 아니라 core의
 * `ENDINGS`에서 찾아 채운다 — 실제 게임에서 `judgeEnding`이 하는 일과 같다. 그래야
 * `EndingView`가 `s.ending.endingName`을 그대로 표시하는 정직한 구현이든, id로
 * 자체 조회하는 구현이든 똑같이 옳은 이름을 받는다.
 */
export function renderEnding(opts: RenderEndingOptions = {}): RenderResult {
  const { cash = 0, holdingValue: stockValue = 0, trackers, endingId = 'bank', titles = [] } = opts

  const endingName = ENDINGS.find(e => e.id === endingId)?.name ?? endingId
  const ending: EndingResult = { endingId, endingName, titles, finalAssets: cash + stockValue }

  const result = renderWithState(
    { status: 'ended', ending, player: { cash }, trackers },
    <EndingView />,
  )

  act(() => {
    const s = useGame.getState().state
    if (!s) throw new Error('renderEnding: newGame(1) 이후에도 상태가 비어 있다')
    const stockId = s.stocks[0]?.id
    if (!stockId) throw new Error('renderEnding: 기준 종목이 없다')
    const stocks = s.stocks.map(x =>
      x.id === stockId ? { ...x, price: stockValue, history: [...x.history.slice(0, -1), stockValue] } : x,
    )
    const holdings: Holding[] = stockValue > 0 ? [{ stockId, qty: 1, avgCost: stockValue, heldTurns: 1 }] : []
    useGame.setState({ state: { ...s, stocks, player: { ...s.player, holdings } } })
  })

  return result
}

// 스토어(zustand)는 모듈 전역이라 한 테스트가 심어 둔 state가 다음 테스트로 새어나갈 수
// 있다 — design/testUtils.ts의 matchMediaMock/resetMatchMediaMock과 같은 이유로, 이 모듈을
// import하는 것만으로 매 테스트 뒤 정리가 자동으로 걸리게 한다. localStorage도 함께
// 비운다 — reset()이 저장된 값을 다시 읽어들이므로, 비우지 않으면 이전 테스트가 쓴
// 저장값이 다음 테스트의 '빈 상태'로 새어든다.
afterEach(() => {
  try { localStorage.clear() } catch { /* 무시 */ }
  useGame.getState().reset()
})

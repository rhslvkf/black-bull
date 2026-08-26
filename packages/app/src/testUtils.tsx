import { afterEach } from 'vitest'
import { act, render, type RenderResult } from '@testing-library/react'
import type { ReactElement } from 'react'
import type { GameState, Holding, PlayerState, Stats } from '@bb/core'
import { useGame } from './store/store'
import { HomeScreen } from './screens/HomeScreen'
import { StockDetail } from './screens/StockDetail'

/**
 * Task 11 Ruling 19 — 뒤따르는 모든 화면 태스크(Task 12~22)가 이 헬퍼를 쓴다.
 *
 * `GameState`의 부분 객체를 받아 실제 새 판(고정 시드) 위에 병합한다. `player`와 그 안의
 * `stats`는 중첩까지 부분 객체로 받는다 — core의 `testkit.makeState`가 쓰는 것과 같은
 * 확장 규칙이다(그쪽은 core 전용이라 여기서 재사용할 수 없어 같은 규칙을 그대로 옮겼다).
 */
export type GameStateOverride = Partial<Omit<GameState, 'player'>> & {
  player?: Partial<Omit<PlayerState, 'stats'>> & { stats?: Partial<Stats> }
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
 */
export function renderWithState(
  override: GameStateOverride = {},
  ui: ReactElement = <HomeScreen />,
): RenderResult {
  useGame.getState().reset()
  useGame.getState().newGame(1)
  const base = useGame.getState().state
  if (!base) throw new Error('renderWithState: newGame(1) 이후에도 상태가 비어 있다')

  const { player: playerOver, ...rest } = override
  const player: PlayerState = playerOver
    ? { ...base.player, ...playerOver, stats: { ...base.player.stats, ...(playerOver.stats ?? {}) } }
    : base.player
  const state: GameState = { ...base, ...rest, player }

  useGame.setState({ state })
  return render(ui)
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

/** 지금 스토어가 들고 있는 게임 상태. `renderWithState` 호출 뒤 core 함수(예: `actionPoints`)를
 *  같은 상태에 직접 먹여야 하는 테스트에서 쓴다. 상태가 없으면(판이 없으면) 던진다 —
 *  `renderWithState`를 먼저 부르지 않고 쓰면 그 자체가 테스트 작성 실수다. */
export function currentState(): GameState {
  const s = useGame.getState().state
  if (!s) throw new Error('currentState: 게임 상태가 없다 (renderWithState를 먼저 불러라)')
  return s
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

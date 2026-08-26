import { describe, it, expect, beforeEach } from 'vitest'
import { useGame, SAVE_KEY, SAVE_VERSION, CODEX_KEY } from './store'
import { nextTurnWith } from '../testkit'
import { advanceTurn, GRADES, type CardGrade } from '@bb/core'
import { BALANCE } from '@bb/core'

beforeEach(() => { localStorage.clear(); useGame.getState().reset() })

describe('store', () => {
  it('newGame이 상태를 만든다', () => {
    useGame.getState().newGame(1)
    expect(useGame.getState().state!.turn).toBe(1)
    expect(useGame.getState().state!.player.cash).toBe(BALANCE.seedMoney)
  })
  it('newGame 후 localStorage에 저장된다', () => {
    useGame.getState().newGame(1)
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).version).toBe(SAVE_VERSION)
  })
  it('next가 턴을 넘긴다', () => {
    useGame.getState().newGame(1)
    nextTurnWith()
    expect(useGame.getState().state!.turn).toBe(2)
  })
  it('doBuy/doSell이 반영된다', () => {
    useGame.getState().newGame(1)
    const id = useGame.getState().state!.stockDefs[0]!.id
    useGame.getState().doBuy(id, 1)
    expect(useGame.getState().state!.player.holdings).toHaveLength(1)
    useGame.getState().doSell(id, 1)
    expect(useGame.getState().state!.player.holdings).toHaveLength(0)
  })
  it('불가능한 매매는 상태를 깨지 않는다', () => {
    useGame.getState().newGame(1)
    const before = useGame.getState().state!
    useGame.getState().doBuy(before.stockDefs[0]!.id, 99_999_999)
    expect(useGame.getState().state!.player.cash).toBe(before.player.cash)
  })
  it('setTab / selectStock이 동작한다', () => {
    useGame.getState().setTab('market')
    useGame.getState().selectStock('sjc')
    expect(useGame.getState().tab).toBe('market')
    expect(useGame.getState().selectedStock).toBe('sjc')
  })
  it('게임이 끝나면 도감이 갱신된다', () => {
    useGame.getState().newGame(3)
    for (let i = 0; i < 156 && useGame.getState().state!.status === 'playing'; i++) {
      const st = useGame.getState().state!
      st.pendingChoices.forEach(c => useGame.getState().choose(c.eventId, 0))
      nextTurnWith()
    }
    const codex = useGame.getState().codex
    expect(codex.runs).toBe(1)
    expect(codex.endings.length).toBeGreaterThan(0)
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).runs).toBe(1)
  })
  it('손상된 세이브는 무시된다', () => {
    localStorage.setItem(SAVE_KEY, '{{{')
    expect(() => useGame.getState().reset()).not.toThrow()
    expect(useGame.getState().state).toBeNull()
  })
  it('버전이 다른 세이브는 무시된다', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 99, state: {} }))
    useGame.getState().reset()
    expect(useGame.getState().state).toBeNull()
  })

  /** 종료 상태까지 결정론적으로 진행한다(항상 'hodl' 카드, 항상 선택지 0번). */
  function playToEnd() {
    for (let i = 0; i < 200 && useGame.getState().state!.status === 'playing'; i++) {
      const st = useGame.getState().state!
      st.pendingChoices.forEach(c => useGame.getState().choose(c.eventId, 0))
      nextTurnWith()
    }
  }

  it('같은 시드로 두 번 끝까지 플레이해도 도감의 엔딩은 유니크하게 하나만 쌓인다', () => {
    useGame.getState().newGame(3)
    playToEnd()
    expect(useGame.getState().state!.status).toBe('ended')
    useGame.getState().newGame(3) // 동일 시드 → 결정론적으로 동일한 엔딩
    playToEnd()
    const codex = useGame.getState().codex
    expect(codex.runs).toBe(2)
    expect(codex.endings.length).toBe(1)
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).endings.length).toBe(1)
  })

  it('bestAssets는 더 낮은 결과로 덮어써지지 않는다', () => {
    localStorage.setItem(
      CODEX_KEY,
      JSON.stringify({ endings: [], titles: [], bestAssets: 999_999_999, runs: 0 }),
    )
    useGame.getState().reset()
    useGame.getState().newGame(3)
    playToEnd()
    const codex = useGame.getState().codex
    expect(codex.runs).toBe(1)
    expect(codex.bestAssets).toBe(999_999_999)
    expect(JSON.parse(localStorage.getItem(CODEX_KEY)!).bestAssets).toBe(999_999_999)
  })

  // 리뷰 Minor 3 — 테스트 헬퍼가 매 턴 슬롯을 갈아끼우면(예전 nextTurnWith는 행동 칸을
  // 비우고 회복 칸에 카드를 꽂았다) 완주 테스트가 뽑힌 슬롯을 한 번도 쓰지 않는다.
  // 헬퍼가 상태를 손대지 않는다는 것을, "core에 그대로 넘긴 결과와 바이트 단위로 같은가"로
  // 못박는다 — 꽂아 넣으면 회복 카드의 **등급**이 C로 바뀌어 결과가 달라진다.
  it('nextTurnWith는 슬롯을 조작하지 않고 뽑힌 회복 카드를 그대로 쓴다', () => {
    const grades: CardGrade[] = []
    for (const seed of [1, 2, 3, 4, 5]) {
      useGame.getState().newGame(seed)
      const before = useGame.getState().state!
      grades.push(before.slots.recovery.grade)
      nextTurnWith()
      expect(useGame.getState().state, `seed ${seed}`)
        .toEqual(advanceTurn(before, [before.slots.recovery.cardId]))
    }
    // 다섯 시드가 전부 C였다면 위 비교는 아무것도 구분하지 못한다(공회전 방지).
    expect(grades.some(g => g !== 'C'), `등급 ${grades.join(',')}`).toBe(true)
    expect(GRADES).toContain(grades[0]!)
  })

  // 리뷰 Minor 2 — slots/rerollsLeft 형상 검사를 지워도 아무 테스트가 안 잡았다.
  // 구버전 세이브(둘 다 없음)가 살아 들어오면 카드가 한 장도 안 뜨고 턴 루프가 터진다.
  it.each(['slots', 'rerollsLeft'])('%s가 없는 세이브는 무시된다 (구버전 형상)', field => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    const broken: Record<string, unknown> = { ...s }
    delete broken[field]
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: broken }))
    useGame.getState().reset()
    expect(useGame.getState().state).toBeNull()
  })

  // Task 7 — trackers에 5개 필드(feesPaid/taxPaid/peakAssets/maxDrawdownPct/tradeCount)가
  // 늘었다. 구버전(v3) 저장에는 이 필드들이 없어 undefined로 로드되면 Math.max(undefined, x)가
  // NaN이 되어 최대 낙폭이 영구히 오염된다 — 이 형상 검사가 실제로 구버전을 거부하는지
  // 고정한다(Task 6에서 같은 종류의 미고정 검사가 결함으로 잡혔다, 리뷰 Minor 2).
  it.each(['feesPaid', 'taxPaid', 'peakAssets', 'maxDrawdownPct', 'tradeCount'])(
    'trackers.%s가 없는 세이브는 무시된다 (v3 이전 구버전 형상)',
    field => {
      useGame.getState().newGame(1)
      const s = useGame.getState().state!
      const trackers: Record<string, unknown> = { ...s.trackers }
      delete trackers[field]
      const broken = { ...s, trackers }
      localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: broken }))
      useGame.getState().reset()
      expect(useGame.getState().state).toBeNull()
    },
  )

  it('트래커 5개 필드가 다 있는 같은 세이브는 정상적으로 읽힌다 (위 테스트가 공회전이 아님)', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: s }))
    useGame.getState().reset()
    expect(useGame.getState().state).not.toBeNull()
  })

  it('두 필드가 다 있는 같은 세이브는 정상적으로 읽힌다 (위 테스트가 공회전이 아님)', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: s }))
    useGame.getState().reset()
    expect(useGame.getState().state).not.toBeNull()
  })

  it('버전은 맞지만 구조가 깨진(필드 오염) 세이브는 무시된다', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: { turn: 'NOT_A_NUMBER' } }))
    useGame.getState().reset()
    expect(useGame.getState().state).toBeNull()
  })

  it('타입이 깨진 도감은 무시되고 빈 도감으로 대체된다', () => {
    localStorage.setItem(
      CODEX_KEY,
      JSON.stringify({ endings: 'oops', titles: null, bestAssets: 'x', runs: 'y' }),
    )
    useGame.getState().reset()
    const codex = useGame.getState().codex
    expect(codex.endings).toEqual([])
    expect(codex.titles).toEqual([])
    expect(codex.bestAssets).toBe(0)
    expect(codex.runs).toBe(0)
  })

  it('clearCutscene 후 새로고침(reset)해도 컷신이 되살아나지 않는다', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    // 컷신이 떠 있는 상태를 저장해 둔 뒤 로드
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: { ...s, cutscene: 'cutscene.promote.1' } }))
    useGame.getState().reset()
    expect(useGame.getState().state!.cutscene).toBe('cutscene.promote.1')
    useGame.getState().clearCutscene()
    expect(useGame.getState().state!.cutscene).toBeNull()
    useGame.getState().reset() // 새로고침 시뮬레이션: localStorage에서 다시 읽는다
    expect(useGame.getState().state!.cutscene).toBeNull()
  })

  it('구조적으로 깨진 state에서 core가 던지는 일반 Error는 삼키지 않고 다시 던진다', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    // stockDefs에 없는 종목이 stocks에 섞여 들어간, 최소 형태 검사는 통과하지만
    // 내부적으로는 깨진 state — stepPrices가 GameError가 아닌 일반 Error를 던진다.
    const broken = { ...s, stocks: [...s.stocks, { id: '__missing__', price: 1, fundamental: 1, history: [1] }] }
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: broken }))
    useGame.getState().reset()
    expect(useGame.getState().state!.stocks.length).toBe(broken.stocks.length) // 로드 자체는 통과했다(sanity)
    expect(() => nextTurnWith()).toThrow()
  })
})

// Task 12 — store.doReroll(). core의 rerollSlots를 그대로 부르고 결과를 커밋한다.
describe('doReroll', () => {
  it('rerollsLeft를 1 줄인다 (MU9 — 아무 일도 안 하는 뮤테이션 대비)', () => {
    useGame.getState().newGame(1)
    useGame.setState({ state: { ...useGame.getState().state!, rerollsLeft: 2 } })
    useGame.getState().doReroll()
    expect(useGame.getState().state!.rerollsLeft).toBe(1)
  })

  it('회복 슬롯은 건드리지 않는다 — 리롤은 행동 슬롯만 다시 굴린다', () => {
    useGame.getState().newGame(1)
    const before = useGame.getState().state!
    useGame.setState({ state: { ...before, rerollsLeft: 2 } })
    const recoveryBefore = useGame.getState().state!.slots.recovery
    useGame.getState().doReroll()
    expect(useGame.getState().state!.slots.recovery).toEqual(recoveryBefore)
  })

  it('rerollsLeft가 0이면 아무 일도 하지 않는다(예외 없이 상태를 그대로 둔다)', () => {
    useGame.getState().newGame(1)
    useGame.setState({ state: { ...useGame.getState().state!, rerollsLeft: 0 } })
    const before = useGame.getState().state!
    expect(() => useGame.getState().doReroll()).not.toThrow()
    expect(useGame.getState().state).toEqual(before)
  })

  it('게임이 없으면 아무 일도 하지 않는다', () => {
    expect(useGame.getState().state).toBeNull()
    expect(() => useGame.getState().doReroll()).not.toThrow()
    expect(useGame.getState().state).toBeNull()
  })
})

// Task 12 — togglePick이 카드 장수가 아니라 실제 행동력 소모(등급별 cardApCost)를
// 기준으로 게이팅한다(§2.2 — 등급이 오르면 행동력 소모도 오른다). count 기반이던 예전
// 로직은 등급 C(⚡2) 카드 하나만 골라도 예산 2/2를 다 쓴 뒤에도 count가 1이라 두 번째
// 카드까지 고를 수 있게 허용해, next-turn을 눌러도 core가 NO_AP로 조용히 거부하는
// 죽은 클릭을 만들었다.
describe('togglePick — 행동력 예산 기준 게이팅', () => {
  it('예산을 이미 다 쓴 뒤에는 새 카드를 더 고를 수 없다', () => {
    useGame.getState().newGame(1)
    // stamina 0, 재직 상태 → actionPoints = 2. slotsWith 대신 실제 pinSlots 스타일로
    // 두 장을 등급 C(⚡2)로 꽂는다 — 첫 장만으로 예산이 이미 꽉 찬다.
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, stats: { ...s.player.stats, stamina: 0 }, employed: true },
      slots: { action: [{ cardId: 'analyze', grade: 'C' }, { cardId: 'news', grade: 'C' }, { cardId: 'overtime', grade: 'C' }],
        recovery: { cardId: 'hodl', grade: 'C' } } } })
    useGame.getState().togglePick('analyze')
    expect(useGame.getState().picked).toEqual(['analyze'])
    useGame.getState().togglePick('news')
    // 예산(2)을 이미 analyze 한 장(⚡2)이 다 썼으므로, news를 더하려면 오래된 선택부터
    // 밀어낸다(슬라이딩 윈도우 — 예전 count 기반 동작과 같은 감각). count 기반이었다면
    // 밀어내지 않고 그냥 ['analyze','news']가 됐을 것이다(예산 초과인데도 둘 다 남는다).
    expect(useGame.getState().picked).toEqual(['news'])
  })

  it('회복 카드는 행동력을 쓰지 않으므로 예산이 꽉 차도 함께 고를 수 있다', () => {
    useGame.getState().newGame(1)
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, stats: { ...s.player.stats, stamina: 0 }, employed: true },
      slots: { action: [{ cardId: 'analyze', grade: 'C' }, { cardId: 'news', grade: 'C' }, { cardId: 'overtime', grade: 'C' }],
        recovery: { cardId: 'hodl', grade: 'C' } } } })
    useGame.getState().togglePick('analyze')
    useGame.getState().togglePick('hodl')
    expect(useGame.getState().picked).toEqual(['analyze', 'hodl'])
  })

  it('이미 고른 카드를 다시 누르면 선택이 풀린다', () => {
    useGame.getState().newGame(1)
    // 이번 턴 실제로 뽑힌 회복 카드를 쓴다 — 어떤 카드가 뽑히는지는 시드가 정한다.
    const recoveryId = useGame.getState().state!.slots.recovery.cardId
    useGame.getState().togglePick(recoveryId)
    expect(useGame.getState().picked).toEqual([recoveryId])
    useGame.getState().togglePick(recoveryId)
    expect(useGame.getState().picked).toEqual([])
  })
})

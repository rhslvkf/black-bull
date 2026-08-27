import type { GameState, StockDef, StockState, Regime, PlayerState, Stats, CardGrade, TurnSlots } from './types'
import { BALANCE } from './balance'

export function makeStockDef(over: Partial<StockDef> & { id: string }): StockDef {
  return { name: over.id, sector: '금융', tierGate: 0, initialPrice: 10000,
    fundamental: 10000, volatility: 0, beta: 0, hype: 0, ...over }
}
export function makeStock(over: Partial<StockState> & { id: string }): StockState {
  return { price: 10000, fundamental: 10000, history: [10000], ...over }
}

/** 테스트가 검사할 카드 하나를 등급까지 못박아 슬롯에 넣어준다. 나머지 행동 칸은
 *  채우지 않는다 — playCard/gradeOfSlot 테스트는 지정한 카드 하나면 충분하고,
 *  나머지 두 칸까지 채우면 어떤 카드가 뽑혔는지 테스트가 알 수 없어져 의미가 없다. */
export const slotsWith = (cardId: string, grade: CardGrade): TurnSlots => ({
  action: [{ cardId, grade }],
  recovery: { cardId: 'rest', grade: 'C' },
})

/** `player`는 부분 객체로도 받는다(그 안의 `stats`도 부분 객체) — 계획서 곳곳의
 *  테스트가 `makeState({ player: { stats: { network: 0 } } })` 형태로 적혀 있어서다.
 *  다른 최상위 필드는 지금까지처럼 얕은 덮어쓰기로 충분하다. */
type MakeStateOverride = Partial<Omit<GameState, 'player'>> & {
  player?: Partial<Omit<PlayerState, 'stats'>> & { stats?: Partial<Stats> }
}

export function makeState(over: MakeStateOverride = {}): GameState {
  const { player: playerOver, ...rest } = over
  const defaultPlayer: PlayerState = {
    cash: BALANCE.seedMoney, loan: 0, holdings: [],
    mental: 80, condition: 80, burnoutTurns: 0,
    stats: { grit: 1, stamina: 1, info: 0, analysis: 0, network: 1 },
    employed: true, tier: 0, marginCallDueTurn: null,
  }
  const player: PlayerState = playerOver
    ? { ...defaultPlayer, ...playerOver, stats: { ...defaultPlayer.stats, ...(playerOver.stats ?? {}) } }
    : defaultPlayer
  // rerollsLeft 기본값은 rerollCount(state)의 공식을 그대로 옮긴 것이다 — 여기서
  // rerollCount를 직접 부르려면 아직 다 짓지도 않은 GameState를 그 함수에 넘기기
  // 위해 캐스트를 해야 해서, 공식을 한 줄 복제하는 쪽을 택했다. reroll 밸런스가
  // 바뀌면 turn/slots.test.ts의 뮤테이션 테스트가 두 곳의 불일치를 잡아낸다.
  const rerollsLeft = Math.min(
    BALANCE.reroll.max,
    BALANCE.reroll.base + Math.floor(player.stats.network / BALANCE.reroll.networkPer),
  )
  return {
    turn: 1, seed0: 1, rng: { s: 1 },
    regimes: Array.from({ length: BALANCE.totalTurns }, (): Regime => 'stagnation'),
    stockDefs: [makeStockDef({ id: 's1' }), makeStockDef({ id: 's2' })],
    stocks: [makeStock({ id: 's1' }), makeStock({ id: 's2' })],
    player,
    pendingImpacts: [], news: [], firedOneShots: [], flags: {},
    pendingChoices: [], rivalAssets: BALANCE.rival.start,
    trackers: { shakenTurns: 0, usedMargin: false, lossCuts: 0,
      maxHeldTurns: 0, cashRatioSum: 0, turnsCounted: 0, netPayroll: 0,
      feesPaid: 0, taxPaid: 0, peakAssets: 0, maxDrawdownPct: 0, tradeCount: 0 },
    prevLossPct: 0, cutscene: null, lastTurnSkip: null, status: 'playing', ending: null,
    slots: slotsWith('overtime', 'C'),
    rerollsLeft,
    ...rest,
  }
}

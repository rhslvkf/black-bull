import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { createRng } from '../rng/rng'
import { generateRegimes } from '../market/regimes'
import { loadStockDefs, initStockStates } from '../market/stocks'
import { stepPrices } from '../market/price'
import { loadEvents } from '../events/content'
import { drawEvents, resolveImpacts, revealRumors } from '../events/engine'
import { settleMental } from '../mental/mental'
import { settleCondition, rollForcedSkip } from '../mental/condition'
import { accrueInterest, checkMarginCall } from './margin'
import { playCard } from './cards'
import { settlePayroll, settleTier, stepRival } from './economy'
import { cashRatio, totalAssets } from './accounting'
import { judgeEnding } from '../endings/endings'

export function initGame(seed: number): GameState {
  const [regimes, rng] = generateRegimes(createRng(seed))
  const stockDefs = loadStockDefs()
  return {
    turn: 1, seed0: seed, rng, regimes, stockDefs, stocks: initStockStates(stockDefs),
    player: {
      cash: BALANCE.seedMoney, loan: 0, holdings: [],
      mental: 100, condition: 100, burnoutTurns: 0,
      stats: { grit: 0, stamina: 0, info: 0, analysis: 0, network: 0 },
      employed: true, tier: 0,
    },
    pendingImpacts: [], news: [], firedOneShots: [], flags: {},
    pendingChoices: [], rivalAssets: BALANCE.rival.start,
    trackers: { shakenTurns: 0, usedMargin: false, lossCuts: 0, maxHeldTurns: 0, cashRatioSum: 0, turnsCounted: 0 },
    prevLossPct: 0, cutscene: null, status: 'playing', ending: null,
  }
}

export function cardsPerTurn(state: GameState): number {
  return state.player.employed ? 1 : 2
}

function takePending(s: GameState, key: string): [number, GameState] {
  const v = Number(s.flags[key] ?? 0)
  const flags = { ...s.flags }
  delete flags[key]
  return [v, { ...s, flags }]
}

export function advanceTurn(state: GameState, cardIds: string[]): GameState {
  if (state.status !== 'playing') throw new GameError('NOT_PLAYING')
  if (state.pendingChoices.length > 0) throw new GameError('CHOICE_PENDING')
  if (cardIds.length > cardsPerTurn(state)) throw new GameError('TOO_MANY_CARDS')

  let s: GameState = { ...state, cutscene: null }

  // 1. 강제 스킵 → 2. 카드
  const [skipped, afterSkip] = rollForcedSkip(s)
  s = afterSkip
  if (!skipped) for (const id of cardIds) s = playCard(s, id)

  // 3. 가격
  const [impacts, afterImpacts] = resolveImpacts(s)
  s = afterImpacts
  const [stocks, rng] = stepPrices(s.stocks, s.stockDefs, s.regimes[s.turn - 1] ?? 'stagnation', impacts, s.rng)
  s = { ...s, stocks, rng }

  // 4. 신용
  s = checkMarginCall(accrueInterest(s))

  // 5. 이벤트
  s = revealRumors(drawEvents(s, loadEvents()))

  // 6. 게이지 정산
  const [mentalPending, s1] = takePending(s, '__mentalPending')
  s = settleMental(s1, mentalPending)
  const [condPending, s2] = takePending(s, '__conditionPending')
  s = settleCondition(s2, condPending)

  // 7. 경제·티어·라이벌
  s = stepRival(settleTier(settlePayroll(s)))

  // 8. 보유 기간·트래커
  const holdings = s.player.holdings.map(h => ({ ...h, heldTurns: h.heldTurns + 1 }))
  s = { ...s, player: { ...s.player, holdings } }
  s = { ...s, trackers: {
    ...s.trackers,
    cashRatioSum: s.trackers.cashRatioSum + cashRatio(s),
    turnsCounted: s.trackers.turnsCounted + 1,
    maxHeldTurns: Math.max(s.trackers.maxHeldTurns, ...holdings.map(h => h.heldTurns), 0),
  } }

  // 9. 종료 판정
  const bankrupt = totalAssets(s) <= 0
  if (bankrupt || s.turn >= BALANCE.totalTurns) {
    return { ...s, status: 'ended', ending: judgeEnding(s, bankrupt) }
  }
  return { ...s, turn: s.turn + 1 }
}

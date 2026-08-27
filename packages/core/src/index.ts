export { createRng, rngNext, Rand, type RngState } from './rng/rng'
export * from './types'
export { BALANCE, TIER_NAMES } from './balance'
export { GameError } from './error'
export { initGame, advanceTurn } from './turn/advance'
export { buy, sell, canBuy, canSell, maxBuyQty, averageDown, canAverageDown } from './turn/trade'
export {
  totalAssets, holdingValue, cashRatio, priceOf, portfolioLossPct, positionLossPct,
  noTradeBaseline, investmentRoi, fee, tax,
} from './turn/accounting'
export { maxLoan, takeLoan, repayLoan, marginShortfall } from './turn/margin'
// playCard는 sim이 **선택 미리보기**에 쓴다 — "이 카드를 내면 다음 카드가 잠기는가"를
// 알려면 실제로 내본 상태가 필요하고, 그 규칙을 sim이 다시 구현하면 두 사본이 어긋난다.
export { loadCards, isCardAvailable, cardLockReason, actionPoints, cardApCost, playCard, type CardLock } from './turn/cards'
export { GRADES, gradeMul, gradeCashMul, gradeAp, rollGrade, cardStat } from './turn/grade'
export { drawSlots, rerollSlots, rerollCount, gradeOfSlot } from './turn/slots'
export { slotsWith } from './testkit'
export { loadEvents, loadContent } from './events/content'
export { resolveChoice, revealRumors } from './events/engine'
export { isShaken, lossExposure, moodOf, type Mood } from './mental/mental'
export { tierOf } from './turn/economy'
export { analyzeStock } from './market/analysis'
export { SECTORS } from './market/stocks'
export {
  judgeEnding, ENDINGS, TITLES,
  ENDING_IDS, type EndingId, TITLE_IDS, type TitleId,
} from './endings/endings'

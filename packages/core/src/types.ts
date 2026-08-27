import type { RngState } from './rng/rng'
import type { EndingId } from './endings/endings'

export type Regime = 'boom' | 'overheat' | 'crash' | 'stagnation' | 'recovery'
export type Sector = '반도체' | '2차전지' | '바이오' | '조선' | '게임' | '금융' | '엔터' | '방산'
export type StatKey = 'grit' | 'stamina' | 'info' | 'analysis' | 'network'
export type Tier = 0 | 1 | 2 | 3 | 4 | 5

export interface StockDef {
  id: string; name: string; sector: Sector; tierGate: Tier
  initialPrice: number; fundamental: number
  volatility: number; beta: number; hype: number
  etf?: 'lev' | 'inv'
}
export interface StockState { id: string; price: number; fundamental: number; history: number[] }

export interface Holding { stockId: string; qty: number; avgCost: number; heldTurns: number }
export interface Stats { grit: number; stamina: number; info: number; analysis: number; network: number }

/** 카드 등급. 뽑힐 때마다 굴려지며, 카드에 고정되어 성장해서 굳는 레벨이 아니다. */
export type CardGrade = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

/** 슬롯에 뽑힌 카드 한 장과 그때 굴려진 등급. */
export interface SlotCard { cardId: string; grade: CardGrade }
/** 이번 턴 뽑힌 슬롯 전체. 행동 슬롯은 여러 칸, 회복 슬롯은 항상 하나 열려 있다. */
export interface TurnSlots { action: SlotCard[]; recovery: SlotCard }

export interface PlayerState {
  cash: number; loan: number; holdings: Holding[]
  mental: number; condition: number; burnoutTurns: number
  stats: Stats; employed: boolean; tier: Tier
  /** 마진콜 경고가 걸린 상태에서 **청산 판정이 내려지는 턴 번호**. 경고가 없으면 null.
   *  담보(현금+평가액)가 대출×callRatio 아래로 내려간 턴 N에 `N + 1`로 세워지고,
   *  턴 N+1의 신용 단계에서 담보가 회복됐으면 null로 내려가고 아니면 전량 청산된다.
   *  `flags.marginCalled`와 헷갈리지 마라 — 저쪽은 '청산이 이미 일어났다'는 사후 기록이고,
   *  이쪽은 '아직 안 일어났지만 다음 주에 일어난다'는 예고다. */
  marginCallDueTurn: number | null
}

export interface PendingImpact {
  target: string           // 'market' | 'stock:<id>' | 'sector:<Sector>'
  magnitude: number        // 로그수익률 충격
  dueTurn: number
  revealTurn: number
  revealed: boolean
  title: string
}
export interface NewsItem { turn: number; kind: 'news' | 'rumor'; title: string }
export interface DrawnEvent { eventId: string }

export type Condition =
  | { type: 'tierMin'; value: number } | { type: 'tierMax'; value: number }
  | { type: 'turnMin'; value: number } | { type: 'turnMax'; value: number }
  | { type: 'regime'; value: Regime }
  | { type: 'statMin'; stat: StatKey; value: number }
  | { type: 'assetsMin'; value: number } | { type: 'assetsMax'; value: number }
  | { type: 'employed'; value: boolean }
  | { type: 'mentalMax'; value: number }
  | { type: 'flagEq'; key: string; value: number | boolean }
  | { type: 'flagMin'; key: string; value: number }
  | { type: 'flagAbsent'; key: string }
  | { type: 'holdsStock'; stockId: string }

export type Effect =
  | { type: 'stat'; stat: StatKey; delta: number }
  | { type: 'mental'; delta: number; isRecovery?: boolean }
  | { type: 'condition'; delta: number }
  | { type: 'cash'; delta: number }
  | { type: 'flag'; key: string; value: number | boolean | 'inc' }
  | { type: 'impact'; target: string; magnitude: number; delay: 0 | 1 | 2 | 3; title: string }
  | { type: 'buyStockPct'; stockId: string; pct: number }
  | { type: 'retire' }
  | { type: 'rivalMul'; value: number }
  | { type: 'fundamentalMul'; stockId: string; value: number }

export interface EventChoice { label: string; effects: Effect[] }
export interface EventDef {
  id: string; category: 'news' | 'company' | 'personal' | 'social' | 'story'
  conditions?: Condition[]; weight: number; oneShot?: boolean
  text: { title: string; body: string; speaker?: string }
  effects?: Effect[]
  impact?: { target: string; magnitude: number; delay: 0 | 1 | 2 | 3 }
  choices?: EventChoice[]
}

export interface ActionCardDef {
  id: string; name: string; desc: string
  cost?: { money?: number; condition?: number }
  requires?: Condition[]
  effects: Effect[]
  lockedWhenShaken?: boolean
  isRecovery?: boolean
}

export interface ContentBundle { cards: ActionCardDef[]; events: EventDef[] }

export interface Trackers {
  shakenTurns: number; usedMargin: boolean; lossCuts: number
  maxHeldTurns: number; cashRatioSum: number; turnsCounted: number
  /** 시드머니 이후 **외부에서 들어온 순현금**(월급 입금 − 퇴사 후 생활비)의 누계.
   *  '아무 매매도 하지 않았을 때의 자산'(= 무매매 기준선)을 계산하는 데 쓰인다.
   *  턴 수로 역산하지 않고 실제 정산된 금액을 누적하는 이유는, 재직/퇴사 전환과
   *  현금 부족 클램프 때문에 `floor(turn/payPeriod) × employedNet`이 실제와 어긋나기
   *  때문이다. accounting.ts의 noTradeBaseline이 유일한 소비자다. */
  netPayroll: number
  /** buy/sell이 이미 계산한 수수료·세금(accounting.ts의 fee/tax)을 그대로 누적한 값.
   *  엔딩 화면(잔고증명서)에만 쓰이므로 여기서 다시 계산하지 않는다 — 두 번 계산하면
   *  두 사본이 어긋날 수 있다. */
  feesPaid: number; taxPaid: number
  /** 지금까지 한 번이라도 도달했던 총자산의 최고치. advanceTurn 8단계에서 매 턴
   *  Math.max로만 갱신되므로 내려가지 않는다. */
  peakAssets: number
  /** peakAssets 대비 낙폭의 역대 최고치(%, 0~100). 회복해도 줄어들지 않는다. */
  maxDrawdownPct: number
  /** buy/sell 호출 횟수(물타기 averageDown도 내부적으로 buy를 부르므로 포함된다).
   *  이중 계상을 막기 위해 buy/sell에서만 늘리고 averageDown 자체는 늘리지 않는다. */
  tradeCount: number
}

export interface EndingResult { endingId: EndingId; endingName: string; titles: string[]; finalAssets: number }

export interface GameState {
  turn: number                 // 이번에 플레이할 턴, 1..156
  seed0: number                // 생성 시드 (분석력 노이즈 등 파생 해시용)
  rng: RngState
  regimes: Regime[]            // 길이 156, [turn-1]이 현재 국면
  stockDefs: StockDef[]
  stocks: StockState[]
  player: PlayerState
  pendingImpacts: PendingImpact[]
  news: NewsItem[]
  firedOneShots: string[]
  flags: Record<string, number | boolean>
  pendingChoices: DrawnEvent[]
  rivalAssets: number
  trackers: Trackers
  slots: TurnSlots             // 이번 턴 뽑힌 행동 3칸 · 회복 1칸
  rerollsLeft: number          // 이번 턴 남은 리롤 횟수 (인맥 스탯에서 파생)
  prevLossPct: number          // 직전 턴 포트폴리오 손실률(%, 0 이상)
  cutscene: string | null      // ArtKey 문자열
  /** 직전 advanceTurn에서 강제 스킵(야근/번아웃)이 일어났는지. 스킵은 고른 카드를
   *  통째로 버리므로, 화면이 이유를 말해주지 않으면 "버튼을 눌렀는데 아무 일도
   *  안 일어났다"가 된다(최종 리뷰 M4). 매 턴 시작에 null로 초기화된다. */
  lastTurnSkip: 'burnout' | 'exhausted' | null
  status: 'playing' | 'ended'
  ending: EndingResult | null
}

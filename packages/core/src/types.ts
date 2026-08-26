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

export interface PlayerState {
  cash: number; loan: number; holdings: Holding[]
  mental: number; condition: number; burnoutTurns: number
  stats: Stats; employed: boolean; tier: Tier
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
  prevLossPct: number          // 직전 턴 포트폴리오 손실률(%, 0 이상)
  cutscene: string | null      // ArtKey 문자열
  /** 직전 advanceTurn에서 강제 스킵(야근/번아웃)이 일어났는지. 스킵은 고른 카드를
   *  통째로 버리므로, 화면이 이유를 말해주지 않으면 "버튼을 눌렀는데 아무 일도
   *  안 일어났다"가 된다(최종 리뷰 M4). 매 턴 시작에 null로 초기화된다. */
  lastTurnSkip: 'burnout' | 'exhausted' | null
  status: 'playing' | 'ended'
  ending: EndingResult | null
}

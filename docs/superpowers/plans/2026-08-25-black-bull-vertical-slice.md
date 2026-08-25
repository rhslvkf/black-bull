# 흑우키우기 1차 버티컬 슬라이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1턴부터 156턴 엔딩까지 끊김 없이 플레이되는 흑우키우기(주차 턴제 주식 육성 게임) 버티컬 슬라이스 + 밸런싱 CLI.

**Architecture:** 순수 함수형 결정론 코어(`@bb/core`, React 의존성 0) 위에 React 뷰(`@bb/app`)와 밸런싱 CLI(`@bb/sim`)를 얹는다. 모든 상태 전이는 `(GameState, input) → GameState` 순수 함수, 난수는 상태 내 시드 RNG. 콘텐츠(종목·이벤트·카드·엔딩)는 JSON 데이터.

**Tech Stack:** pnpm workspace, TypeScript 5 (strict), Vitest, React 18 + Vite + zustand, tsx(sim CLI). 코어는 런타임 의존성 0.

**Spec:** `docs/superpowers/specs/2026-08-25-black-bull-design.md`

## Global Constraints

- Node ≥ 20, pnpm(코어팩). 패키지명: `@bb/core`, `@bb/sim`, `@bb/app`.
- `packages/core`: 런타임 `dependencies` 0개 (devDeps: typescript, vitest만). react/dom 타입 금지.
- core·sim에서 `Math.random`, `Date.now`, `new Date()` 사용 금지 — 난수는 전부 `rng` 모듈, 시간은 turn 번호.
- 돈은 정수 KRW. 주가는 정수 KRW, 하한 50원.
- 수수료 0.015% (매수·매도), 증권거래세 0.18% (매도만). 값은 `BALANCE`에만 존재.
- 멘탈·컨디션 게이지 0~100 (최대치 전원 100 고정). 육성 스탯 0~10 (0.1 단위 float, 표시만 반올림).
- 흔들림 구간: 멘탈 ≤ 29. 회복 카드(`isRecovery: true`)는 어떤 상태에서도 잠기지 않는다.
- 튜닝 가능한 모든 수치는 `packages/core/src/balance.ts`의 `BALANCE` 단일 객체에만 둔다.
- UI 문구는 한국어, 코드 식별자는 영어. 모바일 세로 기준 max-width 480px, 다크 테마.
- 커밋은 태스크당 1회 이상, conventional prefix (`feat:`, `test:`, `chore:` 등).

## 스펙과의 의도적 차이 (구현 확정 사항)

1. `advanceTurn(state, cardId)` → `advanceTurn(state, cardIds: string[])` — 퇴사 후 턴당 2장을 지원.
2. 슈퍼개미 엔딩의 "재직 중" 조건 완화: 판정 순서를 파이어족(≥10억 & 퇴사) → 슈퍼개미(≥5억)로 두어 5억~10억 퇴사자의 판정 공백을 제거.
3. 레버리지/인버스 ETF는 `StockDef.etf` 필드로 구현 (평균회귀 미적용, fundamental=price 추종).
4. 큰손 시장 충격: 체결 시 `price ×= 1 ± min(3%, 체결액/200억)`.
5. 티어2 해금 "해외주식"은 2차로 미룸 — 티어2 해금은 `리포트 정독` 카드로 대체.
6. 종목 10개 = 일반 8 (8섹터 각 1) + ETF 2.

## 파일 맵

```
black-bull/
├─ package.json  pnpm-workspace.yaml  tsconfig.base.json
├─ packages/
│  ├─ core/
│  │  ├─ package.json  tsconfig.json
│  │  ├─ data/
│  │  │  ├─ stocks.json  cards.json  endings.json
│  │  │  └─ events/ news.json company.json personal.json social.json story.json
│  │  └─ src/
│  │     ├─ index.ts            # 공개 API re-export
│  │     ├─ types.ts            # 전 타입 (Task 3)
│  │     ├─ balance.ts          # BALANCE 상수 (Task 3)
│  │     ├─ error.ts            # GameError (Task 3)
│  │     ├─ testkit.ts          # 테스트용 상태 빌더 (Task 3)
│  │     ├─ rng/rng.ts          # mulberry32 + Rand (Task 2)
│  │     ├─ market/regimes.ts   # 국면 시퀀스 (Task 4)
│  │     ├─ market/stocks.ts    # 종목 데이터 로드·검증 (Task 5)
│  │     ├─ market/price.ts     # 주간 가격 갱신 (Task 6)
│  │     ├─ market/analysis.ts  # 적정가 밴드·리스크 (Task 16)
│  │     ├─ turn/accounting.ts  # 자산 계산 (Task 7)
│  │     ├─ turn/trade.ts       # buy/sell (Task 7)
│  │     ├─ turn/margin.ts      # 신용 (Task 8)
│  │     ├─ turn/conditions.ts  # Condition 평가기 (Task 11)
│  │     ├─ turn/effects.ts     # Effect 실행기 (Task 11)
│  │     ├─ turn/cards.ts       # 카드 로드·사용 (Task 11)
│  │     ├─ turn/economy.ts     # 월급·티어·라이벌 (Task 14)
│  │     ├─ turn/advance.ts     # advanceTurn·initGame (Task 15)
│  │     ├─ mental/mental.ts    # 멘탈 규칙 (Task 9)
│  │     ├─ mental/condition.ts # 컨디션 규칙 (Task 10)
│  │     ├─ events/engine.ts    # 추첨·적용·선택 (Task 12)
│  │     ├─ events/content.ts   # 이벤트 로드·검증 (Task 13)
│  │     └─ endings/endings.ts  # 엔딩·칭호 (Task 17)
│  ├─ sim/
│  │  ├─ package.json  tsconfig.json
│  │  └─ src/ strategies.ts  runner.ts  cli.ts  balance.test.ts   # (Task 18)
│  └─ app/
│     ├─ package.json  tsconfig.json  vite.config.ts  index.html
│     └─ src/
│        ├─ main.tsx  App.tsx  index.css
│        ├─ store/store.ts       # zustand + localStorage (Task 19)
│        ├─ art/ keys.ts registry.tsx Art.tsx parts/*.tsx   # (Task 20)
│        ├─ components/ Hud.tsx TabBar.tsx NewsFeed.tsx CardGrid.tsx
│        │             PriceChart.tsx Donut.tsx Toast.tsx    # (Task 21-22)
│        ├─ screens/ HomeScreen.tsx MarketScreen.tsx StockDetail.tsx
│        │           AccountScreen.tsx CodexScreen.tsx       # (Task 21-23)
│        └─ overlays/ EventModal.tsx CutsceneView.tsx
│                     PrologueView.tsx EndingView.tsx        # (Task 23)
```

의존 방향: `app → core`, `sim → core`. core는 아무도 모른다.

---

### Task 1: pnpm 워크스페이스 + core 패키지 스캐폴드

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`
- Test: `packages/core/src/sanity.test.ts`

**Interfaces:**
- Produces: 루트 스크립트 `pnpm test`(재귀), `@bb/core` 패키지 뼈대. 이후 모든 태스크가 이 위에서 작업.

- [ ] **Step 1: 루트 파일 작성**

`package.json`:
```json
{
  "name": "black-bull",
  "private": true,
  "scripts": { "test": "pnpm -r test", "build": "pnpm -r --if-present build" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "jsx": "react-jsx",
    "noEmit": true
  }
}
```

`.gitignore`:
```
node_modules/
dist/
*.local
```

- [ ] **Step 2: core 패키지 파일 작성**

`packages/core/package.json`:
```json
{
  "name": "@bb/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc -p ." },
  "devDependencies": { "typescript": "^5.5.4", "vitest": "^2.1.0" }
}
```

`packages/core/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "data"] }
```

`packages/core/src/index.ts`:
```ts
export {}
```

`packages/core/src/sanity.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('workspace', () => {
  it('vitest가 돈다', () => { expect(1 + 1).toBe(2) })
})
```

- [ ] **Step 3: 설치 및 테스트 실행**

Run: `corepack enable && pnpm install && pnpm --filter @bb/core test`
Expected: PASS 1 test

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: pnpm 워크스페이스 + core 패키지 스캐폴드"
```

---

### Task 2: 시드 RNG (mulberry32)

**Files:**
- Create: `packages/core/src/rng/rng.ts`
- Test: `packages/core/src/rng/rng.test.ts`

**Interfaces:**
- Produces:
  - `interface RngState { s: number }`
  - `createRng(seed: number): RngState`
  - `rngNext(st: RngState): [number, RngState]` — [0,1) 균등
  - `class Rand { constructor(state: RngState); state: RngState; next(): number; int(min, max): number; normal(mean?, sd?): number; chance(p): boolean; pickWeighted<T>(items: T[], weight: (t: T) => number): T }`
  - 사용 규약: 순수 함수 내부에서 `const rand = new Rand(state.rng)` → 사용 → 반환 상태에 `rng: rand.state` 기록.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/rng/rng.test.ts
import { describe, it, expect } from 'vitest'
import { createRng, rngNext, Rand } from './rng'

describe('rng', () => {
  it('같은 시드는 같은 수열', () => {
    const a = new Rand(createRng(42)), b = new Rand(createRng(42))
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })
  it('next는 [0,1)', () => {
    const r = new Rand(createRng(7))
    for (let i = 0; i < 1000; i++) { const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
  it('int는 폐구간 [min,max]', () => {
    const r = new Rand(createRng(1))
    const seen = new Set<number>()
    for (let i = 0; i < 500; i++) { const v = r.int(1, 6); seen.add(v); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6) }
    expect(seen.size).toBe(6)
  })
  it('normal 평균 ≈ 0', () => {
    const r = new Rand(createRng(3))
    let sum = 0
    for (let i = 0; i < 4000; i++) sum += r.normal()
    expect(Math.abs(sum / 4000)).toBeLessThan(0.08)
  })
  it('pickWeighted는 가중치 0을 뽑지 않는다', () => {
    const r = new Rand(createRng(9))
    for (let i = 0; i < 200; i++) expect(r.pickWeighted(['a', 'b'], x => (x === 'a' ? 0 : 1))).toBe('b')
  })
  it('rngNext는 원본 상태를 변경하지 않는다', () => {
    const s0 = createRng(5)
    rngNext(s0)
    expect(s0).toEqual(createRng(5))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test`
Expected: FAIL — `./rng` 모듈 없음

- [ ] **Step 3: 구현**

```ts
// packages/core/src/rng/rng.ts
export interface RngState { s: number }

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 }
}

export function rngNext(st: RngState): [number, RngState] {
  const s = (st.s + 0x6d2b79f5) >>> 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, { s }]
}

export class Rand {
  constructor(public state: RngState) {}
  next(): number { const [v, s] = rngNext(this.state); this.state = s; return v }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)) }
  normal(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-12)
    const v = this.next()
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  chance(p: number): boolean { return this.next() < p }
  pickWeighted<T>(items: T[], weight: (t: T) => number): T {
    const total = items.reduce((a, t) => a + weight(t), 0)
    let roll = this.next() * total
    for (const t of items) { roll -= weight(t); if (roll < 0) return t }
    return items[items.length - 1]!
  }
}
```

`packages/core/src/index.ts`에 추가:
```ts
export { createRng, rngNext, Rand, type RngState } from './rng/rng'
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pnpm --filter @bb/core test`
Expected: PASS 전체

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src
git commit -m "feat: mulberry32 시드 RNG"
```

---

### Task 3: 타입·BALANCE·GameError·테스트킷

**Files:**
- Create: `packages/core/src/types.ts`, `packages/core/src/balance.ts`, `packages/core/src/error.ts`, `packages/core/src/testkit.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/testkit.test.ts`

**Interfaces:**
- Produces (이후 모든 태스크의 기준 — 여기 정의된 이름·타입에서 벗어나지 말 것):

```ts
// types.ts 전문
import type { RngState } from './rng/rng'

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
  | { type: 'averageDown' }
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
}

export interface EndingResult { endingId: string; endingName: string; titles: string[]; finalAssets: number }

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
  status: 'playing' | 'ended'
  ending: EndingResult | null
}
```

```ts
// balance.ts 전문
export const BALANCE = {
  totalTurns: 156,
  seedMoney: 3_000_000,
  payPeriod: 4,                     // 4턴 = 1개월
  employedNet: 730_000,             // 재직 시 월 가처분 입금
  unemployedOut: 1_720_000,         // 퇴사 시 월 생활비 출금
  feeRate: 0.00015,
  taxRate: 0.0018,
  meanRev: 0.02,
  minPrice: 50,
  historyLen: 60,
  regime: {
    boom:       { drift: 0.004,  vol: 1.0 },
    overheat:   { drift: 0.012,  vol: 1.4 },
    crash:      { drift: -0.035, vol: 2.5 },
    stagnation: { drift: -0.003, vol: 0.8 },
    recovery:   { drift: 0.008,  vol: 1.2 },
  },
  mental: {
    lossHold: -3, lossHoldUnemployed: -6, worsenFactor: 0.5,
    margin: -8, cashCalm: 5, shakenMax: 29, resistPer: 0.06,
    sellBlockLossPct: 20,
  },
  condition: {
    drainEmployed: -4, drainUnemployed: -2, resistPer: 0.06,
    forcedSkipBelow: 20, forcedSkipChance: 0.4, forcedSkipPenalty: -5,
    burnoutTurns: 3, burnoutRecover: 30, burnoutMental: 10,
  },
  loan: { minTier: 3, rate: 0.0025, maxRatio: 0.9, callRatio: 1.3 },
  whale: { minTier: 5, notionalDiv: 2e10, maxImpact: 0.03 },
  tierMins: [0, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 3_000_000_000],
  rival: { start: 35_000_000, driftMul: 1.8, crashDecay: 0.93 },
  endings: {
    savingsBelow: 2_700_000, breakevenHigh: 3_300_000,
    bankHigh: 6_000_000, wiseHigh: 500_000_000, fireMin: 1_000_000_000,
  },
  maxEventsPerTurn: 2,
} as const

export const TIER_NAMES = ['주린이', '개미', '불개미', '슬기로운 개미', '슈퍼개미', '큰손'] as const
```

```ts
// error.ts 전문
export class GameError extends Error {
  constructor(public code: string, message?: string) { super(message ?? code); this.name = 'GameError' }
}
```

```ts
// testkit.ts — 시그니처
makeStockDef(over: Partial<StockDef> & { id: string }): StockDef
  // 기본: sector '금융', tierGate 0, initialPrice 10000, fundamental 10000, volatility 0, beta 0, hype 0
makeStock(over: Partial<StockState> & { id: string }): StockState
  // 기본: price 10000, fundamental 10000, history [10000]
makeState(over?: Partial<GameState>): GameState
  // 기본: turn 1, seed0 1, rng {s:1}, regimes 전부 'stagnation',
  // stockDefs/stocks: s1·s2 (vol 0 → 가격 정지), player: cash 3_000_000,
  // mental 80, condition 80, stats 전부 1(info·analysis 0), employed, tier 0,
  // 나머지 필드 빈 값/기본값
```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/testkit.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from './testkit'
import { BALANCE } from './balance'

describe('testkit', () => {
  it('makeState 기본값이 유효하다', () => {
    const s = makeState()
    expect(s.turn).toBe(1)
    expect(s.regimes).toHaveLength(BALANCE.totalTurns)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
    expect(s.stocks.map(x => x.id)).toEqual(['s1', 's2'])
    expect(s.stockDefs.map(x => x.id)).toEqual(['s1', 's2'])
  })
  it('override가 병합된다', () => {
    const s = makeState({ turn: 10 })
    expect(s.turn).toBe(10)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test` / Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현** — 위 Interfaces 블록의 `types.ts`·`balance.ts`·`error.ts` 전문을 그대로 파일로 작성하고, `testkit.ts`를 구현:

```ts
// packages/core/src/testkit.ts
import type { GameState, StockDef, StockState, Regime } from './types'
import { BALANCE } from './balance'

export function makeStockDef(over: Partial<StockDef> & { id: string }): StockDef {
  return { name: over.id, sector: '금융', tierGate: 0, initialPrice: 10000,
    fundamental: 10000, volatility: 0, beta: 0, hype: 0, ...over }
}
export function makeStock(over: Partial<StockState> & { id: string }): StockState {
  return { price: 10000, fundamental: 10000, history: [10000], ...over }
}
export function makeState(over: Partial<GameState> = {}): GameState {
  return {
    turn: 1, seed0: 1, rng: { s: 1 },
    regimes: Array(BALANCE.totalTurns).fill('stagnation') as Regime[],
    stockDefs: [makeStockDef({ id: 's1' }), makeStockDef({ id: 's2' })],
    stocks: [makeStock({ id: 's1' }), makeStock({ id: 's2' })],
    player: {
      cash: BALANCE.seedMoney, loan: 0, holdings: [],
      mental: 80, condition: 80, burnoutTurns: 0,
      stats: { grit: 1, stamina: 1, info: 0, analysis: 0, network: 1 },
      employed: true, tier: 0,
    },
    pendingImpacts: [], news: [], firedOneShots: [], flags: {},
    pendingChoices: [], rivalAssets: BALANCE.rival.start,
    trackers: { shakenTurns: 0, usedMargin: false, lossCuts: 0,
      maxHeldTurns: 0, cashRatioSum: 0, turnsCounted: 0 },
    prevLossPct: 0, cutscene: null, status: 'playing', ending: null,
    ...over,
  }
}
```

`index.ts`에 `export * from './types'`, `export { BALANCE, TIER_NAMES } from './balance'`, `export { GameError } from './error'` 추가. (testkit은 index에서 export하지 않는다 — 테스트·sim에서 상대경로/딥임포트로만 사용.)

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test` / Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src
git commit -m "feat: 코어 타입·BALANCE 상수·테스트킷"
```

---

### Task 4: 국면 시퀀스 생성

**Files:**
- Create: `packages/core/src/market/regimes.ts`
- Test: `packages/core/src/market/regimes.test.ts`

**Interfaces:**
- Consumes: `Rand`, `RngState` (Task 2), `Regime`, `BALANCE` (Task 3)
- Produces: `generateRegimes(rng: RngState, totalTurns?: number): [Regime[], RngState]`
  - 마르코프 전이, 국면당 8~30턴, 첫 국면은 `crash` 아님, 전체에 `crash` 최소 1회 포함.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/market/regimes.test.ts
import { describe, it, expect } from 'vitest'
import { createRng } from '../rng/rng'
import { generateRegimes } from './regimes'
import { BALANCE } from '../balance'

function runs(rs: string[]) {
  const out: { v: string; n: number }[] = []
  for (const r of rs) {
    const last = out[out.length - 1]
    if (last && last.v === r) last.n++
    else out.push({ v: r, n: 1 })
  }
  return out
}

describe('generateRegimes', () => {
  it('길이가 정확히 156이다', () => {
    const [rs] = generateRegimes(createRng(1))
    expect(rs).toHaveLength(BALANCE.totalTurns)
  })
  it('첫 국면은 crash가 아니다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [rs] = generateRegimes(createRng(seed))
      expect(rs[0]).not.toBe('crash')
    }
  })
  it('crash가 최소 1회 포함된다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const [rs] = generateRegimes(createRng(seed))
      expect(rs).toContain('crash')
    }
  })
  it('마지막 구간을 제외한 모든 구간 길이가 8 이상 30 이하다', () => {
    for (let seed = 0; seed < 100; seed++) {
      const [rs] = generateRegimes(createRng(seed))
      const rr = runs(rs)
      rr.slice(0, -1).forEach(r => {
        expect(r.n).toBeGreaterThanOrEqual(8)
        expect(r.n).toBeLessThanOrEqual(30)
      })
    }
  })
  it('같은 시드는 같은 결과', () => {
    const [a] = generateRegimes(createRng(77))
    const [b] = generateRegimes(createRng(77))
    expect(a).toEqual(b)
  })
  it('RngState를 진행시켜 반환한다', () => {
    const [, next] = generateRegimes(createRng(5))
    expect(next).not.toEqual(createRng(5))
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test regimes` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/market/regimes.ts
import { Rand, type RngState } from '../rng/rng'
import { BALANCE } from '../balance'
import type { Regime } from '../types'

const NEXT: Record<Regime, [Regime, number][]> = {
  boom:       [['overheat', 5], ['stagnation', 2], ['crash', 1]],
  overheat:   [['crash', 6], ['stagnation', 3], ['boom', 1]],
  crash:      [['stagnation', 5], ['recovery', 5]],
  stagnation: [['recovery', 5], ['boom', 2], ['crash', 2]],
  recovery:   [['boom', 6], ['stagnation', 3], ['crash', 1]],
}
const STARTS: Regime[] = ['boom', 'stagnation', 'recovery', 'overheat']

export function generateRegimes(rng: RngState, totalTurns = BALANCE.totalTurns): [Regime[], RngState] {
  const rand = new Rand(rng)
  for (let attempt = 0; attempt < 50; attempt++) {
    const out: Regime[] = []
    let cur: Regime = STARTS[rand.int(0, STARTS.length - 1)]!
    while (out.length < totalTurns) {
      const len = Math.min(rand.int(8, 30), totalTurns - out.length)
      for (let i = 0; i < len; i++) out.push(cur)
      cur = rand.pickWeighted(NEXT[cur], p => p[1])[0]
    }
    if (out.includes('crash')) return [out, rand.state]
  }
  // 폴백: 마지막 구간을 crash로 덮어 제약을 보장
  const out: Regime[] = Array(totalTurns).fill('stagnation')
  for (let i = totalTurns - 10; i < totalTurns; i++) out[i] = 'crash'
  return [out, rand.state]
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test regimes` / Expected: PASS 6

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/market
git commit -m "feat: 시장 국면 시퀀스 생성"
```

---

### Task 5: 종목 데이터 (stocks.json) + 로더

**Files:**
- Create: `packages/core/data/stocks.json`, `packages/core/src/market/stocks.ts`
- Test: `packages/core/src/market/stocks.test.ts`

**Interfaces:**
- Produces: `loadStockDefs(): StockDef[]`, `initStockStates(defs: StockDef[]): StockState[]`
- 종목 10개: 8섹터 일반주 각 1 + ETF 2 (`곱버스ETF` inv, `레버리지ETF` lev).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/market/stocks.test.ts
import { describe, it, expect } from 'vitest'
import { loadStockDefs, initStockStates } from './stocks'

describe('stocks 데이터', () => {
  const defs = loadStockDefs()
  it('10개다', () => expect(defs).toHaveLength(10))
  it('id가 유일하다', () => expect(new Set(defs.map(d => d.id)).size).toBe(10))
  it('8개 섹터가 모두 등장한다', () => {
    expect(new Set(defs.filter(d => !d.etf).map(d => d.sector)).size).toBe(8)
  })
  it('tierGate 0 종목이 3개 이상이다', () => {
    expect(defs.filter(d => d.tierGate === 0).length).toBeGreaterThanOrEqual(3)
  })
  it('수치가 유효 범위다', () => {
    defs.forEach(d => {
      expect(d.initialPrice).toBeGreaterThan(0)
      expect(d.fundamental).toBeGreaterThan(0)
      expect(d.volatility).toBeGreaterThan(0)
      expect(d.hype).toBeGreaterThanOrEqual(0)
      expect(d.hype).toBeLessThanOrEqual(1)
    })
  })
  it('ETF가 lev/inv 각 1개다', () => {
    expect(defs.filter(d => d.etf === 'lev')).toHaveLength(1)
    expect(defs.filter(d => d.etf === 'inv')).toHaveLength(1)
  })
  it('initStockStates가 초기가로 상태를 만든다', () => {
    const st = initStockStates(defs)
    expect(st).toHaveLength(10)
    expect(st[0]!.price).toBe(defs[0]!.initialPrice)
    expect(st[0]!.history).toEqual([defs[0]!.initialPrice])
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test stocks` / Expected: FAIL

- [ ] **Step 3: 구현**

`packages/core/data/stocks.json`:
```json
[
  { "id": "sjc",  "name": "삼정전자",       "sector": "반도체",  "tierGate": 0, "initialPrice": 71000, "fundamental": 78000, "volatility": 0.030, "beta": 1.0, "hype": 0.10 },
  { "id": "ecp",  "name": "에코프로형제",   "sector": "2차전지", "tierGate": 1, "initialPrice": 92000, "fundamental": 41000, "volatility": 0.085, "beta": 1.3, "hype": 0.95 },
  { "id": "bio",  "name": "한올바이오팜팜", "sector": "바이오",  "tierGate": 1, "initialPrice": 23500, "fundamental": 19000, "volatility": 0.075, "beta": 0.9, "hype": 0.80 },
  { "id": "shp",  "name": "HD한국조선해양양","sector": "조선",   "tierGate": 0, "initialPrice": 132000,"fundamental": 145000,"volatility": 0.042, "beta": 1.1, "hype": 0.25 },
  { "id": "gam",  "name": "크래프톤톤",     "sector": "게임",    "tierGate": 1, "initialPrice": 41000, "fundamental": 38000, "volatility": 0.055, "beta": 1.0, "hype": 0.45 },
  { "id": "bnk",  "name": "KB금융지주주",   "sector": "금융",    "tierGate": 0, "initialPrice": 68000, "fundamental": 74000, "volatility": 0.022, "beta": 0.6, "hype": 0.05 },
  { "id": "ent",  "name": "하이브브",       "sector": "엔터",    "tierGate": 1, "initialPrice": 185000,"fundamental": 160000,"volatility": 0.060, "beta": 1.0, "hype": 0.60 },
  { "id": "def",  "name": "두산로보뭐시기", "sector": "방산",    "tierGate": 2, "initialPrice": 78000, "fundamental": 32000, "volatility": 0.095, "beta": 1.2, "hype": 1.00 },
  { "id": "lev",  "name": "레버리지ETF",    "sector": "금융",    "tierGate": 4, "initialPrice": 15000, "fundamental": 15000, "volatility": 0.020, "beta": 2.0, "hype": 0.00, "etf": "lev" },
  { "id": "inv",  "name": "곱버스ETF",      "sector": "금융",    "tierGate": 4, "initialPrice": 4200,  "fundamental": 4200,  "volatility": 0.020, "beta": -2.0,"hype": 0.00, "etf": "inv" }
]
```

```ts
// packages/core/src/market/stocks.ts
import raw from '../../data/stocks.json'
import type { StockDef, StockState } from '../types'

export function loadStockDefs(): StockDef[] {
  return (raw as StockDef[]).map(d => ({ ...d }))
}

export function initStockStates(defs: StockDef[]): StockState[] {
  return defs.map(d => ({ id: d.id, price: d.initialPrice, fundamental: d.fundamental, history: [d.initialPrice] }))
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test stocks` / Expected: PASS 7

- [ ] **Step 5: 커밋**

```bash
git add packages/core/data packages/core/src/market
git commit -m "feat: 종목 10종 데이터 + 로더"
```

---

### Task 6: 주간 가격 갱신 엔진

**Files:**
- Create: `packages/core/src/market/price.ts`
- Test: `packages/core/src/market/price.test.ts`

**Interfaces:**
- Produces:
  - `stepPrices(stocks: StockState[], defs: StockDef[], regime: Regime, impacts: Map<string, number>, rng: RngState): [StockState[], RngState]`
    - `impacts` 키: `'market'` | `'stock:<id>'` | `'sector:<Sector>'`, 값은 로그수익률 충격 합.
    - 일반주: `r = drift*beta + N(0, vol*volMul) + impact*(1+hype) + meanRev*ln(fund/price)`
    - ETF: 평균회귀 없음, `fundamental`을 갱신된 `price`로 동기화.
    - 가격은 반올림 정수, 최소 `BALANCE.minPrice`. `history`는 최근 `BALANCE.historyLen`개 유지.
  - `applyWhaleImpact(price: number, notional: number, side: 'buy' | 'sell'): number`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/market/price.test.ts
import { describe, it, expect } from 'vitest'
import { createRng } from '../rng/rng'
import { stepPrices, applyWhaleImpact } from './price'
import { makeStockDef, makeStock } from '../testkit'
import { BALANCE } from '../balance'

const noImpact = new Map<string, number>()

describe('stepPrices', () => {
  it('변동성·베타 0이고 fundamental=price면 가격이 그대로다', () => {
    const defs = [makeStockDef({ id: 'a' })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBe(10000)
  })
  it('평균회귀: 저평가면 오른다', () => {
    const defs = [makeStockDef({ id: 'a', fundamental: 20000 })]
    const stocks = [makeStock({ id: 'a', price: 10000, fundamental: 20000 })]
    const [out] = stepPrices(stocks, defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
  })
  it('평균회귀: 고평가면 내린다', () => {
    const defs = [makeStockDef({ id: 'a', fundamental: 5000 })]
    const stocks = [makeStock({ id: 'a', price: 10000, fundamental: 5000 })]
    const [out] = stepPrices(stocks, defs, 'stagnation', noImpact, createRng(1))
    expect(out[0]!.price).toBeLessThan(10000)
  })
  it('crash 국면 드리프트가 가격을 떨어뜨린다', () => {
    const defs = [makeStockDef({ id: 'a', beta: 1 })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'crash', noImpact, createRng(1))
    expect(out[0]!.price).toBeLessThan(10000)
  })
  it('hype가 높을수록 충격이 증폭된다', () => {
    const lo = makeStockDef({ id: 'a', hype: 0 })
    const hi = makeStockDef({ id: 'a', hype: 1 })
    const imp = new Map([['stock:a', 0.1]])
    const [l] = stepPrices([makeStock({ id: 'a' })], [lo], 'stagnation', imp, createRng(1))
    const [h] = stepPrices([makeStock({ id: 'a' })], [hi], 'stagnation', imp, createRng(1))
    expect(h[0]!.price).toBeGreaterThan(l[0]!.price)
  })
  it('섹터 충격이 같은 섹터에만 적용된다', () => {
    const defs = [makeStockDef({ id: 'a', sector: '바이오' }), makeStockDef({ id: 'b', sector: '조선' })]
    const stocks = [makeStock({ id: 'a' }), makeStock({ id: 'b' })]
    const [out] = stepPrices(stocks, defs, 'stagnation', new Map([['sector:바이오', 0.2]]), createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
    expect(out[1]!.price).toBe(10000)
  })
  it('inv ETF는 시장 드리프트에 반대로 움직인다', () => {
    const defs = [makeStockDef({ id: 'i', beta: -2, etf: 'inv' })]
    const [out] = stepPrices([makeStock({ id: 'i' })], defs, 'crash', noImpact, createRng(1))
    expect(out[0]!.price).toBeGreaterThan(10000)
  })
  it('ETF는 fundamental이 price를 따라간다', () => {
    const defs = [makeStockDef({ id: 'l', beta: 2, etf: 'lev' })]
    const [out] = stepPrices([makeStock({ id: 'l' })], defs, 'boom', noImpact, createRng(1))
    expect(out[0]!.fundamental).toBe(out[0]!.price)
  })
  it('가격은 minPrice 아래로 안 내려간다', () => {
    const defs = [makeStockDef({ id: 'a', beta: 5, volatility: 0.5 })]
    let stocks = [makeStock({ id: 'a', price: 60, fundamental: 1 })]
    let rng = createRng(3)
    for (let i = 0; i < 60; i++) { const [s, r] = stepPrices(stocks, defs, 'crash', noImpact, rng); stocks = s; rng = r }
    expect(stocks[0]!.price).toBeGreaterThanOrEqual(BALANCE.minPrice)
  })
  it('history는 historyLen을 넘지 않는다', () => {
    const defs = [makeStockDef({ id: 'a' })]
    let stocks = [makeStock({ id: 'a' })]
    let rng = createRng(2)
    for (let i = 0; i < BALANCE.historyLen + 20; i++) { const [s, r] = stepPrices(stocks, defs, 'boom', noImpact, rng); stocks = s; rng = r }
    expect(stocks[0]!.history.length).toBe(BALANCE.historyLen)
  })
  it('가격은 정수다', () => {
    const defs = [makeStockDef({ id: 'a', volatility: 0.05, beta: 1 })]
    const [out] = stepPrices([makeStock({ id: 'a' })], defs, 'boom', noImpact, createRng(11))
    expect(Number.isInteger(out[0]!.price)).toBe(true)
  })
  it('입력 배열을 변경하지 않는다', () => {
    const defs = [makeStockDef({ id: 'a', beta: 1 })]
    const stocks = [makeStock({ id: 'a' })]
    stepPrices(stocks, defs, 'boom', noImpact, createRng(1))
    expect(stocks[0]!.price).toBe(10000)
    expect(stocks[0]!.history).toEqual([10000])
  })
})

describe('applyWhaleImpact', () => {
  it('매수는 가격을 올리고 매도는 내린다', () => {
    expect(applyWhaleImpact(10000, 1e10, 'buy')).toBeGreaterThan(10000)
    expect(applyWhaleImpact(10000, 1e10, 'sell')).toBeLessThan(10000)
  })
  it('충격은 maxImpact로 상한이 있다', () => {
    const p = applyWhaleImpact(10000, 1e15, 'buy')
    expect(p).toBeLessThanOrEqual(Math.round(10000 * (1 + BALANCE.whale.maxImpact)))
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test price` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/market/price.ts
import { Rand, type RngState } from '../rng/rng'
import { BALANCE } from '../balance'
import type { Regime, StockDef, StockState } from '../types'

export function stepPrices(
  stocks: StockState[], defs: StockDef[], regime: Regime,
  impacts: Map<string, number>, rng: RngState,
): [StockState[], RngState] {
  const rand = new Rand(rng)
  const { drift, vol } = BALANCE.regime[regime]
  const byId = new Map(defs.map(d => [d.id, d]))
  const market = impacts.get('market') ?? 0

  const out = stocks.map(s => {
    const d = byId.get(s.id)
    if (!d) return s
    const shock = market + (impacts.get(`stock:${s.id}`) ?? 0) + (impacts.get(`sector:${d.sector}`) ?? 0)
    let r = drift * d.beta
      + rand.normal(0, d.volatility * vol)
      + shock * (1 + d.hype)
    if (!d.etf) r += BALANCE.meanRev * Math.log(s.fundamental / s.price)

    const price = Math.max(BALANCE.minPrice, Math.round(s.price * Math.exp(r)))
    const history = [...s.history, price].slice(-BALANCE.historyLen)
    return { ...s, price, fundamental: d.etf ? price : s.fundamental, history }
  })
  return [out, rand.state]
}

export function applyWhaleImpact(price: number, notional: number, side: 'buy' | 'sell'): number {
  const mag = Math.min(BALANCE.whale.maxImpact, notional / BALANCE.whale.notionalDiv)
  const p = Math.round(price * (1 + (side === 'buy' ? mag : -mag)))
  return Math.max(BALANCE.minPrice, p)
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test price` / Expected: PASS 14

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/market
git commit -m "feat: 주간 가격 갱신 엔진 (국면·평균회귀·hype·ETF)"
```

---

### Task 7: 자산 회계 + 매수/매도

**Files:**
- Create: `packages/core/src/turn/accounting.ts`, `packages/core/src/turn/trade.ts`
- Test: `packages/core/src/turn/trade.test.ts`

**Interfaces:**
- Produces (accounting.ts):
  - `priceOf(state: GameState, stockId: string): number`
  - `holdingValue(state: GameState): number`
  - `totalAssets(state: GameState): number`  // cash + holdingValue − loan
  - `cashRatio(state: GameState): number`    // 0~1, 총자산 ≤ 0이면 1
  - `portfolioLossPct(state: GameState): number`  // 평가손실률 %, 손실 없으면 0
  - `positionLossPct(state: GameState, stockId: string): number`
- Produces (trade.ts):
  - `buy(state: GameState, stockId: string, qty: number): GameState`
  - `sell(state: GameState, stockId: string, qty: number): GameState`
  - `canBuy(state, stockId): { ok: boolean; reason?: string }`
  - `canSell(state, stockId): { ok: boolean; reason?: string }`
  - `maxBuyQty(state: GameState, stockId: string): number`
  - 실패 시 `GameError` throw (code: `TIER_LOCKED` | `NO_CASH` | `NO_QTY` | `SELL_BLOCKED` | `BAD_QTY` | `NO_STOCK` | `NOT_PLAYING`)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/turn/trade.test.ts
import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { buy, sell, canSell, maxBuyQty } from './trade'
import { totalAssets, cashRatio, portfolioLossPct } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'

describe('accounting', () => {
  it('보유 없으면 총자산 = 현금', () => {
    expect(totalAssets(makeState())).toBe(BALANCE.seedMoney)
  })
  it('총자산은 대출을 뺀다', () => {
    const s = makeState()
    s.player.loan = 1_000_000
    expect(totalAssets(s)).toBe(BALANCE.seedMoney - 1_000_000)
  })
  it('cashRatio가 비중을 반영한다', () => {
    const s = makeState()
    s.player.cash = 5000
    s.player.holdings = [{ stockId: 's1', qty: 1, avgCost: 10000, heldTurns: 0 }]
    expect(cashRatio(s)).toBeCloseTo(5000 / 15000, 5)
  })
  it('portfolioLossPct: 평가손실이 있으면 양수', () => {
    const s = makeState()
    s.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 20000, heldTurns: 0 }]
    expect(portfolioLossPct(s)).toBeCloseTo(50, 5)
  })
  it('portfolioLossPct: 수익이면 0', () => {
    const s = makeState()
    s.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 5000, heldTurns: 0 }]
    expect(portfolioLossPct(s)).toBe(0)
  })
})

describe('buy', () => {
  it('현금이 줄고 수량이 늘고 수수료가 붙는다', () => {
    const s = buy(makeState(), 's1', 10)
    const cost = 10 * 10000
    expect(s.player.cash).toBe(BALANCE.seedMoney - cost - Math.floor(cost * BALANCE.feeRate))
    expect(s.player.holdings[0]!.qty).toBe(10)
    expect(s.player.holdings[0]!.avgCost).toBe(10000)
  })
  it('추가 매수는 평단을 가중평균한다', () => {
    let s = makeState()
    s.stocks[0]!.price = 10000
    s = buy(s, 's1', 10)
    s.stocks[0]!.price = 20000
    s = buy(s, 's1', 10)
    expect(s.player.holdings[0]!.avgCost).toBe(15000)
    expect(s.player.holdings[0]!.qty).toBe(20)
  })
  it('현금 부족이면 NO_CASH', () => {
    expect(() => buy(makeState(), 's1', 10_000)).toThrow(GameError)
  })
  it('티어 미달이면 TIER_LOCKED', () => {
    const s = makeState({ stockDefs: [makeStockDef({ id: 's1', tierGate: 3 })], stocks: [makeStock({ id: 's1' })] })
    expect(() => buy(s, 's1', 1)).toThrow(/TIER_LOCKED/)
  })
  it('수량 0 이하는 BAD_QTY', () => {
    expect(() => buy(makeState(), 's1', 0)).toThrow(/BAD_QTY/)
  })
  it('maxBuyQty만큼은 항상 살 수 있다', () => {
    const s = makeState()
    const q = maxBuyQty(s, 's1')
    expect(q).toBeGreaterThan(0)
    expect(() => buy(s, 's1', q)).not.toThrow()
    expect(() => buy(s, 's1', q + 1)).toThrow()
  })
  it('원본 상태를 변경하지 않는다', () => {
    const s = makeState()
    buy(s, 's1', 10)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
    expect(s.player.holdings).toHaveLength(0)
  })
})

describe('sell', () => {
  it('수수료+세금을 뗀 금액이 입금된다', () => {
    let s = buy(makeState(), 's1', 10)
    const cashAfterBuy = s.player.cash
    s = sell(s, 's1', 10)
    const gross = 10 * 10000
    const net = gross - Math.floor(gross * BALANCE.feeRate) - Math.floor(gross * BALANCE.taxRate)
    expect(s.player.cash).toBe(cashAfterBuy + net)
    expect(s.player.holdings).toHaveLength(0)
  })
  it('왕복 거래는 반드시 손해다', () => {
    const before = totalAssets(makeState())
    const s = sell(buy(makeState(), 's1', 10), 's1', 10)
    expect(totalAssets(s)).toBeLessThan(before)
  })
  it('보유량 초과는 NO_QTY', () => {
    const s = buy(makeState(), 's1', 5)
    expect(() => sell(s, 's1', 6)).toThrow(/NO_QTY/)
  })
  it('멘탈 흔들림 + 손실 20% 이상이면 SELL_BLOCKED', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 7000
    s.player.mental = 10
    expect(canSell(s, 's1').ok).toBe(false)
    expect(() => sell(s, 's1', 1)).toThrow(/SELL_BLOCKED/)
  })
  it('멘탈 흔들림이어도 손실 20% 미만이면 팔린다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 9000
    s.player.mental = 10
    expect(canSell(s, 's1').ok).toBe(true)
  })
  it('멘탈이 정상이면 큰 손실도 팔린다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 3000
    s.player.mental = 80
    expect(() => sell(s, 's1', 10)).not.toThrow()
  })
  it('손절 시 lossCuts 트래커가 오른다', () => {
    let s = buy(makeState(), 's1', 10)
    s.stocks[0]!.price = 8000
    s = sell(s, 's1', 10)
    expect(s.trackers.lossCuts).toBe(1)
  })
  it('큰손 티어는 매도 시 주가를 누른다', () => {
    let s = makeState()
    s.player.tier = 5
    s.player.cash = 1e12
    s = buy(s, 's1', 5_000_000)
    const p = s.stocks[0]!.price
    s = sell(s, 's1', 5_000_000)
    expect(s.stocks[0]!.price).toBeLessThan(p)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test trade` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/turn/accounting.ts
import type { GameState } from '../types'

export function priceOf(state: GameState, stockId: string): number {
  const s = state.stocks.find(x => x.id === stockId)
  if (!s) throw new Error(`NO_STOCK:${stockId}`)
  return s.price
}
export function holdingValue(state: GameState): number {
  return state.player.holdings.reduce((a, h) => a + h.qty * priceOf(state, h.stockId), 0)
}
export function totalAssets(state: GameState): number {
  return state.player.cash + holdingValue(state) - state.player.loan
}
export function cashRatio(state: GameState): number {
  const t = totalAssets(state)
  return t <= 0 ? 1 : Math.min(1, state.player.cash / t)
}
export function portfolioLossPct(state: GameState): number {
  const cost = state.player.holdings.reduce((a, h) => a + h.qty * h.avgCost, 0)
  if (cost <= 0) return 0
  const val = holdingValue(state)
  return val >= cost ? 0 : ((cost - val) / cost) * 100
}
export function positionLossPct(state: GameState, stockId: string): number {
  const h = state.player.holdings.find(x => x.stockId === stockId)
  if (!h || h.avgCost <= 0) return 0
  const p = priceOf(state, stockId)
  return p >= h.avgCost ? 0 : ((h.avgCost - p) / h.avgCost) * 100
}
```

```ts
// packages/core/src/turn/trade.ts
import type { GameState, Holding } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { priceOf, positionLossPct } from './accounting'
import { applyWhaleImpact } from '../market/price'

const fee = (gross: number) => Math.floor(gross * BALANCE.feeRate)
const tax = (gross: number) => Math.floor(gross * BALANCE.taxRate)

export function canBuy(state: GameState, stockId: string): { ok: boolean; reason?: string } {
  if (state.status !== 'playing') return { ok: false, reason: 'NOT_PLAYING' }
  const def = state.stockDefs.find(d => d.id === stockId)
  if (!def) return { ok: false, reason: 'NO_STOCK' }
  if (state.player.tier < def.tierGate) return { ok: false, reason: 'TIER_LOCKED' }
  return { ok: true }
}

export function canSell(state: GameState, stockId: string): { ok: boolean; reason?: string } {
  if (state.status !== 'playing') return { ok: false, reason: 'NOT_PLAYING' }
  if (!state.player.holdings.some(h => h.stockId === stockId)) return { ok: false, reason: 'NO_QTY' }
  if (state.player.mental <= BALANCE.mental.shakenMax
    && positionLossPct(state, stockId) >= BALANCE.mental.sellBlockLossPct) {
    return { ok: false, reason: 'SELL_BLOCKED' }
  }
  return { ok: true }
}

export function maxBuyQty(state: GameState, stockId: string): number {
  const p = priceOf(state, stockId)
  return Math.max(0, Math.floor(state.player.cash / (p * (1 + BALANCE.feeRate))))
}

export function buy(state: GameState, stockId: string, qty: number): GameState {
  if (!Number.isInteger(qty) || qty <= 0) throw new GameError('BAD_QTY')
  const chk = canBuy(state, stockId)
  if (!chk.ok) throw new GameError(chk.reason!)

  const price = priceOf(state, stockId)
  const gross = price * qty
  const total = gross + fee(gross)
  if (total > state.player.cash) throw new GameError('NO_CASH')

  const prev = state.player.holdings.find(h => h.stockId === stockId)
  const holdings: Holding[] = prev
    ? state.player.holdings.map(h => h.stockId !== stockId ? h : {
        ...h, qty: h.qty + qty,
        avgCost: Math.round((h.qty * h.avgCost + gross) / (h.qty + qty)),
      })
    : [...state.player.holdings, { stockId, qty, avgCost: price, heldTurns: 0 }]

  let stocks = state.stocks
  if (state.player.tier >= BALANCE.whale.minTier) {
    const np = applyWhaleImpact(price, gross, 'buy')
    stocks = stocks.map(s => s.id === stockId ? { ...s, price: np } : s)
  }
  return { ...state, stocks, player: { ...state.player, cash: state.player.cash - total, holdings } }
}

export function sell(state: GameState, stockId: string, qty: number): GameState {
  if (!Number.isInteger(qty) || qty <= 0) throw new GameError('BAD_QTY')
  const held = state.player.holdings.find(h => h.stockId === stockId)
  if (!held || held.qty < qty) throw new GameError('NO_QTY')
  const chk = canSell(state, stockId)
  if (!chk.ok) throw new GameError(chk.reason!)

  const price = priceOf(state, stockId)
  const gross = price * qty
  const net = gross - fee(gross) - tax(gross)
  const isLossCut = price < held.avgCost

  const holdings = held.qty === qty
    ? state.player.holdings.filter(h => h.stockId !== stockId)
    : state.player.holdings.map(h => h.stockId === stockId ? { ...h, qty: h.qty - qty } : h)

  let stocks = state.stocks
  if (state.player.tier >= BALANCE.whale.minTier) {
    const np = applyWhaleImpact(price, gross, 'sell')
    stocks = stocks.map(s => s.id === stockId ? { ...s, price: np } : s)
  }
  return {
    ...state, stocks,
    player: { ...state.player, cash: state.player.cash + net, holdings },
    trackers: { ...state.trackers, lossCuts: state.trackers.lossCuts + (isLossCut ? 1 : 0) },
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test trade` / Expected: PASS 19

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/turn
git commit -m "feat: 자산 회계 + 매수/매도 (수수료·세금·손절봉인·큰손충격)"
```

---

### Task 8: 신용거래 (대출·이자·반대매매)

**Files:**
- Create: `packages/core/src/turn/margin.ts`
- Test: `packages/core/src/turn/margin.test.ts`

**Interfaces:**
- Consumes: `totalAssets`, `holdingValue` (Task 7)
- Produces:
  - `maxLoan(state: GameState): number`  // 순자산 × maxRatio − 기존대출, 티어 미달이면 0
  - `takeLoan(state: GameState, amount: number): GameState`
  - `repayLoan(state: GameState, amount: number): GameState`
  - `accrueInterest(state: GameState): GameState`
  - `checkMarginCall(state: GameState): GameState`  // 담보비율 붕괴 시 전량 강제청산

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/turn/margin.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { maxLoan, takeLoan, repayLoan, accrueInterest, checkMarginCall } from './margin'
import { buy } from './trade'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const tiered = () => { const s = makeState(); s.player.tier = 3; return s }

describe('margin', () => {
  it('티어 미달이면 대출 불가', () => {
    expect(maxLoan(makeState())).toBe(0)
    expect(() => takeLoan(makeState(), 1_000_000)).toThrow(GameError)
  })
  it('대출은 현금과 loan을 동시에 늘린다', () => {
    const s = takeLoan(tiered(), 1_000_000)
    expect(s.player.cash).toBe(BALANCE.seedMoney + 1_000_000)
    expect(s.player.loan).toBe(1_000_000)
    expect(s.trackers.usedMargin).toBe(true)
  })
  it('한도 초과는 거부된다', () => {
    const s = tiered()
    expect(() => takeLoan(s, maxLoan(s) + 1)).toThrow(/LOAN_LIMIT/)
  })
  it('상환은 현금과 loan을 줄인다', () => {
    const s = repayLoan(takeLoan(tiered(), 1_000_000), 400_000)
    expect(s.player.loan).toBe(600_000)
    expect(s.player.cash).toBe(BALANCE.seedMoney + 600_000)
  })
  it('보유액 초과 상환은 거부된다', () => {
    expect(() => repayLoan(takeLoan(tiered(), 1_000_000), 2_000_000)).toThrow(/BAD_AMOUNT/)
  })
  it('이자가 loan에 붙는다', () => {
    const s = accrueInterest(takeLoan(tiered(), 1_000_000))
    expect(s.player.loan).toBe(1_000_000 + Math.round(1_000_000 * BALANCE.loan.rate))
  })
  it('대출 없으면 이자도 없다', () => {
    expect(accrueInterest(makeState()).player.loan).toBe(0)
  })
  it('담보 붕괴 시 전량 청산되고 flag가 선다', () => {
    let s = tiered()
    s = takeLoan(s, 2_000_000)
    s = buy(s, 's1', 400)
    s.stocks[0]!.price = 500
    const after = checkMarginCall(s)
    expect(after.player.holdings).toHaveLength(0)
    expect(after.flags['marginCalled']).toBe(true)
  })
  it('건전하면 청산하지 않는다', () => {
    const s = buy(takeLoan(tiered(), 500_000), 's1', 10)
    expect(checkMarginCall(s).player.holdings).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test margin` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/turn/margin.ts
import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { holdingValue, totalAssets, priceOf } from './accounting'

export function maxLoan(state: GameState): number {
  if (state.player.tier < BALANCE.loan.minTier) return 0
  return Math.max(0, Math.floor(totalAssets(state) * BALANCE.loan.maxRatio) - state.player.loan)
}

export function takeLoan(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) throw new GameError('BAD_AMOUNT')
  if (state.player.tier < BALANCE.loan.minTier) throw new GameError('TIER_LOCKED')
  if (amount > maxLoan(state)) throw new GameError('LOAN_LIMIT')
  return {
    ...state,
    player: { ...state.player, cash: state.player.cash + amount, loan: state.player.loan + amount },
    trackers: { ...state.trackers, usedMargin: true },
  }
}

export function repayLoan(state: GameState, amount: number): GameState {
  if (!Number.isFinite(amount) || amount <= 0) throw new GameError('BAD_AMOUNT')
  if (amount > state.player.loan || amount > state.player.cash) throw new GameError('BAD_AMOUNT')
  return { ...state, player: { ...state.player, cash: state.player.cash - amount, loan: state.player.loan - amount } }
}

export function accrueInterest(state: GameState): GameState {
  if (state.player.loan <= 0) return state
  const interest = Math.round(state.player.loan * BALANCE.loan.rate)
  return { ...state, player: { ...state.player, loan: state.player.loan + interest } }
}

/** 담보(현금+평가액)가 대출의 callRatio 배 아래로 내려가면 전량 강제청산 후 상환. */
export function checkMarginCall(state: GameState): GameState {
  const { loan } = state.player
  if (loan <= 0) return state
  const collateral = state.player.cash + holdingValue(state)
  if (collateral >= loan * BALANCE.loan.callRatio) return state

  let proceeds = 0
  for (const h of state.player.holdings) {
    const gross = h.qty * priceOf(state, h.stockId)
    proceeds += gross - Math.floor(gross * BALANCE.feeRate) - Math.floor(gross * BALANCE.taxRate)
  }
  const cash = state.player.cash + proceeds
  const repaid = Math.min(cash, loan)
  return {
    ...state,
    player: { ...state.player, holdings: [], cash: cash - repaid, loan: loan - repaid },
    flags: { ...state.flags, marginCalled: true },
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test margin` / Expected: PASS 9

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/turn
git commit -m "feat: 신용거래 (대출 한도·이자·반대매매)"
```

---

### Task 9: 멘탈 규칙 + 데드락 부재 속성 테스트

**Files:**
- Create: `packages/core/src/mental/mental.ts`
- Test: `packages/core/src/mental/mental.test.ts`

**Interfaces:**
- Consumes: `cashRatio`, `portfolioLossPct` (Task 7)
- Produces:
  - `isShaken(state: GameState): boolean`  // mental ≤ 29
  - `mentalResist(grit: number): number`   // 1 − grit×0.06, 하한 0.2
  - `settleMental(state: GameState, recoveryDelta: number): GameState`
    - 감소 항: 손실 보유(재직 −3 / 퇴사 −6), 손실 악화(악화%p × 0.5), 신용 사용 중 −8
    - 감소 합계에만 강인함 저항 적용. 증가 항(현금 비중 ≥50% +5, `recoveryDelta`)은 저항 무관.
    - 결과를 0~100으로 클램프, `prevLossPct` 갱신, 흔들림이면 `trackers.shakenTurns` +1.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/mental/mental.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { settleMental, isShaken, mentalResist } from './mental'
import { BALANCE } from '../balance'

/** 보유 손실률을 pct%로 만든 상태 */
function losing(pct: number, mental = 80) {
  const s = makeState()
  s.player.mental = mental
  s.player.cash = 0
  s.player.holdings = [{ stockId: 's1', qty: 10, avgCost: Math.round(10000 / (1 - pct / 100)), heldTurns: 0 }]
  return s
}

describe('mental', () => {
  it('흔들림 경계는 29/30이다', () => {
    expect(isShaken(makeState({ player: { ...makeState().player, mental: 29 } }))).toBe(true)
    expect(isShaken(makeState({ player: { ...makeState().player, mental: 30 } }))).toBe(false)
  })
  it('강인함이 저항을 키운다', () => {
    expect(mentalResist(0)).toBe(1)
    expect(mentalResist(10)).toBeCloseTo(0.4, 5)
    expect(mentalResist(100)).toBe(0.2)
  })
  it('손실 없고 현금뿐이면 현금 안정 보너스만 붙는다', () => {
    const s = settleMental(makeState({ player: { ...makeState().player, mental: 50 } }), 0)
    expect(s.player.mental).toBe(50 + BALANCE.mental.cashCalm)
  })
  it('손실 보유는 매 턴 깎는다', () => {
    const s = losing(10)
    s.prevLossPct = 10
    expect(settleMental(s, 0).player.mental).toBeLessThan(80)
  })
  it('손실 악화가 추가로 깎는다', () => {
    const worse = losing(30); worse.prevLossPct = 10
    const same = losing(30); same.prevLossPct = 30
    expect(settleMental(worse, 0).player.mental).toBeLessThan(settleMental(same, 0).player.mental)
  })
  it('손실이 회복되면 악화 감소는 없다', () => {
    const s = losing(10); s.prevLossPct = 40
    const r = settleMental(s, 0)
    expect(r.player.mental).toBe(80 + BALANCE.mental.lossHold)
  })
  it('퇴사자는 손실 고정감소가 2배다', () => {
    const emp = losing(10); emp.prevLossPct = 10
    const un = losing(10); un.prevLossPct = 10; un.player.employed = false
    expect(settleMental(un, 0).player.mental).toBeLessThan(settleMental(emp, 0).player.mental)
  })
  it('신용 사용 중이면 -8이 붙는다', () => {
    const a = makeState({ player: { ...makeState().player, mental: 50 } })
    const b = makeState({ player: { ...makeState().player, mental: 50, loan: 1_000_000 } })
    expect(settleMental(b, 0).player.mental).toBe(settleMental(a, 0).player.mental + BALANCE.mental.margin)
  })
  it('강인함이 높으면 같은 상황에서 덜 깎인다', () => {
    const weak = losing(40); weak.prevLossPct = 0
    const tough = losing(40); tough.prevLossPct = 0
    tough.player.stats = { ...tough.player.stats, grit: 10 }
    expect(settleMental(tough, 0).player.mental).toBeGreaterThan(settleMental(weak, 0).player.mental)
  })
  it('0~100으로 클램프된다', () => {
    const lo = losing(99, 3); lo.prevLossPct = 0
    expect(settleMental(lo, 0).player.mental).toBeGreaterThanOrEqual(0)
    const hi = makeState({ player: { ...makeState().player, mental: 98 } })
    expect(settleMental(hi, 20).player.mental).toBe(100)
  })
  it('흔들림 턴이 트래킹된다', () => {
    const s = makeState({ player: { ...makeState().player, mental: 10 } })
    expect(settleMental(s, 0).trackers.shakenTurns).toBe(1)
  })
  it('prevLossPct가 갱신된다', () => {
    const s = losing(25); s.prevLossPct = 0
    expect(settleMental(s, 0).prevLossPct).toBeCloseTo(25, 5)
  })

  // 스펙 §3.3 데드락 부재 보증
  it('신용 없이 손실 악화가 멈추면 회복 카드 반복으로 반드시 탈출한다', () => {
    for (const pct of [10, 30, 50, 70, 90, 99]) {
      let s = losing(pct, 0)
      s.prevLossPct = pct
      s.player.employed = false          // 최악 조건
      s.player.stats = { ...s.player.stats, grit: 0 }
      let escaped = false
      for (let i = 0; i < 40; i++) {
        s = settleMental(s, 20)
        if (s.player.mental >= 30) { escaped = true; break }
      }
      expect(escaped).toBe(true)
    }
  })
  it('신용 미사용 시 최악 순증가가 +14 이상이다', () => {
    let s = losing(99, 0); s.prevLossPct = 99; s.player.employed = false
    const after = settleMental(s, 20)
    expect(after.player.mental - 0).toBeGreaterThanOrEqual(14)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test mental` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/mental/mental.ts
import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { cashRatio, portfolioLossPct } from '../turn/accounting'

export function isShaken(state: GameState): boolean {
  return state.player.mental <= BALANCE.mental.shakenMax
}

export function mentalResist(grit: number): number {
  return Math.max(0.2, 1 - grit * BALANCE.mental.resistPer)
}

export function settleMental(state: GameState, recoveryDelta: number): GameState {
  const m = BALANCE.mental
  const loss = portfolioLossPct(state)

  let drop = 0
  if (loss > 0) drop += state.player.employed ? m.lossHold : m.lossHoldUnemployed
  const worsen = loss - state.prevLossPct
  if (worsen > 0) drop += -(worsen * m.worsenFactor)
  if (state.player.loan > 0) drop += m.margin

  let gain = recoveryDelta
  if (cashRatio(state) >= 0.5) gain += m.cashCalm

  const delta = drop * mentalResist(state.player.stats.grit) + gain
  const mental = Math.max(0, Math.min(100, Math.round(state.player.mental + delta)))

  return {
    ...state,
    player: { ...state.player, mental },
    prevLossPct: loss,
    trackers: {
      ...state.trackers,
      shakenTurns: state.trackers.shakenTurns + (mental <= m.shakenMax ? 1 : 0),
    },
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test mental` / Expected: PASS 14

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/mental
git commit -m "feat: 멘탈 규칙 + 데드락 부재 속성 테스트"
```

---

### Task 10: 컨디션·번아웃

**Files:**
- Create: `packages/core/src/mental/condition.ts`
- Test: `packages/core/src/mental/condition.test.ts`

**Interfaces:**
- Produces:
  - `settleCondition(state: GameState, delta: number): GameState`
    - 기본 소모(재직 −4 / 퇴사 −2)에 체력 저항 적용, `delta`(카드 회복)는 저항 무관. 0~100 클램프.
    - 결과 0 → `burnoutTurns = 3`, `condition = 30`, `mental += 10`(클램프).
  - `rollForcedSkip(state: GameState): [boolean, GameState]`
    - 번아웃 중이면 무조건 스킵(`burnoutTurns` 1 감소).
    - 아니면 컨디션 < 20에서 40% 확률로 야근 스킵, 스킵 시 컨디션 −5.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/mental/condition.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { settleCondition, rollForcedSkip } from './condition'
import { BALANCE } from '../balance'

describe('condition', () => {
  it('재직자는 매 턴 소모된다', () => {
    expect(settleCondition(makeState(), 0).player.condition).toBe(80 + BALANCE.condition.drainEmployed)
  })
  it('퇴사자는 덜 소모된다', () => {
    const s = makeState(); s.player.employed = false
    expect(settleCondition(s, 0).player.condition).toBe(80 + BALANCE.condition.drainUnemployed)
  })
  it('체력이 높으면 덜 소모된다', () => {
    const s = makeState(); s.player.stats = { ...s.player.stats, stamina: 10 }
    expect(settleCondition(s, 0).player.condition).toBeGreaterThan(settleCondition(makeState(), 0).player.condition)
  })
  it('카드 회복은 저항 없이 그대로 더해진다', () => {
    const s = makeState(); s.player.condition = 50
    expect(settleCondition(s, 30).player.condition).toBe(50 + 30 + BALANCE.condition.drainEmployed)
  })
  it('100을 넘지 않는다', () => {
    const s = makeState(); s.player.condition = 95
    expect(settleCondition(s, 40).player.condition).toBe(100)
  })
  it('0에 닿으면 번아웃 진입', () => {
    const s = makeState(); s.player.condition = 2
    const r = settleCondition(s, 0)
    expect(r.player.burnoutTurns).toBe(BALANCE.condition.burnoutTurns)
    expect(r.player.condition).toBe(BALANCE.condition.burnoutRecover)
    expect(r.player.mental).toBe(80 + BALANCE.condition.burnoutMental)
  })
  it('번아웃 중에는 항상 스킵되고 카운터가 준다', () => {
    const s = makeState(); s.player.burnoutTurns = 2
    const [skip, next] = rollForcedSkip(s)
    expect(skip).toBe(true)
    expect(next.player.burnoutTurns).toBe(1)
  })
  it('컨디션이 높으면 스킵되지 않는다', () => {
    const s = makeState(); s.player.condition = 90
    expect(rollForcedSkip(s)[0]).toBe(false)
  })
  it('컨디션이 낮으면 가끔 스킵된다', () => {
    let s = makeState(); s.player.condition = 5
    let skips = 0
    for (let i = 0; i < 200; i++) { const [sk, n] = rollForcedSkip(s); if (sk) skips++; s = { ...n, player: { ...n.player, condition: 5 } } }
    expect(skips).toBeGreaterThan(30)
    expect(skips).toBeLessThan(170)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test condition` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/mental/condition.ts
import type { GameState } from '../types'
import { BALANCE } from '../balance'
import { Rand } from '../rng/rng'

const resist = (stamina: number) => Math.max(0.2, 1 - stamina * BALANCE.condition.resistPer)

export function settleCondition(state: GameState, delta: number): GameState {
  const c = BALANCE.condition
  const drain = (state.player.employed ? c.drainEmployed : c.drainUnemployed) * resist(state.player.stats.stamina)
  let condition = Math.max(0, Math.min(100, Math.round(state.player.condition + drain + delta)))
  let { burnoutTurns, mental } = state.player

  if (condition <= 0) {
    burnoutTurns = c.burnoutTurns
    condition = c.burnoutRecover
    mental = Math.max(0, Math.min(100, mental + c.burnoutMental))
  }
  return { ...state, player: { ...state.player, condition, burnoutTurns, mental } }
}

export function rollForcedSkip(state: GameState): [boolean, GameState] {
  const c = BALANCE.condition
  if (state.player.burnoutTurns > 0) {
    return [true, { ...state, player: { ...state.player, burnoutTurns: state.player.burnoutTurns - 1 } }]
  }
  if (state.player.condition >= c.forcedSkipBelow) return [false, state]

  const rand = new Rand(state.rng)
  const skip = rand.chance(c.forcedSkipChance)
  const condition = skip
    ? Math.max(0, state.player.condition + c.forcedSkipPenalty)
    : state.player.condition
  return [skip, { ...state, rng: rand.state, player: { ...state.player, condition } }]
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test condition` / Expected: PASS 9

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/mental
git commit -m "feat: 컨디션·번아웃·야근 강제 스킵"
```

---

### Task 11: Condition 평가기 · Effect 실행기 · 행동 카드

**Files:**
- Create: `packages/core/src/turn/conditions.ts`, `packages/core/src/turn/effects.ts`, `packages/core/src/turn/cards.ts`, `packages/core/data/cards.json`
- Test: `packages/core/src/turn/conditions.test.ts`, `packages/core/src/turn/cards.test.ts`

**Interfaces:**
- Produces (conditions.ts): `evalCondition(state: GameState, c: Condition): boolean`, `evalAll(state, cs?: Condition[]): boolean`
- Produces (effects.ts): `applyEffects(state: GameState, effects: Effect[]): GameState`
  - `mental` 효과는 즉시 반영하지 않고 `state.flags.__mentalPending`에 누적한다 (턴 정산에서 `settleMental`의 `recoveryDelta`로 소비).
  - `condition` 효과도 `__conditionPending`에 누적한다.
  - 이유: 회복량에 저항이 걸리지 않아야 하고, 정산 순서를 한 곳으로 모아야 데드락 보증이 성립한다.
- Produces (cards.ts): `loadCards(): ActionCardDef[]`, `isCardAvailable(state, card): boolean`, `playCard(state: GameState, cardId: string): GameState`
  - 스탯은 0~10 클램프. `lockedWhenShaken && isShaken` 이면 사용 불가 — 단 `isRecovery`는 언제나 사용 가능.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/turn/conditions.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { evalCondition, evalAll } from './conditions'
import { applyEffects } from './effects'

describe('evalCondition', () => {
  it('tierMin / tierMax', () => {
    const s = makeState(); s.player.tier = 2
    expect(evalCondition(s, { type: 'tierMin', value: 2 })).toBe(true)
    expect(evalCondition(s, { type: 'tierMin', value: 3 })).toBe(false)
    expect(evalCondition(s, { type: 'tierMax', value: 2 })).toBe(true)
  })
  it('turnMin / turnMax', () => {
    const s = makeState({ turn: 60 })
    expect(evalCondition(s, { type: 'turnMin', value: 60 })).toBe(true)
    expect(evalCondition(s, { type: 'turnMax', value: 59 })).toBe(false)
  })
  it('regime는 현재 턴 국면을 본다', () => {
    const s = makeState({ turn: 3 }); s.regimes[2] = 'crash'
    expect(evalCondition(s, { type: 'regime', value: 'crash' })).toBe(true)
    expect(evalCondition(s, { type: 'regime', value: 'boom' })).toBe(false)
  })
  it('statMin', () => {
    const s = makeState(); s.player.stats.info = 5
    expect(evalCondition(s, { type: 'statMin', stat: 'info', value: 5 })).toBe(true)
    expect(evalCondition(s, { type: 'statMin', stat: 'analysis', value: 1 })).toBe(false)
  })
  it('assetsMin / assetsMax / employed / mentalMax', () => {
    const s = makeState()
    expect(evalCondition(s, { type: 'assetsMin', value: 3_000_000 })).toBe(true)
    expect(evalCondition(s, { type: 'assetsMax', value: 1 })).toBe(false)
    expect(evalCondition(s, { type: 'employed', value: true })).toBe(true)
    expect(evalCondition(s, { type: 'mentalMax', value: 79 })).toBe(false)
  })
  it('flagEq / flagMin / flagAbsent', () => {
    const s = makeState(); s.flags = { k: 3, done: true }
    expect(evalCondition(s, { type: 'flagEq', key: 'done', value: true })).toBe(true)
    expect(evalCondition(s, { type: 'flagMin', key: 'k', value: 3 })).toBe(true)
    expect(evalCondition(s, { type: 'flagMin', key: 'zz', value: 1 })).toBe(false)
    expect(evalCondition(s, { type: 'flagAbsent', key: 'zz' })).toBe(true)
    expect(evalCondition(s, { type: 'flagAbsent', key: 'k' })).toBe(false)
  })
  it('holdsStock', () => {
    const s = makeState(); s.player.holdings = [{ stockId: 's1', qty: 1, avgCost: 1, heldTurns: 0 }]
    expect(evalCondition(s, { type: 'holdsStock', stockId: 's1' })).toBe(true)
    expect(evalCondition(s, { type: 'holdsStock', stockId: 's2' })).toBe(false)
  })
  it('evalAll: 빈 배열/undefined는 true', () => {
    expect(evalAll(makeState(), [])).toBe(true)
    expect(evalAll(makeState(), undefined)).toBe(true)
  })
})

describe('applyEffects', () => {
  it('stat은 0~10으로 클램프된다', () => {
    const up = applyEffects(makeState(), [{ type: 'stat', stat: 'info', delta: 99 }])
    expect(up.player.stats.info).toBe(10)
    const down = applyEffects(makeState(), [{ type: 'stat', stat: 'info', delta: -99 }])
    expect(down.player.stats.info).toBe(0)
  })
  it('cash는 즉시 반영된다', () => {
    expect(applyEffects(makeState(), [{ type: 'cash', delta: -1000 }]).player.cash).toBe(2_999_000)
  })
  it('mental/condition은 pending에 누적된다', () => {
    const s = applyEffects(makeState(), [{ type: 'mental', delta: 20 }, { type: 'condition', delta: 30 }])
    expect(s.player.mental).toBe(80)
    expect(s.flags['__mentalPending']).toBe(20)
    expect(s.flags['__conditionPending']).toBe(30)
  })
  it('flag inc는 1씩 증가시킨다', () => {
    let s = applyEffects(makeState(), [{ type: 'flag', key: 'n', value: 'inc' }])
    s = applyEffects(s, [{ type: 'flag', key: 'n', value: 'inc' }])
    expect(s.flags['n']).toBe(2)
  })
  it('impact는 pendingImpacts에 예약된다', () => {
    const s = applyEffects(makeState({ turn: 5 }), [
      { type: 'impact', target: 'stock:s1', magnitude: 0.1, delay: 2, title: '호재' },
    ])
    expect(s.pendingImpacts[0]).toMatchObject({ target: 'stock:s1', dueTurn: 7, revealed: false })
  })
  it('retire는 고용 상태를 끈다', () => {
    expect(applyEffects(makeState(), [{ type: 'retire' }]).player.employed).toBe(false)
  })
  it('rivalMul은 라이벌 자산을 곱한다', () => {
    const s = applyEffects(makeState(), [{ type: 'rivalMul', value: 2 }])
    expect(s.rivalAssets).toBe(makeState().rivalAssets * 2)
  })
  it('fundamentalMul은 내재가치를 바꾼다', () => {
    const s = applyEffects(makeState(), [{ type: 'fundamentalMul', stockId: 's1', value: 1.5 }])
    expect(s.stocks[0]!.fundamental).toBe(15000)
  })
  it('averageDown은 손실 종목을 현금 20%로 추가매수한다', () => {
    const base = makeState()
    base.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 20000, heldTurns: 0 }]
    const s = applyEffects(base, [{ type: 'averageDown' }])
    expect(s.player.holdings[0]!.qty).toBeGreaterThan(10)
    expect(s.player.cash).toBeLessThan(base.player.cash)
  })
  it('buyStockPct는 살 수 없으면 조용히 넘어간다', () => {
    const s = makeState(); s.player.cash = 0
    expect(() => applyEffects(s, [{ type: 'buyStockPct', stockId: 's1', pct: 0.5 }])).not.toThrow()
  })
})
```

```ts
// packages/core/src/turn/cards.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { loadCards, isCardAvailable, playCard } from './cards'
import { GameError } from '../error'

const cards = loadCards()
const byId = (id: string) => cards.find(c => c.id === id)!

describe('cards 데이터', () => {
  it('12장이고 id가 유일하다', () => {
    expect(cards).toHaveLength(12)
    expect(new Set(cards.map(c => c.id)).size).toBe(12)
  })
  it('회복 카드가 3장 있고 전부 lockedWhenShaken이 아니다', () => {
    const rec = cards.filter(c => c.isRecovery)
    expect(rec).toHaveLength(3)
    rec.forEach(c => expect(c.lockedWhenShaken).toBeFalsy())
  })
  it('이성 카드 4장이 흔들림에 잠긴다', () => {
    expect(cards.filter(c => c.lockedWhenShaken)).toHaveLength(4)
  })
  it('각 육성 스탯을 올리는 카드가 최소 1장씩 있다', () => {
    for (const st of ['grit', 'stamina', 'info', 'analysis', 'network'] as const) {
      expect(cards.some(c => c.effects.some(e => e.type === 'stat' && e.stat === st && e.delta > 0))).toBe(true)
    }
  })
})

describe('isCardAvailable', () => {
  it('정상 멘탈에서는 이성 카드가 열린다', () => {
    expect(isCardAvailable(makeState(), byId('analyze'))).toBe(true)
  })
  it('흔들림에서 이성 카드가 잠긴다', () => {
    const s = makeState(); s.player.mental = 10
    expect(isCardAvailable(s, byId('analyze'))).toBe(false)
  })
  it('흔들림에서도 회복 카드는 열린다 (스펙 §3.3 불변 규칙)', () => {
    const s = makeState(); s.player.mental = 0
    cards.filter(c => c.isRecovery).forEach(c => expect(isCardAvailable(s, c)).toBe(true))
  })
  it('현금이 부족하면 비용 있는 카드가 잠긴다', () => {
    const s = makeState(); s.player.cash = 0
    const paid = cards.find(c => (c.cost?.money ?? 0) > 0)!
    expect(isCardAvailable(s, paid)).toBe(false)
  })
})

describe('playCard', () => {
  it('효과가 적용된다', () => {
    expect(playCard(makeState(), 'analyze').player.stats.analysis).toBeGreaterThan(0)
  })
  it('비용이 차감된다', () => {
    const paid = cards.find(c => (c.cost?.money ?? 0) > 0)!
    const s = playCard(makeState(), paid.id)
    expect(s.player.cash).toBeLessThan(makeState().player.cash)
  })
  it('야근은 돈을 벌고 컨디션을 깎는다', () => {
    const s = playCard(makeState(), 'overtime')
    expect(s.player.cash).toBeGreaterThan(makeState().player.cash)
    expect(s.flags['__conditionPending']).toBeLessThan(0)
  })
  it('잠긴 카드는 CARD_LOCKED', () => {
    const s = makeState(); s.player.mental = 5
    expect(() => playCard(s, 'analyze')).toThrow(GameError)
  })
  it('없는 카드는 NO_CARD', () => {
    expect(() => playCard(makeState(), 'nope')).toThrow(/NO_CARD/)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/turn/conditions.ts
import type { Condition, GameState } from '../types'
import { totalAssets } from './accounting'

export function evalCondition(state: GameState, c: Condition): boolean {
  const p = state.player
  switch (c.type) {
    case 'tierMin': return p.tier >= c.value
    case 'tierMax': return p.tier <= c.value
    case 'turnMin': return state.turn >= c.value
    case 'turnMax': return state.turn <= c.value
    case 'regime': return state.regimes[state.turn - 1] === c.value
    case 'statMin': return p.stats[c.stat] >= c.value
    case 'assetsMin': return totalAssets(state) >= c.value
    case 'assetsMax': return totalAssets(state) <= c.value
    case 'employed': return p.employed === c.value
    case 'mentalMax': return p.mental <= c.value
    case 'flagEq': return state.flags[c.key] === c.value
    case 'flagMin': return Number(state.flags[c.key] ?? 0) >= c.value
    case 'flagAbsent': return state.flags[c.key] === undefined
    case 'holdsStock': return p.holdings.some(h => h.stockId === c.stockId)
  }
}

export function evalAll(state: GameState, cs?: Condition[]): boolean {
  return !cs || cs.every(c => evalCondition(state, c))
}
```

```ts
// packages/core/src/turn/effects.ts
import type { Effect, GameState, StatKey } from '../types'
import { buy, maxBuyQty } from './trade'
import { priceOf } from './accounting'

const clampStat = (v: number) => Math.max(0, Math.min(10, Math.round(v * 10) / 10))
const bump = (s: GameState, key: string, delta: number): GameState =>
  ({ ...s, flags: { ...s.flags, [key]: Number(s.flags[key] ?? 0) + delta } })

function buyWithBudget(state: GameState, stockId: string, budget: number): GameState {
  const price = priceOf(state, stockId)
  const qty = Math.min(maxBuyQty(state, stockId), Math.floor(budget / price))
  if (qty <= 0) return state
  try { return buy(state, stockId, qty) } catch { return state }
}

export function applyEffects(state: GameState, effects: Effect[]): GameState {
  let s = state
  for (const e of effects) {
    switch (e.type) {
      case 'stat': {
        const stat = e.stat as StatKey
        s = { ...s, player: { ...s.player, stats: { ...s.player.stats, [stat]: clampStat(s.player.stats[stat] + e.delta) } } }
        break
      }
      case 'mental': s = bump(s, '__mentalPending', e.delta); break
      case 'condition': s = bump(s, '__conditionPending', e.delta); break
      case 'cash': s = { ...s, player: { ...s.player, cash: Math.max(0, s.player.cash + e.delta) } }; break
      case 'flag':
        s = e.value === 'inc'
          ? bump(s, e.key, 1)
          : { ...s, flags: { ...s.flags, [e.key]: e.value } }
        break
      case 'impact':
        s = { ...s, pendingImpacts: [...s.pendingImpacts, {
          target: e.target, magnitude: e.magnitude,
          dueTurn: s.turn + e.delay, revealTurn: s.turn, revealed: false, title: e.title,
        }] }
        break
      case 'retire': s = { ...s, player: { ...s.player, employed: false } }; break
      case 'rivalMul': s = { ...s, rivalAssets: Math.round(s.rivalAssets * e.value) }; break
      case 'fundamentalMul':
        s = { ...s, stocks: s.stocks.map(x => x.id === e.stockId ? { ...x, fundamental: Math.round(x.fundamental * e.value) } : x) }
        break
      case 'buyStockPct': s = buyWithBudget(s, e.stockId, s.player.cash * e.pct); break
      case 'averageDown': {
        const losing = s.player.holdings
          .filter(h => priceOf(s, h.stockId) < h.avgCost)
          .sort((a, b) => priceOf(s, a.stockId) / a.avgCost - priceOf(s, b.stockId) / b.avgCost)[0]
        if (losing) s = buyWithBudget(s, losing.stockId, s.player.cash * 0.2)
        break
      }
    }
  }
  return s
}
```

`packages/core/data/cards.json`:
```json
[
  { "id": "overtime", "name": "야근", "desc": "부장님이 아직 안 갔다.",
    "effects": [{ "type": "cash", "delta": 180000 }, { "type": "condition", "delta": -18 }],
    "requires": [{ "type": "employed", "value": true }] },
  { "id": "analyze", "name": "기업분석", "desc": "사업보고서를 연다. 졸립다.",
    "effects": [{ "type": "stat", "stat": "analysis", "delta": 0.5 }, { "type": "condition", "delta": -6 }],
    "lockedWhenShaken": true },
  { "id": "report", "name": "리포트 정독", "desc": "증권사 리포트. 목표가는 항상 위에 있다.",
    "effects": [{ "type": "stat", "stat": "analysis", "delta": 0.35 }, { "type": "stat", "stat": "info", "delta": 0.15 }],
    "requires": [{ "type": "tierMin", "value": 2 }], "lockedWhenShaken": true },
  { "id": "news", "name": "뉴스 탐독", "desc": "경제신문 정주행.",
    "effects": [{ "type": "stat", "stat": "info", "delta": 0.45 }, { "type": "condition", "delta": -4 }],
    "lockedWhenShaken": true },
  { "id": "study", "name": "주식 스터디", "desc": "잃어본 사람들끼리 모인다.",
    "effects": [{ "type": "stat", "stat": "grit", "delta": 0.4 }, { "type": "stat", "stat": "network", "delta": 0.1 }, { "type": "cash", "delta": -30000 }],
    "lockedWhenShaken": true },
  { "id": "community", "name": "커뮤니티 눈팅", "desc": "다들 나보다 잘 번다.",
    "effects": [{ "type": "stat", "stat": "info", "delta": 0.3 }, { "type": "mental", "delta": -6 }] },
  { "id": "forum", "name": "종토방 투어", "desc": "형님들이 부른다.",
    "effects": [{ "type": "stat", "stat": "network", "delta": 0.45 }, { "type": "mental", "delta": -3 }] },
  { "id": "avgdown", "name": "물타기", "desc": "평단을 낮추면 되지 않을까.",
    "effects": [{ "type": "averageDown" }] },
  { "id": "hodl", "name": "존버", "desc": "아무것도 하지 않는다. 그것이 전략이다.",
    "effects": [{ "type": "mental", "delta": 4 }, { "type": "condition", "delta": 6 }] },
  { "id": "rest", "name": "휴식", "desc": "앱을 지운다. 3일 만에 다시 깐다.",
    "effects": [{ "type": "mental", "delta": 20 }, { "type": "condition", "delta": 10 }], "isRecovery": true },
  { "id": "exercise", "name": "운동", "desc": "런닝머신 위에서도 호가창을 본다.",
    "effects": [{ "type": "condition", "delta": 30 }, { "type": "mental", "delta": 6 }, { "type": "stat", "stat": "stamina", "delta": 0.35 }], "isRecovery": true },
  { "id": "drink", "name": "최존버와 소주", "desc": "형은 15년째 그거 하나만 들고 있다.",
    "effects": [{ "type": "mental", "delta": 24 }, { "type": "stat", "stat": "network", "delta": 0.25 }, { "type": "stat", "stat": "grit", "delta": 0.15 }, { "type": "cash", "delta": -40000 }, { "type": "condition", "delta": -8 }], "isRecovery": true }
]
```

```ts
// packages/core/src/turn/cards.ts
import raw from '../../data/cards.json'
import type { ActionCardDef, GameState } from '../types'
import { GameError } from '../error'
import { isShaken } from '../mental/mental'
import { evalAll } from './conditions'
import { applyEffects } from './effects'

export function loadCards(): ActionCardDef[] { return raw as ActionCardDef[] }

export function isCardAvailable(state: GameState, card: ActionCardDef): boolean {
  if (!evalAll(state, card.requires)) return false
  if ((card.cost?.money ?? 0) > state.player.cash) return false
  const moneyCost = card.effects.find(e => e.type === 'cash' && e.delta < 0)
  if (moneyCost && moneyCost.type === 'cash' && state.player.cash + moneyCost.delta < 0) return false
  if (card.isRecovery) return true          // 스펙 §3.3: 회복 카드는 절대 잠기지 않는다
  if (card.lockedWhenShaken && isShaken(state)) return false
  return true
}

export function playCard(state: GameState, cardId: string): GameState {
  const card = loadCards().find(c => c.id === cardId)
  if (!card) throw new GameError('NO_CARD')
  if (!isCardAvailable(state, card)) throw new GameError('CARD_LOCKED')

  let s = state
  if (card.cost?.money) s = applyEffects(s, [{ type: 'cash', delta: -card.cost.money }])
  if (card.cost?.condition) s = applyEffects(s, [{ type: 'condition', delta: -card.cost.condition }])
  return applyEffects(s, card.effects)
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test` / Expected: PASS 전체

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/turn packages/core/data/cards.json
git commit -m "feat: 조건 평가기·효과 실행기·행동 카드 12종"
```

---

### Task 12: 이벤트 엔진 (추첨·지연 반영·루머·선택지)

**Files:**
- Create: `packages/core/src/events/engine.ts`
- Test: `packages/core/src/events/engine.test.ts`

**Interfaces:**
- Produces:
  - `rumorLead(info: number): number`  // 정보력→미리보기 리드 턴 (0~3)
  - `rumorChance(info: number): number`
  - `resolveImpacts(state: GameState): [Map<string, number>, GameState]` — 만기 도달분을 뽑아 impacts 맵 반환, 목록에서 제거
  - `revealRumors(state: GameState): GameState` — 정보력 기준으로 `news`에 `rumor` 추가, `revealed: true` 표시
  - `drawEvents(state: GameState, pool: EventDef[]): GameState` — 조건 통과 이벤트를 가중 추첨(최대 `BALANCE.maxEventsPerTurn`), 선택지 없으면 즉시 적용, 있으면 `pendingChoices`에 적재
  - `resolveChoice(state: GameState, eventId: string, choiceIndex: number, pool: EventDef[]): GameState`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/events/engine.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { resolveImpacts, revealRumors, drawEvents, resolveChoice, rumorLead } from './engine'
import type { EventDef } from '../types'
import { BALANCE } from '../balance'

const ev = (over: Partial<EventDef> & { id: string }): EventDef => ({
  category: 'news', weight: 1, text: { title: over.id, body: '본문' }, ...over,
})

describe('resolveImpacts', () => {
  it('만기 도달분만 반환하고 목록에서 제거한다', () => {
    const s = makeState({ turn: 5, pendingImpacts: [
      { target: 'stock:s1', magnitude: 0.1, dueTurn: 5, revealTurn: 3, revealed: true, title: 'a' },
      { target: 'market', magnitude: -0.05, dueTurn: 7, revealTurn: 5, revealed: false, title: 'b' },
    ] })
    const [map, next] = resolveImpacts(s)
    expect(map.get('stock:s1')).toBeCloseTo(0.1, 6)
    expect(map.has('market')).toBe(false)
    expect(next.pendingImpacts).toHaveLength(1)
  })
  it('같은 타깃 충격은 합산된다', () => {
    const s = makeState({ turn: 2, pendingImpacts: [
      { target: 'market', magnitude: 0.1, dueTurn: 2, revealTurn: 1, revealed: true, title: 'a' },
      { target: 'market', magnitude: 0.2, dueTurn: 2, revealTurn: 1, revealed: true, title: 'b' },
    ] })
    expect(resolveImpacts(s)[0].get('market')).toBeCloseTo(0.3, 6)
  })
})

describe('revealRumors', () => {
  const pending = (turn: number) => makeState({ turn, pendingImpacts: [
    { target: 'stock:s1', magnitude: 0.2, dueTurn: turn + 2, revealTurn: turn, revealed: false, title: '수주 임박' },
  ] })
  it('정보력 0이면 루머가 안 보인다', () => {
    expect(rumorLead(0)).toBe(0)
    expect(revealRumors(pending(5)).news.filter(n => n.kind === 'rumor')).toHaveLength(0)
  })
  it('정보력이 높으면 루머가 보인다', () => {
    const s = pending(5); s.player.stats.info = 10
    expect(revealRumors(s).news.some(n => n.kind === 'rumor')).toBe(true)
  })
  it('같은 루머를 두 번 노출하지 않는다', () => {
    let s = pending(5); s.player.stats.info = 10
    s = revealRumors(s)
    const n1 = s.news.length
    s = revealRumors(s)
    expect(s.news.length).toBe(n1)
  })
})

describe('drawEvents', () => {
  it('조건 불만족 이벤트는 안 뽑힌다', () => {
    const pool = [ev({ id: 'locked', conditions: [{ type: 'tierMin', value: 5 }] })]
    expect(drawEvents(makeState(), pool).news.some(n => n.title === 'locked')).toBe(false)
  })
  it('턴당 최대 개수를 넘지 않는다', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ev({ id: `e${i}` }))
    const s = drawEvents(makeState(), pool)
    expect(s.news.filter(n => n.turn === 1).length).toBeLessThanOrEqual(BALANCE.maxEventsPerTurn)
  })
  it('oneShot은 재발화하지 않는다', () => {
    const pool = [ev({ id: 'once', oneShot: true })]
    let s = drawEvents(makeState(), pool)
    expect(s.firedOneShots).toContain('once')
    const before = s.news.length
    s = drawEvents({ ...s, turn: 2 }, pool)
    expect(s.news.length).toBe(before)
  })
  it('effects가 즉시 적용된다', () => {
    const pool = [ev({ id: 'e', effects: [{ type: 'stat', stat: 'info', delta: 1 }] })]
    expect(drawEvents(makeState(), pool).player.stats.info).toBe(1)
  })
  it('impact는 예약된다', () => {
    const pool = [ev({ id: 'e', impact: { target: 'sector:바이오', magnitude: 0.3, delay: 2 } })]
    const s = drawEvents(makeState({ turn: 4 }), pool)
    expect(s.pendingImpacts[0]).toMatchObject({ target: 'sector:바이오', dueTurn: 6 })
  })
  it('선택지 있는 이벤트는 pendingChoices로 간다', () => {
    const pool = [ev({ id: 'pick', choices: [{ label: 'A', effects: [] }] })]
    const s = drawEvents(makeState(), pool)
    expect(s.pendingChoices).toEqual([{ eventId: 'pick' }])
  })
})

describe('resolveChoice', () => {
  const pool = [ev({ id: 'pick', choices: [
    { label: '넣는다', effects: [{ type: 'cash', delta: -500000 }, { type: 'flag', key: 'kim', value: 'inc' }] },
    { label: '거절', effects: [] },
  ] })]
  it('선택 효과가 적용되고 대기열에서 빠진다', () => {
    const s = resolveChoice(makeState({ pendingChoices: [{ eventId: 'pick' }] }), 'pick', 0, pool)
    expect(s.player.cash).toBe(2_500_000)
    expect(s.flags['kim']).toBe(1)
    expect(s.pendingChoices).toHaveLength(0)
  })
  it('잘못된 인덱스는 BAD_CHOICE', () => {
    expect(() => resolveChoice(makeState({ pendingChoices: [{ eventId: 'pick' }] }), 'pick', 9, pool)).toThrow(/BAD_CHOICE/)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test engine` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/events/engine.ts
import type { EventDef, GameState } from '../types'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { Rand } from '../rng/rng'
import { evalAll } from '../turn/conditions'
import { applyEffects } from '../turn/effects'

export function rumorLead(info: number): number {
  if (info >= 9) return 3
  if (info >= 6) return 2
  if (info >= 3) return 1
  return 0
}
export function rumorChance(info: number): number {
  if (info >= 9) return 0.9
  if (info >= 6) return 0.7
  if (info >= 3) return 0.5
  return 0
}

export function resolveImpacts(state: GameState): [Map<string, number>, GameState] {
  const due = new Map<string, number>()
  const rest = []
  for (const p of state.pendingImpacts) {
    if (p.dueTurn <= state.turn) due.set(p.target, (due.get(p.target) ?? 0) + p.magnitude)
    else rest.push(p)
  }
  return [due, { ...state, pendingImpacts: rest }]
}

export function revealRumors(state: GameState): GameState {
  const info = state.player.stats.info
  const lead = rumorLead(info)
  if (lead === 0) return state

  const rand = new Rand(state.rng)
  const news = [...state.news]
  const pendingImpacts = state.pendingImpacts.map(p => {
    if (p.revealed || p.dueTurn - state.turn > lead) return p
    if (!rand.chance(rumorChance(info))) return p
    news.push({ turn: state.turn, kind: 'rumor', title: `[루머] ${p.title}` })
    return { ...p, revealed: true }
  })
  return { ...state, rng: rand.state, news, pendingImpacts }
}

export function drawEvents(state: GameState, pool: EventDef[]): GameState {
  const rand = new Rand(state.rng)
  let s: GameState = { ...state, rng: rand.state }

  const eligible = pool.filter(e =>
    !(e.oneShot && s.firedOneShots.includes(e.id)) && evalAll(s, e.conditions))

  const picked: EventDef[] = []
  const remaining = [...eligible]
  const count = Math.min(BALANCE.maxEventsPerTurn, remaining.length)
  for (let i = 0; i < count; i++) {
    const e = rand.pickWeighted(remaining, x => x.weight)
    picked.push(e)
    remaining.splice(remaining.indexOf(e), 1)
  }
  s = { ...s, rng: rand.state }

  for (const e of picked) {
    if (e.oneShot) s = { ...s, firedOneShots: [...s.firedOneShots, e.id] }
    s = { ...s, news: [...s.news, { turn: s.turn, kind: 'news', title: e.text.title }] }
    if (e.impact) {
      s = applyEffects(s, [{ type: 'impact', ...e.impact, title: e.text.title }])
    }
    if (e.choices?.length) s = { ...s, pendingChoices: [...s.pendingChoices, { eventId: e.id }] }
    else if (e.effects) s = applyEffects(s, e.effects)
  }
  return s
}

export function resolveChoice(state: GameState, eventId: string, choiceIndex: number, pool: EventDef[]): GameState {
  const def = pool.find(e => e.id === eventId)
  const choice = def?.choices?.[choiceIndex]
  if (!def || !choice) throw new GameError('BAD_CHOICE')
  const s = applyEffects(state, choice.effects)
  return { ...s, pendingChoices: s.pendingChoices.filter(c => c.eventId !== eventId) }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test engine` / Expected: PASS 13

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/events
git commit -m "feat: 이벤트 엔진 (가중 추첨·지연 반영·정보력 루머·선택지)"
```

---

### Task 13: 이벤트 콘텐츠 60종 + 로더

**Files:**
- Create: `packages/core/data/events/news.json`(20), `company.json`(10), `personal.json`(10), `social.json`(10), `story.json`(10), `packages/core/src/events/content.ts`
- Test: `packages/core/src/events/content.test.ts`

**Interfaces:**
- Produces: `loadEvents(): EventDef[]`, `loadContent(): ContentBundle`
- 스토리 플래그 규약 (Task 17 엔딩이 읽는다):
  - `kim` — 김실장 제안 수락 횟수 (`flag inc`)
  - `momIgnored` — 엄마 전화 무시 횟수 (`flag inc`)
  - `retired` — 퇴사 여부 (`flag` true)
  - `choSaid` — 최존버 조언 수용 횟수
  - `marginCalled` — 반대매매 발생 (Task 8이 설정)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/events/content.test.ts
import { describe, it, expect } from 'vitest'
import { loadEvents } from './content'
import { loadStockDefs } from '../market/stocks'
import { makeState } from '../testkit'
import { drawEvents } from './engine'
import type { Sector } from '../types'

const events = loadEvents()
const stockIds = new Set(loadStockDefs().map(s => s.id))
const SECTORS: Sector[] = ['반도체', '2차전지', '바이오', '조선', '게임', '금융', '엔터', '방산']

describe('이벤트 콘텐츠', () => {
  it('60종 이상이고 id가 유일하다', () => {
    expect(events.length).toBeGreaterThanOrEqual(60)
    expect(new Set(events.map(e => e.id)).size).toBe(events.length)
  })
  it('5개 카테고리가 모두 있다', () => {
    for (const c of ['news', 'company', 'personal', 'social', 'story']) {
      expect(events.some(e => e.category === c)).toBe(true)
    }
  })
  it('weight가 양수다', () => events.forEach(e => expect(e.weight).toBeGreaterThan(0)))
  it('제목·본문이 비어있지 않다', () => {
    events.forEach(e => { expect(e.text.title.length).toBeGreaterThan(0); expect(e.text.body.length).toBeGreaterThan(0) })
  })
  it('impact 타깃이 실존한다', () => {
    events.forEach(e => {
      const t = e.impact?.target
      if (!t || t === 'market') return
      if (t.startsWith('stock:')) expect(stockIds.has(t.slice(6))).toBe(true)
      else if (t.startsWith('sector:')) expect(SECTORS).toContain(t.slice(7) as Sector)
      else throw new Error(`잘못된 타깃: ${t}`)
    })
  })
  it('effects의 종목 참조가 실존한다', () => {
    const all = events.flatMap(e => [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)])
    all.forEach(f => {
      if (f.type === 'buyStockPct' || f.type === 'fundamentalMul') expect(stockIds.has(f.stockId)).toBe(true)
      if (f.type === 'impact' && f.target.startsWith('stock:')) expect(stockIds.has(f.target.slice(6))).toBe(true)
    })
  })
  it('선택지는 2개 이상이다', () => {
    events.filter(e => e.choices).forEach(e => expect(e.choices!.length).toBeGreaterThanOrEqual(2))
  })
  it('김실장·엄마·최존버·퇴사 플래그가 존재한다', () => {
    const keys = new Set(events.flatMap(e => [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)])
      .filter(f => f.type === 'flag').map(f => (f as { key: string }).key))
    for (const k of ['kim', 'momIgnored', 'choSaid', 'retired']) expect(keys.has(k)).toBe(true)
  })
  it('퇴사 이벤트가 정확히 하나이고 oneShot이다', () => {
    const r = events.filter(e => [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)].some(f => f.type === 'retire'))
    expect(r).toHaveLength(1)
    expect(r[0]!.oneShot).toBe(true)
    expect(r[0]!.conditions).toEqual(expect.arrayContaining([
      { type: 'assetsMin', value: 300_000_000 }, { type: 'turnMin', value: 60 },
    ]))
  })
  it('1턴 주린이 상태에서도 뽑을 이벤트가 있다', () => {
    const s = drawEvents(makeState(), events)
    expect(s.news.length).toBeGreaterThan(0)
  })
  it('156턴 전체를 돌려도 예외가 없다', () => {
    let s = makeState()
    for (let t = 1; t <= 156; t++) { s = drawEvents({ ...s, turn: t }, events); s = { ...s, pendingChoices: [] } }
    expect(s.news.length).toBeGreaterThan(50)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test content` / Expected: FAIL

- [ ] **Step 3: 구현**

먼저 로더:
```ts
// packages/core/src/events/content.ts
import news from '../../data/events/news.json'
import company from '../../data/events/company.json'
import personal from '../../data/events/personal.json'
import social from '../../data/events/social.json'
import story from '../../data/events/story.json'
import type { ContentBundle, EventDef } from '../types'
import { loadCards } from '../turn/cards'

export function loadEvents(): EventDef[] {
  return [...news, ...company, ...personal, ...social, ...story] as EventDef[]
}
export function loadContent(): ContentBundle {
  return { cards: loadCards(), events: loadEvents() }
}
```

다음 데이터 5개 파일. 각 이벤트는 아래 형태를 따른다. 아래는 **각 파일의 시작 2~3개 실물 예시**이며, 나머지는 같은 스키마·같은 톤(자조적 현실, 매운맛)으로 채워 파일별 개수를 맞춘다: news 20, company 10, personal 10, social 10, story 10.

`data/events/news.json` (시장·섹터 뉴스, 대부분 `impact` 보유):
```json
[
  { "id": "n_semi_boom", "category": "news", "weight": 10,
    "conditions": [{ "type": "regime", "value": "boom" }],
    "impact": { "target": "sector:반도체", "magnitude": 0.09, "delay": 2 },
    "text": { "title": "메모리 고정가 3개월 연속 상승", "body": "업황이 돌았다는 리포트가 쏟아진다. 늘 그렇듯 주가는 이미 움직인 뒤다." } },
  { "id": "n_rate_hike", "category": "news", "weight": 8,
    "impact": { "target": "market", "magnitude": -0.06, "delay": 1 },
    "text": { "title": "연준, 금리 동결에서 인상으로 선회", "body": "성장주부터 무너진다. 내 계좌는 대부분 성장주였다." } },
  { "id": "n_taxi", "category": "news", "weight": 6,
    "conditions": [{ "type": "regime", "value": "overheat" }],
    "impact": { "target": "market", "magnitude": 0.05, "delay": 1 },
    "text": { "title": "택시기사도 종목을 추천하는 시대", "body": "다들 벌었다고 한다. 이럴 때 사는 게 맞나 싶으면서도 손이 나간다." } }
]
```

`data/events/company.json` (개별 종목 실적·공시, `fundamentalMul` + `impact`):
```json
[
  { "id": "c_sjc_beat", "category": "company", "weight": 7,
    "impact": { "target": "stock:sjc", "magnitude": 0.07, "delay": 1 },
    "effects": [{ "type": "fundamentalMul", "stockId": "sjc", "value": 1.12 }],
    "text": { "title": "삼정전자, 컨센서스 상회", "body": "영업이익이 시장 기대를 웃돌았다. 안 들고 있으면 남 얘기다." } },
  { "id": "c_ecp_dilution", "category": "company", "weight": 7,
    "impact": { "target": "stock:ecp", "magnitude": -0.16, "delay": 1 },
    "effects": [{ "type": "fundamentalMul", "stockId": "ecp", "value": 0.85 }],
    "text": { "title": "에코프로형제 유상증자 공시", "body": "성장을 위한 투자라고 한다. 주주는 그 성장의 비용이다." } }
]
```

`data/events/personal.json` (회사·건강·가족, 선택지 포함):
```json
[
  { "id": "p_mom_call", "category": "personal", "weight": 9,
    "text": { "title": "엄마한테 전화가 왔다", "body": "\"요즘 뭐 하고 사니. 적금은 붓고 있지?\"", "speaker": "mom" },
    "choices": [
      { "label": "받는다", "effects": [{ "type": "mental", "delta": 8 }] },
      { "label": "나중에 하자", "effects": [{ "type": "flag", "key": "momIgnored", "value": "inc" }, { "type": "mental", "delta": -4 }] }
    ] },
  { "id": "p_boss_watch", "category": "personal", "weight": 8,
    "conditions": [{ "type": "employed", "value": true }],
    "text": { "title": "부장님이 뒤에 서 있다", "body": "장중에 호가창을 보고 있었다. 알트탭이 늦었다." },
    "choices": [
      { "label": "야근으로 만회한다", "effects": [{ "type": "condition", "delta": -14 }] },
      { "label": "모른 척한다", "effects": [{ "type": "mental", "delta": -8 }] }
    ] }
]
```

`data/events/social.json` (커뮤니티·리딩방·박대박, `network` 게이트):
```json
[
  { "id": "s_kim_offer", "category": "social", "weight": 6,
    "conditions": [{ "type": "statMin", "stat": "network", "value": 4 }],
    "text": { "title": "김실장이 DM을 보냈다", "body": "\"이번 건은 확실합니다. 딱 이번만 알려드리는 거예요.\"", "speaker": "kim" },
    "choices": [
      { "label": "따라 들어간다", "effects": [{ "type": "flag", "key": "kim", "value": "inc" }, { "type": "buyStockPct", "stockId": "def", "pct": 0.3 }, { "type": "impact", "target": "stock:def", "magnitude": 0.14, "delay": 1, "title": "방산 수주 기대" }] },
      { "label": "무시한다", "effects": [{ "type": "impact", "target": "stock:def", "magnitude": 0.1, "delay": 1, "title": "방산 테마 급등" }] }
    ] },
  { "id": "s_daebak_flex", "category": "social", "weight": 9,
    "text": { "title": "박대박이 계좌를 인증했다", "body": "단톡방에 수익률 캡처가 올라왔다. 세 자리 수다.", "speaker": "daebak" },
    "effects": [{ "type": "mental", "delta": -6 }, { "type": "rivalMul", "value": 1.15 }] }
]
```

`data/events/story.json` (oneShot 서사, 퇴사·최존버·김실장 결말):
```json
[
  { "id": "st_retire", "category": "story", "weight": 40, "oneShot": true,
    "conditions": [{ "type": "assetsMin", "value": 300000000 }, { "type": "turnMin", "value": 60 }],
    "text": { "title": "사표를 쓸까", "body": "계좌가 3억을 넘었다. 이 회사에 더 있을 이유를 찾기 어렵다." },
    "choices": [
      { "label": "퇴사한다", "effects": [{ "type": "retire" }, { "type": "flag", "key": "retired", "value": true }, { "type": "mental", "delta": 15 }] },
      { "label": "일단 다닌다", "effects": [{ "type": "stat", "stat": "grit", "delta": 0.5 }] }
    ] },
  { "id": "st_cho_advice", "category": "story", "weight": 20, "oneShot": true,
    "conditions": [{ "type": "turnMin", "value": 30 }, { "type": "mentalMax", "value": 40 }],
    "text": { "title": "최존버가 말을 걸었다", "body": "\"버티는 건 버틸 만한 걸 들고 있을 때만 하는 거야.\"", "speaker": "cho" },
    "choices": [
      { "label": "새겨듣는다", "effects": [{ "type": "flag", "key": "choSaid", "value": "inc" }, { "type": "stat", "stat": "grit", "delta": 1 }, { "type": "mental", "delta": 12 }] },
      { "label": "형이 뭘 알아", "effects": [{ "type": "mental", "delta": -5 }] }
    ] },
  { "id": "st_kim_room", "category": "story", "weight": 30, "oneShot": true,
    "conditions": [{ "type": "flagMin", "key": "kim", "value": 3 }, { "type": "statMin", "stat": "network", "value": 7 }],
    "text": { "title": "김실장이 제안했다", "body": "\"이제 받는 쪽 말고 주는 쪽을 해보시죠. 방 하나 파드릴게요.\"", "speaker": "kim" },
    "choices": [
      { "label": "방을 연다", "effects": [{ "type": "flag", "key": "kimRoom", "value": true }, { "type": "stat", "stat": "network", "delta": 2 }, { "type": "cash", "delta": 5000000 }] },
      { "label": "거기까진 아니다", "effects": [{ "type": "mental", "delta": 10 }] }
    ] }
]
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test content` / Expected: PASS 11

- [ ] **Step 5: 커밋**

```bash
git add packages/core/data/events packages/core/src/events
git commit -m "feat: 이벤트 콘텐츠 60종 + 로더"
```

---

### Task 14: 월급·티어·라이벌

**Files:**
- Create: `packages/core/src/turn/economy.ts`
- Test: `packages/core/src/turn/economy.test.ts`

**Interfaces:**
- Produces:
  - `settlePayroll(state: GameState): GameState` — `turn % payPeriod === 0`일 때만. 재직: `+730,000`, 퇴사: `−1,720,000`(현금 부족 시 0까지만).
  - `tierOf(assets: number): Tier`
  - `settleTier(state: GameState): GameState` — 히스테리시스: 승급은 기준 이상, 강등은 현재 티어 기준의 90% 미만일 때만. 변동 시 `cutscene`을 `cutscene.promote.<tier>` / `cutscene.demote.<tier>`로 설정.
  - `stepRival(state: GameState): GameState` — 라이벌은 국면 드리프트 ×1.8로 굴리고, crash 국면엔 0.93 감쇠를 추가로 곱한다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/turn/economy.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { settlePayroll, tierOf, settleTier, stepRival } from './economy'
import { BALANCE } from '../balance'

describe('settlePayroll', () => {
  it('payPeriod 배수 턴에만 정산한다', () => {
    expect(settlePayroll(makeState({ turn: 3 })).player.cash).toBe(BALANCE.seedMoney)
    expect(settlePayroll(makeState({ turn: 4 })).player.cash).toBe(BALANCE.seedMoney + BALANCE.employedNet)
  })
  it('퇴사자는 생활비가 빠진다', () => {
    const s = makeState({ turn: 4 }); s.player.employed = false
    expect(settlePayroll(s).player.cash).toBe(BALANCE.seedMoney - BALANCE.unemployedOut)
  })
  it('현금이 부족해도 음수가 되지 않는다', () => {
    const s = makeState({ turn: 4 }); s.player.employed = false; s.player.cash = 100
    expect(settlePayroll(s).player.cash).toBe(0)
  })
})

describe('tierOf', () => {
  it('경계값이 맞다', () => {
    expect(tierOf(0)).toBe(0)
    expect(tierOf(9_999_999)).toBe(0)
    expect(tierOf(10_000_000)).toBe(1)
    expect(tierOf(500_000_000)).toBe(4)
    expect(tierOf(3_000_000_000)).toBe(5)
    expect(tierOf(-1)).toBe(0)
  })
})

describe('settleTier', () => {
  it('승급 시 컷신 플래그가 선다', () => {
    const s = makeState(); s.player.cash = 12_000_000
    const r = settleTier(s)
    expect(r.player.tier).toBe(1)
    expect(r.cutscene).toBe('cutscene.promote.1')
  })
  it('히스테리시스: 기준의 90% 이상이면 강등되지 않는다', () => {
    const s = makeState(); s.player.tier = 1; s.player.cash = 9_500_000
    expect(settleTier(s).player.tier).toBe(1)
  })
  it('90% 미만이면 강등되고 컷신이 뜬다', () => {
    const s = makeState(); s.player.tier = 1; s.player.cash = 8_000_000
    const r = settleTier(s)
    expect(r.player.tier).toBe(0)
    expect(r.cutscene).toBe('cutscene.demote.0')
  })
  it('변동이 없으면 컷신도 없다', () => {
    expect(settleTier(makeState()).cutscene).toBeNull()
  })
})

describe('stepRival', () => {
  it('boom에서는 늘어난다', () => {
    const s = makeState({ turn: 1 }); s.regimes[0] = 'boom'
    expect(stepRival(s).rivalAssets).toBeGreaterThan(s.rivalAssets)
  })
  it('crash에서는 크게 줄어든다', () => {
    const s = makeState({ turn: 1 }); s.regimes[0] = 'crash'
    expect(stepRival(s).rivalAssets).toBeLessThan(s.rivalAssets * 0.95)
  })
  it('음수가 되지 않는다', () => {
    let s = makeState({ turn: 1 }); s.regimes[0] = 'crash'; s.rivalAssets = 1000
    for (let i = 0; i < 200; i++) s = stepRival(s)
    expect(s.rivalAssets).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test economy` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/turn/economy.ts
import type { GameState, Tier } from '../types'
import { BALANCE } from '../balance'
import { totalAssets } from './accounting'

export function settlePayroll(state: GameState): GameState {
  if (state.turn % BALANCE.payPeriod !== 0) return state
  const delta = state.player.employed ? BALANCE.employedNet : -BALANCE.unemployedOut
  return { ...state, player: { ...state.player, cash: Math.max(0, state.player.cash + delta) } }
}

export function tierOf(assets: number): Tier {
  let t: Tier = 0
  for (let i = BALANCE.tierMins.length - 1; i >= 0; i--) {
    if (assets >= BALANCE.tierMins[i]!) { t = i as Tier; break }
  }
  return t
}

export function settleTier(state: GameState): GameState {
  const assets = totalAssets(state)
  const cur = state.player.tier
  const raw = tierOf(assets)

  let next = cur
  if (raw > cur) next = raw
  else if (raw < cur && assets < BALANCE.tierMins[cur]! * 0.9) next = raw

  if (next === cur) return state
  const cutscene = next > cur ? `cutscene.promote.${next}` : `cutscene.demote.${next}`
  return { ...state, player: { ...state.player, tier: next }, cutscene }
}

export function stepRival(state: GameState): GameState {
  const regime = state.regimes[state.turn - 1] ?? 'stagnation'
  const { drift } = BALANCE.regime[regime]
  let v = state.rivalAssets * Math.exp(drift * BALANCE.rival.driftMul)
  if (regime === 'crash') v *= BALANCE.rival.crashDecay
  return { ...state, rivalAssets: Math.max(0, Math.round(v)) }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test economy` / Expected: PASS 10

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/turn
git commit -m "feat: 월급 정산·티어 히스테리시스·라이벌 궤적"
```

---

### Task 15: initGame · advanceTurn (턴 루프 조립)

**Files:**
- Create: `packages/core/src/turn/advance.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/turn/advance.test.ts`

**Interfaces:**
- Consumes: Task 4~14 전부
- Produces:
  - `initGame(seed: number): GameState`
  - `cardsPerTurn(state: GameState): number`  // 재직 1, 퇴사 2
  - `advanceTurn(state: GameState, cardIds: string[]): GameState`
  - 실행 순서 (스펙 §4.5):
    1. `pendingChoices`가 남아있으면 `GameError('CHOICE_PENDING')`
    2. 강제 스킵 판정(`rollForcedSkip`) — 스킵이면 카드 미사용
    3. 카드 사용 (`cardsPerTurn` 개수 상한, 초과 시 `TOO_MANY_CARDS`)
    4. 만기 충격 수집 → `stepPrices`
    5. `accrueInterest` → `checkMarginCall`
    6. `drawEvents` → `revealRumors`
    7. `settleMental`(pending 소비) → `settleCondition`(pending 소비)
    8. `settlePayroll` → `settleTier` → `stepRival`
    9. `heldTurns` 증가, 트래커 누적(cashRatio·maxHeldTurns)
    10. 파산·156턴 종료 판정, 아니면 `turn + 1`
  - `state.cutscene`은 `advanceTurn` 진입 시 `null`로 초기화된다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/turn/advance.test.ts
import { describe, it, expect } from 'vitest'
import { initGame, advanceTurn, cardsPerTurn } from './advance'
import { buy } from './trade'
import { totalAssets } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const run = (s = initGame(1), cards: string[] = ['hodl']) => advanceTurn(s, cards)

describe('initGame', () => {
  it('초기 상태가 스펙대로다', () => {
    const s = initGame(42)
    expect(s.turn).toBe(1)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
    expect(s.player.mental).toBe(100)
    expect(s.player.condition).toBe(100)
    expect(s.player.tier).toBe(0)
    expect(s.player.employed).toBe(true)
    expect(s.stocks).toHaveLength(10)
    expect(s.regimes).toHaveLength(156)
    expect(s.status).toBe('playing')
  })
  it('같은 시드는 같은 초기 상태', () => {
    expect(initGame(7)).toEqual(initGame(7))
  })
  it('다른 시드는 다른 국면', () => {
    expect(initGame(1).regimes).not.toEqual(initGame(2).regimes)
  })
})

describe('advanceTurn', () => {
  it('턴이 1 증가한다', () => expect(run().turn).toBe(2))
  it('가격 히스토리가 늘어난다', () => {
    expect(run().stocks[0]!.history.length).toBe(2)
  })
  it('카드 효과가 반영된다', () => {
    expect(run(initGame(1), ['news']).player.stats.info).toBeGreaterThan(0)
  })
  it('재직 중엔 카드 1장, 2장은 거부된다', () => {
    expect(cardsPerTurn(initGame(1))).toBe(1)
    expect(() => advanceTurn(initGame(1), ['hodl', 'news'])).toThrow(/TOO_MANY_CARDS/)
  })
  it('퇴사 후엔 2장까지 쓸 수 있다', () => {
    const s = initGame(1)
    s.player.employed = false
    expect(cardsPerTurn(s)).toBe(2)
    expect(() => advanceTurn(s, ['hodl', 'news'])).not.toThrow()
  })
  it('선택지가 남아 있으면 진행이 막힌다', () => {
    const s = { ...initGame(1), pendingChoices: [{ eventId: 'x' }] }
    expect(() => advanceTurn(s, ['hodl'])).toThrow(GameError)
  })
  it('cutscene은 매 턴 초기화된다', () => {
    const s = { ...initGame(1), cutscene: 'cutscene.promote.1' }
    expect(advanceTurn(s, ['hodl']).cutscene === 'cutscene.promote.1').toBe(false)
  })
  it('보유 종목의 heldTurns가 증가한다', () => {
    const s = advanceTurn(buy(initGame(1), 'sjc', 1), ['hodl'])
    expect(s.player.holdings[0]!.heldTurns).toBe(1)
  })
  it('4턴째에 월급이 들어온다', () => {
    let s = initGame(1)
    const cash0 = s.player.cash
    for (let i = 0; i < 4; i++) s = advanceTurn(s, ['hodl'])
    expect(s.player.cash).toBe(cash0 + BALANCE.employedNet)
  })
  it('멘탈·컨디션이 0~100을 벗어나지 않는다', () => {
    let s = initGame(5)
    for (let i = 0; i < 100; i++) {
      s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
      expect(s.player.mental).toBeGreaterThanOrEqual(0)
      expect(s.player.mental).toBeLessThanOrEqual(100)
      expect(s.player.condition).toBeGreaterThanOrEqual(0)
      expect(s.player.condition).toBeLessThanOrEqual(100)
    }
  })
  it('156턴에 도달하면 종료된다', () => {
    let s = initGame(3)
    for (let i = 0; i < 156; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(s.status).toBe('ended')
    expect(s.ending).not.toBeNull()
    expect(s.turn).toBe(156)
  })
  it('종료 후 추가 진행은 거부된다', () => {
    let s = initGame(3)
    for (let i = 0; i < 156; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(() => advanceTurn(s, ['hodl'])).toThrow(/NOT_PLAYING/)
  })
  it('자산이 0 이하면 즉시 파산 종료된다', () => {
    const s = initGame(9)
    s.player.cash = 0
    s.player.loan = 1_000_000
    const r = advanceTurn(s, ['hodl'])
    expect(r.status).toBe('ended')
    expect(r.ending!.endingId).toBe('legend')
  })
  it('같은 시드·같은 입력이면 결과가 동일하다 (결정론)', () => {
    const play = (seed: number) => {
      let s = initGame(seed)
      for (let i = 0; i < 60; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
      return s
    }
    expect(play(11)).toEqual(play(11))
  })
  it('입력 상태를 변경하지 않는다', () => {
    const s = initGame(1)
    const snapshot = structuredClone(s)
    advanceTurn(s, ['news'])
    expect(s).toEqual(snapshot)
  })
  it('아무 것도 안 사면 자산이 완만하게만 움직인다', () => {
    let s = initGame(4)
    for (let i = 0; i < 20; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(totalAssets(s)).toBeGreaterThan(BALANCE.seedMoney * 0.9)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test advance` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/turn/advance.ts
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
```

`index.ts`에 추가:
```ts
export { initGame, advanceTurn, cardsPerTurn } from './turn/advance'
export { buy, sell, canBuy, canSell, maxBuyQty } from './turn/trade'
export { totalAssets, holdingValue, cashRatio, priceOf, portfolioLossPct, positionLossPct } from './turn/accounting'
export { maxLoan, takeLoan, repayLoan } from './turn/margin'
export { loadCards, isCardAvailable } from './turn/cards'
export { loadEvents, loadContent } from './events/content'
export { resolveChoice } from './events/engine'
export { isShaken } from './mental/mental'
export { tierOf } from './turn/economy'
export { analyzeStock } from './market/analysis'
export { judgeEnding, ENDINGS, TITLES } from './endings/endings'
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test` / Expected: PASS 전체 (Task 16·17이 아직 없으면 이 태스크는 Task 16·17 완료 후 마지막에 통과 확인 — 실행 순서는 16 → 17 → 15 검증 순으로 해도 무방)

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src
git commit -m "feat: initGame · advanceTurn 턴 루프 조립"
```

---

### Task 16: 분석력 노이즈 (적정가 밴드·리스크 등급)

**Files:**
- Create: `packages/core/src/market/analysis.ts`
- Test: `packages/core/src/market/analysis.test.ts`

**Interfaces:**
- Produces:
  - `analyzeStock(state: GameState, stockId: string): { fairLow: number; fairHigh: number; risk: '낮음'|'보통'|'높음'|'매우 높음'; confidence: number }`
  - 노이즈는 `hash(seed0, stockId, floor(analysis))` 기반 **결정론적** — 같은 상태를 다시 조회해도 값이 흔들리지 않는다 (새로고침으로 평균내기 방지). 분석력이 오르면 값이 갱신된다.
  - `sigma = 0.45 × (1 − analysis/10) + 0.05` — 분석력 0이면 ±50% 수준, 10이면 ±5%.
  - 리스크 등급은 **표시된** 밴드 대비 현재가와 종목 변동성으로 계산 → 분석력이 낮으면 등급도 함께 틀린다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/market/analysis.test.ts
import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { analyzeStock } from './analysis'

const withAnalysis = (a: number) => {
  const s = makeState({
    stockDefs: [makeStockDef({ id: 'a', volatility: 0.05 })],
    stocks: [makeStock({ id: 'a', price: 10000, fundamental: 10000 })],
  })
  s.player.stats.analysis = a
  return s
}

describe('analyzeStock', () => {
  it('같은 상태를 두 번 조회하면 같은 값이다 (결정론)', () => {
    const s = withAnalysis(3)
    expect(analyzeStock(s, 'a')).toEqual(analyzeStock(s, 'a'))
  })
  it('밴드는 low < high 이다', () => {
    for (let a = 0; a <= 10; a++) {
      const r = analyzeStock(withAnalysis(a), 'a')
      expect(r.fairLow).toBeLessThan(r.fairHigh)
      expect(r.fairLow).toBeGreaterThan(0)
    }
  })
  it('분석력이 높을수록 밴드가 좁다', () => {
    const lo = analyzeStock(withAnalysis(0), 'a')
    const hi = analyzeStock(withAnalysis(10), 'a')
    expect(hi.fairHigh - hi.fairLow).toBeLessThan(lo.fairHigh - lo.fairLow)
  })
  it('분석력 10이면 밴드 중앙이 실제 fundamental에 아주 가깝다', () => {
    const r = analyzeStock(withAnalysis(10), 'a')
    expect(Math.abs((r.fairLow + r.fairHigh) / 2 - 10000) / 10000).toBeLessThan(0.15)
  })
  it('분석력이 낮으면 종목마다 편차가 크게 벌어진다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'a' }), makeStockDef({ id: 'b' }), makeStockDef({ id: 'c' })],
      stocks: [makeStock({ id: 'a' }), makeStock({ id: 'b' }), makeStock({ id: 'c' })],
    })
    s.player.stats.analysis = 0
    const mids = ['a', 'b', 'c'].map(id => { const r = analyzeStock(s, id); return (r.fairLow + r.fairHigh) / 2 })
    expect(new Set(mids).size).toBe(3)
  })
  it('분석력이 오르면 값이 갱신된다', () => {
    expect(analyzeStock(withAnalysis(0), 'a')).not.toEqual(analyzeStock(withAnalysis(8), 'a'))
  })
  it('confidence는 0~1이고 분석력과 함께 오른다', () => {
    expect(analyzeStock(withAnalysis(0), 'a').confidence).toBeLessThan(analyzeStock(withAnalysis(10), 'a').confidence)
    expect(analyzeStock(withAnalysis(10), 'a').confidence).toBeLessThanOrEqual(1)
  })
  it('리스크 등급이 유효한 값이다', () => {
    for (let a = 0; a <= 10; a++) {
      expect(['낮음', '보통', '높음', '매우 높음']).toContain(analyzeStock(withAnalysis(a), 'a').risk)
    }
  })
  it('없는 종목은 예외', () => {
    expect(() => analyzeStock(withAnalysis(5), 'zz')).toThrow()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test analysis` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/core/src/market/analysis.ts
import type { GameState } from '../types'
import { GameError } from '../error'
import { createRng, Rand } from '../rng/rng'

export interface StockAnalysis {
  fairLow: number; fairHigh: number
  risk: '낮음' | '보통' | '높음' | '매우 높음'
  confidence: number
}

function hashSeed(seed0: number, stockId: string, bucket: number): number {
  let h = (seed0 ^ 0x9e3779b9) >>> 0
  for (let i = 0; i < stockId.length; i++) h = (Math.imul(h ^ stockId.charCodeAt(i), 0x01000193)) >>> 0
  return (Math.imul(h ^ (bucket + 1), 0x85ebca6b)) >>> 0
}

export function analyzeStock(state: GameState, stockId: string): StockAnalysis {
  const stock = state.stocks.find(s => s.id === stockId)
  const def = state.stockDefs.find(d => d.id === stockId)
  if (!stock || !def) throw new GameError('NO_STOCK')

  const a = state.player.stats.analysis
  const sigma = 0.45 * (1 - a / 10) + 0.05
  const rand = new Rand(createRng(hashSeed(state.seed0, stockId, Math.floor(a))))
  const bias = rand.normal(0, sigma)
  const est = Math.max(1, stock.fundamental * Math.exp(bias))

  const half = Math.max(0.03, sigma * 0.8)
  const fairLow = Math.max(1, Math.round(est * (1 - half)))
  const fairHigh = Math.round(est * (1 + half))

  const over = stock.price / est
  const volScore = def.volatility * 20
  const score = (over - 1) * 2 + volScore
  const risk: StockAnalysis['risk'] =
    score > 2.2 ? '매우 높음' : score > 1.2 ? '높음' : score > 0.5 ? '보통' : '낮음'

  return { fairLow, fairHigh, risk, confidence: Math.min(1, 0.15 + a * 0.085) }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test analysis` / Expected: PASS 9

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/market
git commit -m "feat: 분석력 노이즈 기반 적정가 밴드·리스크 등급"
```

---

### Task 17: 엔딩·칭호 판정

**Files:**
- Create: `packages/core/src/endings/endings.ts`, `packages/core/data/endings.json`
- Test: `packages/core/src/endings/endings.test.ts`

**Interfaces:**
- Produces:
  - `ENDINGS: { id, name, desc }[]` (8종), `TITLES: { id, name }[]` (7종)
  - `judgeEnding(state: GameState, bankrupt: boolean): EndingResult`
  - 판정 우선순위: `legend`(파산) → `kimheir`(인맥≥8 & `kimRoom`) → `fire`(≥10억 & 퇴사) → `super`(≥5억) → `wise`(1억~5억) → `bank`(600만~1억) → `breakeven`(270만~330만) → `savings`(그 외)
  - 자산 구간 기준값은 `BALANCE.endings` — 저축선(시드 300만 + 가처분 누적)을 반영해 `savingsBelow: 2_700_000`, `breakevenHigh: 3_300_000`, `bankHigh: 6_000_000`으로 둔다. 그 사이 구간이 `bank`.
  - 칭호: `beatRival`(자산 > rivalAssets) · `momSecret`(momIgnored ≥ 3) · `steelMental`(shakenTurns === 0) · `noCut`(lossCuts === 0) · `noDebt`(!usedMargin) · `hodler`(maxHeldTurns ≥ 52) · `allIn`(평균 현금비중 < 5%)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/core/src/endings/endings.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { judgeEnding, ENDINGS, TITLES } from './endings'

const at = (assets: number, over: Parameters<typeof makeState>[0] = {}) => {
  const s = makeState(over)
  s.player.cash = assets
  return s
}

describe('데이터', () => {
  it('엔딩 8종, 칭호 7종이고 id가 유일하다', () => {
    expect(ENDINGS).toHaveLength(8)
    expect(TITLES).toHaveLength(7)
    expect(new Set(ENDINGS.map(e => e.id)).size).toBe(8)
    expect(new Set(TITLES.map(t => t.id)).size).toBe(7)
  })
})

describe('judgeEnding 우선순위', () => {
  it('파산이 최우선', () => {
    const s = at(50_000_000_000)
    s.player.stats.network = 10
    s.flags['kimRoom'] = true
    expect(judgeEnding(s, true).endingId).toBe('legend')
  })
  it('김실장 루트가 자산 판정보다 앞선다', () => {
    const s = at(20_000_000_000)
    s.player.stats.network = 9
    s.flags['kimRoom'] = true
    expect(judgeEnding(s, false).endingId).toBe('kimheir')
  })
  it('인맥이 부족하면 김실장 엔딩이 아니다', () => {
    const s = at(700_000_000)
    s.player.stats.network = 5
    s.flags['kimRoom'] = true
    expect(judgeEnding(s, false).endingId).toBe('super')
  })
  it('10억+퇴사는 파이어족', () => {
    const s = at(1_500_000_000)
    s.player.employed = false
    expect(judgeEnding(s, false).endingId).toBe('fire')
  })
  it('10억이어도 재직이면 슈퍼개미', () => {
    expect(judgeEnding(at(1_500_000_000), false).endingId).toBe('super')
  })
  it('5억~10억 퇴사자도 판정 공백 없이 슈퍼개미다', () => {
    const s = at(700_000_000)
    s.player.employed = false
    expect(judgeEnding(s, false).endingId).toBe('super')
  })
  it('자산 구간이 순서대로 잡힌다', () => {
    expect(judgeEnding(at(200_000_000), false).endingId).toBe('wise')
    expect(judgeEnding(at(20_000_000), false).endingId).toBe('bank')
    expect(judgeEnding(at(3_100_000), false).endingId).toBe('breakeven')
    expect(judgeEnding(at(1_000_000), false).endingId).toBe('savings')
  })
  it('엔딩 이름이 채워진다', () => {
    const r = judgeEnding(at(20_000_000), false)
    expect(r.endingName.length).toBeGreaterThan(0)
    expect(r.finalAssets).toBe(20_000_000)
  })
})

describe('칭호', () => {
  it('라이벌을 이기면 beatRival', () => {
    const s = at(100_000_000, { rivalAssets: 50_000_000 })
    expect(judgeEnding(s, false).titles).toContain('박대박을 이긴')
  })
  it('라이벌보다 적으면 안 붙는다', () => {
    const s = at(10_000_000, { rivalAssets: 50_000_000 })
    expect(judgeEnding(s, false).titles).not.toContain('박대박을 이긴')
  })
  it('엄마 전화 3회 무시면 엄마 몰래', () => {
    const s = at(20_000_000); s.flags['momIgnored'] = 3
    expect(judgeEnding(s, false).titles).toContain('엄마 몰래')
  })
  it('흔들림 0턴이면 강철멘탈의', () => {
    expect(judgeEnding(at(20_000_000), false).titles).toContain('강철멘탈의')
  })
  it('흔들림이 있으면 안 붙는다', () => {
    const s = at(20_000_000)
    s.trackers = { ...s.trackers, shakenTurns: 4 }
    expect(judgeEnding(s, false).titles).not.toContain('강철멘탈의')
  })
  it('손절 0회 / 신용 미사용 / 52주 보유 / 풀매수', () => {
    const s = at(20_000_000)
    s.trackers = { ...s.trackers, lossCuts: 0, usedMargin: false, maxHeldTurns: 60, cashRatioSum: 1.5, turnsCounted: 156 }
    const t = judgeEnding(s, false).titles
    expect(t).toEqual(expect.arrayContaining(['한 번도 손절 안 한', '빚 없이', '존버한', '풀매수']))
  })
  it('조건 미달이면 칭호가 비어있을 수 있다', () => {
    const s = at(20_000_000, { rivalAssets: 10_000_000_000 })
    s.trackers = { ...s.trackers, shakenTurns: 5, lossCuts: 3, usedMargin: true, maxHeldTurns: 3, cashRatioSum: 100, turnsCounted: 156 }
    expect(judgeEnding(s, false).titles).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/core test endings` / Expected: FAIL

- [ ] **Step 3: 구현**

`packages/core/data/endings.json`:
```json
{
  "endings": [
    { "id": "legend",    "name": "흑우의 전설",       "desc": "계좌가 0이 됐다. 3년이 숫자 하나로 정리된다." },
    { "id": "savings",   "name": "적금이나 들걸",     "desc": "그냥 모으기만 했어도 이것보단 나았다." },
    { "id": "breakeven", "name": "본전이 어디야",     "desc": "잃지도 벌지도 않았다. 3년이 사라졌을 뿐." },
    { "id": "bank",      "name": "은행 이자보단 낫지","desc": "누구한테 자랑하긴 애매한 숫자." },
    { "id": "wise",      "name": "슬기로운 투자생활", "desc": "이제 시장이 조금 보이는 것 같다. 착각일 수도 있고." },
    { "id": "super",     "name": "슈퍼개미",          "desc": "회사는 계속 다닌다. 그게 제일 안전하다는 걸 배웠다." },
    { "id": "fire",      "name": "파이어족",          "desc": "사표를 냈고, 아직까지는 버티고 있다." },
    { "id": "kimheir",   "name": "김실장의 후예",     "desc": "이제 DM을 보내는 쪽이 됐다. 아무도 안 물어본 걸 알려준다." }
  ],
  "titles": [
    { "id": "beatRival",   "name": "박대박을 이긴" },
    { "id": "momSecret",   "name": "엄마 몰래" },
    { "id": "steelMental", "name": "강철멘탈의" },
    { "id": "noCut",       "name": "한 번도 손절 안 한" },
    { "id": "noDebt",      "name": "빚 없이" },
    { "id": "hodler",      "name": "존버한" },
    { "id": "allIn",       "name": "풀매수" }
  ]
}
```

```ts
// packages/core/src/endings/endings.ts
import raw from '../../data/endings.json'
import type { EndingResult, GameState } from '../types'
import { BALANCE } from '../balance'
import { totalAssets } from '../turn/accounting'

export const ENDINGS = raw.endings as { id: string; name: string; desc: string }[]
export const TITLES = raw.titles as { id: string; name: string }[]

const nameOf = (id: string) => ENDINGS.find(e => e.id === id)?.name ?? id
const titleOf = (id: string) => TITLES.find(t => t.id === id)?.name ?? id

function pickEnding(state: GameState, assets: number, bankrupt: boolean): string {
  const e = BALANCE.endings
  if (bankrupt || assets <= 0) return 'legend'
  if (state.player.stats.network >= 8 && state.flags['kimRoom'] === true) return 'kimheir'
  if (assets >= e.fireMin && !state.player.employed) return 'fire'
  if (assets >= 500_000_000) return 'super'
  if (assets >= 100_000_000) return 'wise'
  if (assets >= e.bankHigh) return 'bank'
  if (assets >= e.savingsBelow && assets <= e.breakevenHigh) return 'breakeven'
  if (assets > e.breakevenHigh) return 'bank'
  return 'savings'
}

function pickTitles(state: GameState, assets: number): string[] {
  const t = state.trackers
  const avgCash = t.turnsCounted > 0 ? t.cashRatioSum / t.turnsCounted : 1
  const out: string[] = []
  if (assets > state.rivalAssets) out.push('beatRival')
  if (Number(state.flags['momIgnored'] ?? 0) >= 3) out.push('momSecret')
  if (t.shakenTurns === 0) out.push('steelMental')
  if (t.lossCuts === 0) out.push('noCut')
  if (!t.usedMargin) out.push('noDebt')
  if (t.maxHeldTurns >= 52) out.push('hodler')
  if (avgCash < 0.05) out.push('allIn')
  return out.map(titleOf)
}

export function judgeEnding(state: GameState, bankrupt: boolean): EndingResult {
  const finalAssets = Math.max(0, totalAssets(state))
  const endingId = pickEnding(state, finalAssets, bankrupt)
  return { endingId, endingName: nameOf(endingId), titles: pickTitles(state, finalAssets), finalAssets }
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/core test` / Expected: 코어 전체 PASS (Task 15 포함)

- [ ] **Step 5: 커밋**

```bash
git add packages/core/src/endings packages/core/data/endings.json
git commit -m "feat: 엔딩 8종 × 칭호 7종 판정"
```

---

### Task 18: 밸런싱 CLI (`@bb/sim`)

**Files:**
- Create: `packages/sim/package.json`, `packages/sim/tsconfig.json`, `packages/sim/src/strategies.ts`, `packages/sim/src/runner.ts`, `packages/sim/src/cli.ts`
- Test: `packages/sim/src/balance.test.ts`

**Interfaces:**
- Consumes: `initGame`, `advanceTurn`, `buy`, `sell`, `canSell`, `totalAssets`, `loadCards`, `isCardAvailable`, `loadEvents`, `resolveChoice` (@bb/core)
- Produces:
  - `type Strategy = 'buyhold' | 'panic' | 'momentum' | 'random'`
  - `playOne(seed: number, strategy: Strategy): { ending: string; titles: string[]; assets: number; shakenTurns: number; bankrupt: boolean; turns: number }`
  - `runBatch(runs: number, strategy: Strategy, seed0?: number): BatchReport`
  - `BatchReport = { runs, strategy, endingCounts: Record<string, number>, bankruptRate, assetsMedian, assetsP10, assetsP90, avgShakenTurns }`
  - CLI: `pnpm --filter @bb/sim start -- --runs 10000 --strategy buyhold`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/sim/src/balance.test.ts
import { describe, it, expect } from 'vitest'
import { playOne, runBatch } from './runner'
import { BALANCE } from '@bb/core'

describe('playOne', () => {
  it('한 판이 끝까지 돌고 엔딩이 나온다', () => {
    const r = playOne(1, 'buyhold')
    expect(r.ending.length).toBeGreaterThan(0)
    expect(r.turns).toBeGreaterThan(0)
    expect(r.turns).toBeLessThanOrEqual(BALANCE.totalTurns)
  })
  it('같은 시드·전략은 같은 결과 (결정론)', () => {
    expect(playOne(5, 'momentum')).toEqual(playOne(5, 'momentum'))
  })
  it('네 전략 모두 예외 없이 완주한다', () => {
    for (const s of ['buyhold', 'panic', 'momentum', 'random'] as const) {
      expect(() => playOne(3, s)).not.toThrow()
    }
  })
})

describe('runBatch', () => {
  it('리포트 필드가 채워진다', () => {
    const r = runBatch(60, 'buyhold')
    expect(r.runs).toBe(60)
    expect(Object.values(r.endingCounts).reduce((a, b) => a + b, 0)).toBe(60)
    expect(r.assetsP10).toBeLessThanOrEqual(r.assetsMedian)
    expect(r.assetsMedian).toBeLessThanOrEqual(r.assetsP90)
  })

  // 밸런스 게이트 — 스펙 §8.2
  it('buyhold 파산율이 15% 미만이다', () => {
    expect(runBatch(200, 'buyhold').bankruptRate).toBeLessThan(0.15)
  })
  it('panic이 buyhold보다 확실히 나쁘다', () => {
    expect(runBatch(200, 'panic').assetsMedian).toBeLessThan(runBatch(200, 'buyhold').assetsMedian)
  })
  it('엔딩이 한 종류로 쏠리지 않는다', () => {
    const r = runBatch(300, 'random')
    expect(Object.keys(r.endingCounts).length).toBeGreaterThanOrEqual(3)
    expect(Math.max(...Object.values(r.endingCounts)) / r.runs).toBeLessThan(0.9)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/sim test` / Expected: FAIL

- [ ] **Step 3: 구현**

`packages/sim/package.json`:
```json
{
  "name": "@bb/sim", "version": "0.1.0", "private": true, "type": "module",
  "scripts": { "start": "tsx src/cli.ts", "test": "vitest run", "typecheck": "tsc -p ." },
  "dependencies": { "@bb/core": "workspace:*" },
  "devDependencies": { "tsx": "^4.19.0", "typescript": "^5.5.4", "vitest": "^2.1.0" }
}
```

`packages/sim/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

```ts
// packages/sim/src/strategies.ts
import {
  type GameState, buy, sell, canSell, canBuy, maxBuyQty, totalAssets,
  loadCards, isCardAvailable, Rand, createRng, priceOf,
} from '@bb/core'

export type Strategy = 'buyhold' | 'panic' | 'momentum' | 'random'

const tradable = (s: GameState) => s.stockDefs.filter(d => canBuy(s, d.id).ok)

function trendOf(s: GameState, id: string): number {
  const h = s.stocks.find(x => x.id === id)!.history
  if (h.length < 4) return 0
  return h[h.length - 1]! / h[h.length - 4]! - 1
}

function sellAll(s: GameState): GameState {
  for (const h of [...s.player.holdings]) {
    if (canSell(s, h.stockId).ok) { try { s = sell(s, h.stockId, h.qty) } catch { /* 봉인 */ } }
  }
  return s
}

function investPct(s: GameState, id: string, pct: number): GameState {
  const budget = s.player.cash * pct
  const qty = Math.min(maxBuyQty(s, id), Math.floor(budget / priceOf(s, id)))
  if (qty <= 0) return s
  try { return buy(s, id, qty) } catch { return s }
}

/** 전략별 매매 + 카드 선택. rand는 호출자가 소유한다. */
export function act(s: GameState, strategy: Strategy, rand: Rand): { state: GameState; cards: string[] } {
  const pool = tradable(s)
  if (pool.length > 0) {
    switch (strategy) {
      case 'buyhold':
        if (s.player.holdings.length === 0) s = investPct(s, pool[0]!.id, 0.9)
        break
      case 'panic': {
        // 오르면 사고 내리면 판다 — 전형적인 흑우
        s = sellAll(s)
        const hot = [...pool].sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0]!
        s = investPct(s, hot.id, 0.95)
        break
      }
      case 'momentum': {
        const hot = [...pool].sort((a, b) => trendOf(s, b.id) - trendOf(s, a.id))[0]!
        if (!s.player.holdings.some(h => h.stockId === hot.id)) { s = sellAll(s); s = investPct(s, hot.id, 0.8) }
        break
      }
      case 'random': {
        if (rand.chance(0.3)) s = sellAll(s)
        if (rand.chance(0.5)) s = investPct(s, pool[rand.int(0, pool.length - 1)]!.id, 0.5)
        break
      }
    }
  }
  const usable = loadCards().filter(c => isCardAvailable(s, c))
  const card = strategy === 'panic'
    ? (usable.find(c => c.id === 'community') ?? usable[0])
    : usable[rand.int(0, Math.max(0, usable.length - 1))]
  return { state: s, cards: card ? [card.id] : [] }
}

export { createRng, Rand, totalAssets }
```

```ts
// packages/sim/src/runner.ts
import { initGame, advanceTurn, resolveChoice, loadEvents, totalAssets, cardsPerTurn, BALANCE, createRng, Rand } from '@bb/core'
import { act, type Strategy } from './strategies'

export interface RunResult {
  ending: string; titles: string[]; assets: number
  shakenTurns: number; bankrupt: boolean; turns: number
}
export interface BatchReport {
  runs: number; strategy: Strategy
  endingCounts: Record<string, number>
  bankruptRate: number; assetsMedian: number; assetsP10: number; assetsP90: number
  avgShakenTurns: number
}

const events = loadEvents()

export function playOne(seed: number, strategy: Strategy): RunResult {
  let s = initGame(seed)
  const rand = new Rand(createRng(seed ^ 0xabcdef))

  for (let i = 0; i < BALANCE.totalTurns && s.status === 'playing'; i++) {
    // 대기 중인 선택지는 무작위로 해소
    while (s.pendingChoices.length > 0) {
      const c = s.pendingChoices[0]!
      const def = events.find(e => e.id === c.eventId)
      const n = def?.choices?.length ?? 0
      s = n > 0 ? resolveChoice(s, c.eventId, rand.int(0, n - 1), events)
                : { ...s, pendingChoices: s.pendingChoices.slice(1) }
    }
    const { state, cards } = act(s, strategy, rand)
    s = advanceTurn(state, cards.slice(0, cardsPerTurn(state)))
  }

  const assets = Math.max(0, totalAssets(s))
  return {
    ending: s.ending?.endingId ?? 'unknown',
    titles: s.ending?.titles ?? [],
    assets, shakenTurns: s.trackers.shakenTurns,
    bankrupt: s.ending?.endingId === 'legend', turns: s.turn,
  }
}

const quantile = (sorted: number[], q: number) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]!

export function runBatch(runs: number, strategy: Strategy, seed0 = 1): BatchReport {
  const endingCounts: Record<string, number> = {}
  const assets: number[] = []
  let bankrupt = 0, shaken = 0

  for (let i = 0; i < runs; i++) {
    const r = playOne(seed0 + i, strategy)
    endingCounts[r.ending] = (endingCounts[r.ending] ?? 0) + 1
    assets.push(r.assets)
    if (r.bankrupt) bankrupt++
    shaken += r.shakenTurns
  }
  assets.sort((a, b) => a - b)
  return {
    runs, strategy, endingCounts,
    bankruptRate: bankrupt / runs,
    assetsMedian: quantile(assets, 0.5),
    assetsP10: quantile(assets, 0.1),
    assetsP90: quantile(assets, 0.9),
    avgShakenTurns: shaken / runs,
  }
}
```

```ts
// packages/sim/src/cli.ts
import { runBatch } from './runner'
import type { Strategy } from './strategies'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback
}

const runs = Number(arg('runs', '1000'))
const strategy = arg('strategy', 'buyhold') as Strategy
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

const r = runBatch(runs, strategy)
console.log(`\n전략 ${r.strategy} / ${r.runs}판`)
console.log(`  파산율        ${(r.bankruptRate * 100).toFixed(1)}%`)
console.log(`  자산 중앙값   ${won(r.assetsMedian)}`)
console.log(`  P10 / P90     ${won(r.assetsP10)} / ${won(r.assetsP90)}`)
console.log(`  평균 흔들림   ${r.avgShakenTurns.toFixed(1)}턴`)
console.log('  엔딩 분포')
Object.entries(r.endingCounts).sort((a, b) => b[1] - a[1])
  .forEach(([id, n]) => console.log(`    ${id.padEnd(12)} ${n} (${((n / r.runs) * 100).toFixed(1)}%)`))
```

- [ ] **Step 4: 통과 확인**

Run: `pnpm install && pnpm --filter @bb/sim test`
Expected: PASS 6

Run: `pnpm --filter @bb/sim start -- --runs 300 --strategy buyhold`
Expected: 리포트 출력. **밸런스 게이트가 실패하면 코드가 아니라 `BALANCE` 값을 조정한다** — 그것이 이 하네스의 목적이다.

- [ ] **Step 5: 커밋**

```bash
git add packages/sim
git commit -m "feat: 밸런싱 시뮬 CLI (4개 전략 + 밸런스 게이트 테스트)"
```

---

### Task 19: app 스캐폴드 + zustand 스토어 + localStorage

**Files:**
- Create: `packages/app/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/store/store.ts`
- Test: `packages/app/src/store/store.test.ts`

**Interfaces:**
- Produces:
  - `useGame` (zustand): `{ state: GameState | null, tab: TabKey, selectedStock: string | null, newGame(seed?), next(cards), doBuy(id, qty), doSell(id, qty), choose(eventId, idx), setTab(t), selectStock(id), clearCutscene(), codex: Codex, reset() }`
  - `type TabKey = 'home' | 'market' | 'account' | 'codex'`
  - `interface Codex { endings: string[]; titles: string[]; bestAssets: number; runs: number }`
  - `SAVE_KEY = 'blackbull.save.v1'`, `CODEX_KEY = 'blackbull.codex.v1'`
  - 저장 포맷 `{ version: 1, state }`. 버전 불일치·파싱 실패 시 조용히 무시하고 새 판.
  - 게임 종료 시 도감 자동 갱신(엔딩·칭호 유니크 누적, `bestAssets` 최대, `runs` +1).

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// packages/app/src/store/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useGame, SAVE_KEY, CODEX_KEY } from './store'
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
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).version).toBe(1)
  })
  it('next가 턴을 넘긴다', () => {
    useGame.getState().newGame(1)
    useGame.getState().next(['hodl'])
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
      useGame.getState().next(['hodl'])
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
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/app test` / Expected: FAIL

- [ ] **Step 3: 구현**

`packages/app/package.json`:
```json
{
  "name": "@bb/app", "version": "0.1.0", "private": true, "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview", "test": "vitest run", "typecheck": "tsc -p ." },
  "dependencies": { "@bb/core": "workspace:*", "react": "^18.3.1", "react-dom": "^18.3.1", "zustand": "^4.5.5" },
  "devDependencies": {
    "@testing-library/react": "^16.0.1", "@types/react": "^18.3.5", "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1", "jsdom": "^25.0.0", "typescript": "^5.5.4", "vite": "^5.4.0", "vitest": "^2.1.0"
  }
}
```

`packages/app/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: false },
})
```

`packages/app/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src", "vite.config.ts"] }
```

`packages/app/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>흑우키우기</title>
  </head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

```ts
// packages/app/src/store/store.ts
import { create } from 'zustand'
import {
  type GameState, initGame, advanceTurn, buy, sell, resolveChoice, loadEvents, totalAssets,
} from '@bb/core'

export const SAVE_KEY = 'blackbull.save.v1'
export const CODEX_KEY = 'blackbull.codex.v1'
const SAVE_VERSION = 1

export type TabKey = 'home' | 'market' | 'account' | 'codex'
export interface Codex { endings: string[]; titles: string[]; bestAssets: number; runs: number }

const EMPTY_CODEX: Codex = { endings: [], titles: [], bestAssets: 0, runs: 0 }
const events = loadEvents()

function readSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.version === SAVE_VERSION ? (parsed.state as GameState) : null
  } catch { return null }
}
function writeSave(state: GameState) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state })) } catch { /* 용량 초과 무시 */ }
}
function readCodex(): Codex {
  try { return { ...EMPTY_CODEX, ...JSON.parse(localStorage.getItem(CODEX_KEY) ?? '{}') } } catch { return EMPTY_CODEX }
}
function writeCodex(c: Codex) {
  try { localStorage.setItem(CODEX_KEY, JSON.stringify(c)) } catch { /* 무시 */ }
}

interface Store {
  state: GameState | null
  tab: TabKey
  selectedStock: string | null
  codex: Codex
  newGame(seed?: number): void
  next(cards: string[]): void
  doBuy(id: string, qty: number): void
  doSell(id: string, qty: number): void
  choose(eventId: string, idx: number): void
  setTab(t: TabKey): void
  selectStock(id: string | null): void
  clearCutscene(): void
  reset(): void
}

export const useGame = create<Store>((set, get) => {
  /** 상태를 저장하고, 종료된 판이면 도감을 갱신한다. */
  const commit = (next: GameState) => {
    writeSave(next)
    if (next.status === 'ended' && next.ending && get().state?.status !== 'ended') {
      const c = get().codex
      const merged: Codex = {
        endings: [...new Set([...c.endings, next.ending.endingId])],
        titles: [...new Set([...c.titles, ...next.ending.titles])],
        bestAssets: Math.max(c.bestAssets, Math.max(0, totalAssets(next))),
        runs: c.runs + 1,
      }
      writeCodex(merged)
      set({ state: next, codex: merged })
      return
    }
    set({ state: next })
  }
  const guard = (fn: (s: GameState) => GameState) => {
    const s = get().state
    if (!s) return
    try { commit(fn(s)) } catch { /* 규칙 위반은 무시 — UI가 사전 차단한다 */ }
  }

  return {
    state: readSave(),
    tab: 'home',
    selectedStock: null,
    codex: readCodex(),
    newGame(seed = Math.floor(Math.random() * 2 ** 31)) {
      const s = initGame(seed)
      writeSave(s)
      set({ state: s, tab: 'home', selectedStock: null })
    },
    next(cards) { guard(s => advanceTurn(s, cards)) },
    doBuy(id, qty) { guard(s => buy(s, id, qty)) },
    doSell(id, qty) { guard(s => sell(s, id, qty)) },
    choose(eventId, idx) { guard(s => resolveChoice(s, eventId, idx, events)) },
    setTab(tab) { set({ tab }) },
    selectStock(selectedStock) { set({ selectedStock }) },
    clearCutscene() { const s = get().state; if (s) set({ state: { ...s, cutscene: null } }) },
    reset() { set({ state: readSave(), codex: readCodex(), tab: 'home', selectedStock: null }) },
  }
})
```

`src/main.tsx`, `src/App.tsx`, `src/index.css`는 Task 21에서 화면과 함께 채운다. 이 태스크에서는 컴파일만 되도록 최소 형태로 만든다:

```tsx
// packages/app/src/App.tsx
export default function App() { return <div>흑우키우기</div> }
```
```tsx
// packages/app/src/main.tsx
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
createRoot(document.getElementById('root')!).render(<App />)
```
```css
/* packages/app/src/index.css */
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; background: #0d1117; color: #e6edf3;
  font-family: system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; }
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm install && pnpm --filter @bb/app test` / Expected: PASS 9

- [ ] **Step 5: 커밋**

```bash
git add packages/app
git commit -m "feat: app 스캐폴드 + zustand 스토어 + localStorage 영속"
```

---

### Task 20: 아트 레지스트리 + SVG 파츠

**Files:**
- Create: `packages/app/src/art/keys.ts`, `packages/app/src/art/parts/Character.tsx`, `packages/app/src/art/parts/Portraits.tsx`, `packages/app/src/art/parts/Scenes.tsx`, `packages/app/src/art/registry.tsx`, `packages/app/src/art/Art.tsx`
- Test: `packages/app/src/art/registry.test.tsx`

**Interfaces:**
- Produces:
  - `type ArtKey` — 유니온. 캐릭터 18(`char.tier{0..5}.{normal|shaken|joy}`), 조연 4(`npc.{daebak|cho|kim|mom}`), 컷신 10(`cutscene.promote.{0..5}` 6 + `cutscene.demote.{0..3}` 4), 엔딩 8(`ending.<id>`), 섹터 8(`sector.<섹터명>`), UI 12
  - `ART: Record<ArtKey, ArtSource>`
  - `type ArtSource = { kind: 'svg'; component: React.FC<ArtProps> } | { kind: 'image'; src: string }`
  - `interface ArtProps { size?: number; className?: string }`
  - `<Art id={key} size?={n} />`
- **교체 규약:** 게임 코드는 `<Art id="..." />`만 쓴다. AI 일러스트 전환은 `registry.tsx`의 해당 줄을 `{ kind: 'image', src: '/art/xxx.webp' }`로 바꾸는 것으로 끝난다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// packages/app/src/art/registry.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ART, ALL_ART_KEYS } from './registry'
import { Art } from './Art'

describe('아트 레지스트리', () => {
  it('모든 키가 등록되어 있다', () => {
    ALL_ART_KEYS.forEach(k => expect(ART[k], `누락된 아트 키: ${k}`).toBeDefined())
  })
  it('캐릭터 18종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('char.'))).toHaveLength(18)
  })
  it('컷신 10종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('cutscene.'))).toHaveLength(10)
  })
  it('엔딩 8종·조연 4종·섹터 8종이 있다', () => {
    expect(ALL_ART_KEYS.filter(k => k.startsWith('ending.'))).toHaveLength(8)
    expect(ALL_ART_KEYS.filter(k => k.startsWith('npc.'))).toHaveLength(4)
    expect(ALL_ART_KEYS.filter(k => k.startsWith('sector.'))).toHaveLength(8)
  })
  it('모든 키가 예외 없이 렌더된다', () => {
    ALL_ART_KEYS.forEach(k => { expect(() => render(<Art id={k} />)).not.toThrow() })
  })
  it('svg 소스는 <svg>를 낸다', () => {
    const { container } = render(<Art id="char.tier0.normal" />)
    expect(container.querySelector('svg')).not.toBeNull()
  })
  it('image 소스는 <img>를 낸다 (교체 경로 검증)', () => {
    const original = ART['char.tier0.joy']
    ;(ART as Record<string, unknown>)['char.tier0.joy'] = { kind: 'image', src: '/art/x.webp' }
    const { container } = render(<Art id="char.tier0.joy" />)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/art/x.webp')
    ;(ART as Record<string, unknown>)['char.tier0.joy'] = original
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/app test registry` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/app/src/art/keys.ts
export const TIERS = [0, 1, 2, 3, 4, 5] as const
export const MOODS = ['normal', 'shaken', 'joy'] as const
export const NPCS = ['daebak', 'cho', 'kim', 'mom'] as const
export const SECTORS = ['반도체', '2차전지', '바이오', '조선', '게임', '금융', '엔터', '방산'] as const
export const ENDING_IDS = ['legend', 'savings', 'breakeven', 'bank', 'wise', 'super', 'fire', 'kimheir'] as const
export const UI_KEYS = [
  'ui.mental', 'ui.condition', 'ui.cash', 'ui.assets', 'ui.up', 'ui.down',
  'ui.lock', 'ui.rumor', 'ui.news', 'ui.card', 'ui.tier', 'ui.calendar',
] as const

export type ArtKey =
  | `char.tier${(typeof TIERS)[number]}.${(typeof MOODS)[number]}`
  | `npc.${(typeof NPCS)[number]}`
  | `cutscene.promote.${(typeof TIERS)[number]}`
  | `cutscene.demote.0` | `cutscene.demote.1` | `cutscene.demote.2` | `cutscene.demote.3`
  | `ending.${(typeof ENDING_IDS)[number]}`
  | `sector.${(typeof SECTORS)[number]}`
  | (typeof UI_KEYS)[number]
```

```tsx
// packages/app/src/art/parts/Character.tsx
export interface ArtProps { size?: number; className?: string }

const SKIN = '#f3d3b5'
/** 티어가 오를수록 옷이 나아진다. */
const OUTFIT = ['#5b6570', '#4a6fa5', '#3f7d6b', '#8a6b3f', '#6b4a8a', '#a58a3f']

export function makeCharacter(tier: number, mood: 'normal' | 'shaken' | 'joy') {
  return function Character({ size = 120, className }: ArtProps) {
    const shake = mood === 'shaken'
    const joy = mood === 'joy'
    return (
      <svg viewBox="0 0 100 120" width={size} height={size * 1.2} className={className} role="img" aria-label="캐릭터">
        <ellipse cx="50" cy="114" rx="26" ry="5" fill="#000" opacity="0.25" />
        <path d={`M28 112 L32 70 Q50 62 68 70 L72 112 Z`} fill={OUTFIT[tier] ?? OUTFIT[0]} />
        <circle cx="50" cy="42" r="24" fill={SKIN} />
        <path d="M26 34 Q50 12 74 34 Q62 26 50 27 Q38 26 26 34 Z" fill="#2b2118" />
        {shake ? (
          <>
            <path d="M38 40 l8 6 M46 40 l-8 6" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            <path d="M54 40 l8 6 M62 40 l-8 6" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="50" cy="55" rx="6" ry="7" fill="#5c2b2b" />
            <path d="M70 34 q6 10 2 18" stroke="#7fb3ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : joy ? (
          <>
            <path d="M38 42 q5 -6 10 0" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M54 42 q5 -6 10 0" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M38 54 q12 12 24 0" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="42" cy="42" r="2.6" fill="#333" />
            <circle cx="60" cy="42" r="2.6" fill="#333" />
            <path d="M42 55 q8 4 16 0" stroke="#333" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        )}
      </svg>
    )
  }
}
```

```tsx
// packages/app/src/art/parts/Portraits.tsx
import type { ArtProps } from './Character'

const PALETTE: Record<string, [string, string, string]> = {
  daebak: ['#c9a227', '#3a2f10', '박'],
  cho:    ['#5b8c5a', '#16281a', '최'],
  kim:    ['#a63d40', '#2a1113', '김'],
  mom:    ['#8a6bb8', '#231a2e', '母'],
}

export function makePortrait(id: string) {
  return function Portrait({ size = 64, className }: ArtProps) {
    const [fg, bg, glyph] = PALETTE[id] ?? ['#888', '#222', '?']
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label={id}>
        <rect width="64" height="64" rx="14" fill={bg} />
        <circle cx="32" cy="26" r="12" fill={fg} />
        <path d="M12 60 q20 -18 40 0 Z" fill={fg} opacity="0.85" />
        <text x="32" y="31" textAnchor="middle" fontSize="13" fontWeight="700" fill={bg}>{glyph}</text>
      </svg>
    )
  }
}
```

```tsx
// packages/app/src/art/parts/Scenes.tsx
import type { ArtProps } from './Character'

/** 컷신·엔딩·섹터·UI를 공통 배지로 그린다. 색·기호만 달라진다. */
export function makeScene(tone: string, glyph: string, label: string) {
  return function Scene({ size = 160, className }: ArtProps) {
    return (
      <svg viewBox="0 0 160 100" width={size} height={size * 0.625} className={className} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0d1117" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect width="160" height="100" rx="12" fill={`url(#g-${label})`} />
        <text x="80" y="52" textAnchor="middle" fontSize="30">{glyph}</text>
        <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#e6edf3" opacity="0.9">{label}</text>
      </svg>
    )
  }
}

export function makeIcon(glyph: string, label: string) {
  return function Icon({ size = 20, className }: ArtProps) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} role="img" aria-label={label}>
        <text x="12" y="18" textAnchor="middle" fontSize="16">{glyph}</text>
      </svg>
    )
  }
}
```

```tsx
// packages/app/src/art/registry.tsx
import { TIERS, MOODS, NPCS, SECTORS, ENDING_IDS, UI_KEYS, type ArtKey } from './keys'
import { makeCharacter, type ArtProps } from './parts/Character'
import { makePortrait } from './parts/Portraits'
import { makeScene, makeIcon } from './parts/Scenes'

export type ArtSource =
  | { kind: 'svg'; component: React.FC<ArtProps> }
  | { kind: 'image'; src: string }

const TIER_LABELS = ['주린이', '개미', '불개미', '슬기로운 개미', '슈퍼개미', '큰손']
const ENDING_META: Record<string, [string, string]> = {
  legend: ['#6e2b2b', '💀'], savings: ['#4a4a4a', '🏦'], breakeven: ['#3f5a6b', '😐'],
  bank: ['#3f6b52', '🙂'], wise: ['#3f7d6b', '📈'], super: ['#a58a3f', '🐜'],
  fire: ['#c9702a', '🔥'], kimheir: ['#7a2f6b', '📢'],
}
const SECTOR_GLYPH: Record<string, string> = {
  '반도체': '🔲', '2차전지': '🔋', '바이오': '🧬', '조선': '🚢',
  '게임': '🎮', '금융': '🏦', '엔터': '🎤', '방산': '🛡️',
}
const UI_GLYPH: Record<string, string> = {
  'ui.mental': '🧠', 'ui.condition': '⚡', 'ui.cash': '💵', 'ui.assets': '💰',
  'ui.up': '▲', 'ui.down': '▼', 'ui.lock': '🔒', 'ui.rumor': '👂',
  'ui.news': '📰', 'ui.card': '🃏', 'ui.tier': '🏅', 'ui.calendar': '📅',
}

const entries: [string, ArtSource][] = []

for (const t of TIERS) for (const m of MOODS) {
  entries.push([`char.tier${t}.${m}`, { kind: 'svg', component: makeCharacter(t, m) }])
}
for (const n of NPCS) entries.push([`npc.${n}`, { kind: 'svg', component: makePortrait(n) }])
for (const t of TIERS) {
  entries.push([`cutscene.promote.${t}`, { kind: 'svg', component: makeScene('#2f6b4f', '🎉', `${TIER_LABELS[t]} 승급`) }])
}
for (const t of [0, 1, 2, 3]) {
  entries.push([`cutscene.demote.${t}`, { kind: 'svg', component: makeScene('#5a3a3a', '💧', `${TIER_LABELS[t]} 강등`) }])
}
for (const id of ENDING_IDS) {
  const [tone, glyph] = ENDING_META[id]!
  entries.push([`ending.${id}`, { kind: 'svg', component: makeScene(tone, glyph, id) }])
}
for (const s of SECTORS) entries.push([`sector.${s}`, { kind: 'svg', component: makeIcon(SECTOR_GLYPH[s]!, s) }])
for (const k of UI_KEYS) entries.push([k, { kind: 'svg', component: makeIcon(UI_GLYPH[k]!, k) }])

export const ART = Object.fromEntries(entries) as Record<ArtKey, ArtSource>
export const ALL_ART_KEYS = entries.map(([k]) => k) as ArtKey[]
```

```tsx
// packages/app/src/art/Art.tsx
import { ART } from './registry'
import type { ArtKey } from './keys'

export function Art({ id, size, className }: { id: ArtKey; size?: number; className?: string }) {
  const src = ART[id]
  if (!src) return null
  if (src.kind === 'image') return <img src={src.src} alt={id} width={size} className={className} />
  const C = src.component
  return <C size={size} className={className} />
}
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/app test registry` / Expected: PASS 7

- [ ] **Step 5: 커밋**

```bash
git add packages/app/src/art
git commit -m "feat: 아트 레지스트리 60키 + SVG 파츠 (이미지 교체 경로 포함)"
```

---

### Task 21: HUD · 탭바 · 홈 화면 (턴 진행 루프 UI)

**Files:**
- Create: `packages/app/src/components/Hud.tsx`, `TabBar.tsx`, `NewsFeed.tsx`, `CardGrid.tsx`, `packages/app/src/screens/HomeScreen.tsx`, `packages/app/src/format.ts`
- Modify: `packages/app/src/App.tsx`, `packages/app/src/index.css`
- Test: `packages/app/src/screens/HomeScreen.test.tsx`

**Interfaces:**
- Produces:
  - `format.ts`: `won(n: number): string` (예: `84,320,000원`), `pct(n: number): string` (`+18.4%`), `yearWeek(turn: number): string` (`2년차 14주`)
  - `<Hud />` — 진행바·티어·총자산·수익률·예수금·멘탈/컨디션 게이지
  - `<TabBar />` — 4탭 전환
  - `<NewsFeed />` — 최근 8건, `rumor`는 다른 색
  - `<CardGrid onPick />` — 카드 목록. 잠긴 카드는 비활성 + 자물쇠. **회복 카드는 흔들림 시 목록 최상단**
  - `<HomeScreen />` — 캐릭터 + 뉴스 + 카드 + `[한 주 넘기기]`
  - 캐릭터 무드: 흔들림이면 `shaken`, 수익률 ≥ +20%면 `joy`, 아니면 `normal`

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// packages/app/src/screens/HomeScreen.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HomeScreen } from './HomeScreen'
import { Hud } from '../components/Hud'
import { useGame } from '../store/store'
import { won, pct, yearWeek } from '../format'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('format', () => {
  it('won은 천단위 구분과 원을 붙인다', () => expect(won(84_320_000)).toBe('84,320,000원'))
  it('pct는 부호를 붙인다', () => { expect(pct(18.44)).toBe('+18.4%'); expect(pct(-3.2)).toBe('-3.2%') })
  it('yearWeek는 연차·주차로 바꾼다', () => {
    expect(yearWeek(1)).toBe('1년차 1주')
    expect(yearWeek(53)).toBe('2년차 1주')
    expect(yearWeek(156)).toBe('3년차 52주')
  })
})

describe('Hud', () => {
  it('자산과 게이지를 보여준다', () => {
    render(<Hud />)
    expect(screen.getByText('3,000,000원')).toBeDefined()
    expect(screen.getByTestId('gauge-mental')).toBeDefined()
    expect(screen.getByTestId('gauge-condition')).toBeDefined()
    expect(screen.getByText('주린이')).toBeDefined()
  })
})

describe('HomeScreen', () => {
  it('행동 카드가 렌더된다', () => {
    render(<HomeScreen />)
    expect(screen.getAllByTestId(/^card-/).length).toBeGreaterThan(5)
  })
  it('카드를 고르기 전에는 턴 넘기기가 비활성이다', () => {
    render(<HomeScreen />)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
  })
  it('카드를 고르면 활성화되고 턴이 넘어간다', () => {
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('card-hodl'))
    const btn = screen.getByTestId('next-turn')
    expect(btn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(btn)
    expect(useGame.getState().state!.turn).toBe(2)
  })
  it('흔들림 상태에서 이성 카드가 잠긴다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 10 } } })
    render(<HomeScreen />)
    expect(screen.getByTestId('card-analyze').hasAttribute('disabled')).toBe(true)
  })
  it('흔들림에서도 회복 카드는 열려 있고 최상단에 온다 (스펙 §3.3)', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 5 } } })
    render(<HomeScreen />)
    for (const id of ['rest', 'exercise', 'drink']) {
      expect(screen.getByTestId(`card-${id}`).hasAttribute('disabled')).toBe(false)
    }
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^card-/)[0]!
    expect(['card-rest', 'card-exercise', 'card-drink']).toContain(first.getAttribute('data-testid'))
  })
  it('퇴사 상태면 카드 2장을 고를 수 있다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, employed: false } } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('card-hodl'))
    fireEvent.click(screen.getByTestId('card-news'))
    fireEvent.click(screen.getByTestId('next-turn'))
    expect(useGame.getState().state!.turn).toBe(2)
    expect(useGame.getState().state!.player.stats.info).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/app test HomeScreen` / Expected: FAIL

- [ ] **Step 3: 구현**

```ts
// packages/app/src/format.ts
export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`
export const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
export function yearWeek(turn: number): string {
  const year = Math.floor((turn - 1) / 52) + 1
  const week = ((turn - 1) % 52) + 1
  return `${year}년차 ${week}주`
}
```

```tsx
// packages/app/src/components/Hud.tsx
import { BALANCE, TIER_NAMES, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct, yearWeek } from '../format'
import { Art } from '../art/Art'

function Gauge({ id, label, value, tone }: { id: string; label: string; value: number; tone: string }) {
  return (
    <div className="gauge" data-testid={`gauge-${id}`}>
      <span className="gauge-label">{label}</span>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${value}%`, background: tone }} /></div>
      <span className="gauge-num">{value}</span>
    </div>
  )
}

export function Hud() {
  const s = useGame(st => st.state)
  if (!s) return null
  const assets = totalAssets(s)
  const roi = ((assets - BALANCE.seedMoney) / BALANCE.seedMoney) * 100
  const shaken = s.player.mental <= BALANCE.mental.shakenMax

  return (
    <header className="hud">
      <div className="hud-row">
        <span className="hud-turn"><Art id="ui.calendar" size={14} /> {yearWeek(s.turn)}</span>
        <span className="hud-tier">{TIER_NAMES[s.player.tier]}</span>
      </div>
      <div className="hud-bar"><div style={{ width: `${(s.turn / BALANCE.totalTurns) * 100}%` }} /></div>
      <div className="hud-assets">
        <strong>{won(assets)}</strong>
        <span className={roi >= 0 ? 'up' : 'down'}>{pct(roi)}</span>
      </div>
      <div className="hud-cash">예수금 {won(s.player.cash)}{s.player.loan > 0 && ` · 대출 ${won(s.player.loan)}`}</div>
      <div className="hud-gauges">
        <Gauge id="mental" label="멘탈" value={s.player.mental} tone={shaken ? '#e05252' : '#5aa9e6'} />
        <Gauge id="condition" label="컨디션" value={s.player.condition} tone="#e6b45a" />
      </div>
    </header>
  )
}
```

```tsx
// packages/app/src/components/TabBar.tsx
import { useGame, type TabKey } from '../store/store'

const TABS: [TabKey, string][] = [['home', '홈'], ['market', '시세'], ['account', '계좌'], ['codex', '도감']]

export function TabBar() {
  const tab = useGame(s => s.tab)
  const setTab = useGame(s => s.setTab)
  return (
    <nav className="tabbar">
      {TABS.map(([k, label]) => (
        <button key={k} data-testid={`tab-${k}`} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
          {label}
        </button>
      ))}
    </nav>
  )
}
```

```tsx
// packages/app/src/components/NewsFeed.tsx
import { useGame } from '../store/store'
import { Art } from '../art/Art'

export function NewsFeed() {
  const s = useGame(st => st.state)
  if (!s) return null
  const items = s.news.slice(-8).reverse()
  if (items.length === 0) return <p className="news-empty">아직 아무 소식도 없다.</p>
  return (
    <ul className="news" data-testid="news-feed">
      {items.map((n, i) => (
        <li key={`${n.turn}-${i}`} className={n.kind}>
          <Art id={n.kind === 'rumor' ? 'ui.rumor' : 'ui.news'} size={14} />
          <span>{n.title}</span>
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// packages/app/src/components/CardGrid.tsx
import { isCardAvailable, isShaken, loadCards } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'

const CARDS = loadCards()

export function CardGrid({ picked, onPick }: { picked: string[]; onPick: (id: string) => void }) {
  const s = useGame(st => st.state)
  if (!s) return null

  // 흔들림일 때 회복 카드를 최상단으로 (스펙 §3.3)
  const ordered = isShaken(s)
    ? [...CARDS].sort((a, b) => Number(!!b.isRecovery) - Number(!!a.isRecovery))
    : CARDS

  return (
    <div className="card-list" data-testid="card-list">
      {ordered.map(c => {
        const ok = isCardAvailable(s, c)
        const on = picked.includes(c.id)
        return (
          <button
            key={c.id} data-testid={`card-${c.id}`} disabled={!ok}
            className={`card${on ? ' picked' : ''}${c.isRecovery ? ' recovery' : ''}`}
            onClick={() => onPick(c.id)}
          >
            <span className="card-name">{c.name}{!ok && <Art id="ui.lock" size={12} />}</span>
            <span className="card-desc">{c.desc}</span>
          </button>
        )
      })}
    </div>
  )
}
```

```tsx
// packages/app/src/screens/HomeScreen.tsx
import { useState } from 'react'
import { BALANCE, cardsPerTurn, isShaken, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import { NewsFeed } from '../components/NewsFeed'
import { CardGrid } from '../components/CardGrid'
import type { ArtKey } from '../art/keys'

export function HomeScreen() {
  const s = useGame(st => st.state)
  const next = useGame(st => st.next)
  const [picked, setPicked] = useState<string[]>([])
  if (!s) return null

  const limit = cardsPerTurn(s)
  const roi = ((totalAssets(s) - BALANCE.seedMoney) / BALANCE.seedMoney) * 100
  const mood = isShaken(s) ? 'shaken' : roi >= 20 ? 'joy' : 'normal'
  const charKey = `char.tier${s.player.tier}.${mood}` as ArtKey

  const pick = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= limit ? [...p.slice(1), id] : [...p, id])

  const go = () => { next(picked); setPicked([]) }

  return (
    <section className="screen home">
      <div className="portrait"><Art id={charKey} size={128} /></div>
      <NewsFeed />
      <h2 className="section-title">이번 주에 뭘 할까 <small>{picked.length}/{limit}</small></h2>
      <CardGrid picked={picked} onPick={pick} />
      <button className="next-turn" data-testid="next-turn" disabled={picked.length === 0} onClick={go}>
        한 주 넘기기
      </button>
    </section>
  )
}
```

`App.tsx`를 탭 라우팅으로 교체하고, `index.css`에 아래 뼈대를 추가한다 (색·간격은 자유롭게 다듬되 `max-width: 480px`·다크 배경은 유지):

```tsx
// packages/app/src/App.tsx
import { useGame } from './store/store'
import { Hud } from './components/Hud'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'

export default function App() {
  const state = useGame(s => s.state)
  const tab = useGame(s => s.tab)
  const newGame = useGame(s => s.newGame)

  if (!state) {
    return (
      <main className="app start">
        <h1>흑우키우기</h1>
        <p>3년 뒤, 당신의 계좌는 어떻게 되어 있을까.</p>
        <button data-testid="start" onClick={() => newGame()}>시작하기</button>
      </main>
    )
  }
  return (
    <main className="app">
      <Hud />
      <div className="body">{tab === 'home' && <HomeScreen />}</div>
      <TabBar />
    </main>
  )
}
```

```css
/* packages/app/src/index.css 에 추가 */
.app { max-width: 480px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; }
.body { flex: 1; overflow-y: auto; padding: 12px 14px 80px; }
.hud { position: sticky; top: 0; z-index: 5; background: #161b22; padding: 10px 14px; border-bottom: 1px solid #30363d; }
.hud-row { display: flex; justify-content: space-between; font-size: 12px; color: #8b949e; }
.hud-bar { height: 3px; background: #30363d; border-radius: 2px; margin: 6px 0; }
.hud-bar > div { height: 100%; background: #58a6ff; border-radius: 2px; }
.hud-assets { display: flex; align-items: baseline; gap: 8px; font-size: 20px; }
.hud-cash { font-size: 12px; color: #8b949e; }
.hud-gauges { display: flex; gap: 12px; margin-top: 6px; }
.gauge { display: flex; align-items: center; gap: 5px; flex: 1; font-size: 11px; }
.gauge-track { flex: 1; height: 6px; background: #30363d; border-radius: 3px; overflow: hidden; }
.gauge-fill { height: 100%; transition: width .3s; }
.up { color: #f0616d; } .down { color: #58a6ff; }
.tabbar { position: fixed; bottom: 0; left: 0; right: 0; max-width: 480px; margin: 0 auto;
  display: grid; grid-template-columns: repeat(4, 1fr); background: #161b22; border-top: 1px solid #30363d; }
.tabbar button { padding: 12px 0; background: none; border: 0; color: #8b949e; font-size: 13px; }
.tabbar button.active { color: #e6edf3; font-weight: 700; }
.news { list-style: none; padding: 0; margin: 10px 0; font-size: 13px; }
.news li { display: flex; gap: 6px; padding: 5px 0; border-bottom: 1px solid #21262d; }
.news li.rumor { color: #d2a8ff; }
.card-list { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.card { text-align: left; padding: 10px; border-radius: 10px; border: 1px solid #30363d; background: #161b22; color: #e6edf3; }
.card.picked { border-color: #58a6ff; background: #1c2b3a; }
.card.recovery { border-left: 3px solid #3fb950; }
.card:disabled { opacity: .4; }
.card-name { display: flex; align-items: center; gap: 4px; font-weight: 700; font-size: 14px; }
.card-desc { display: block; margin-top: 3px; font-size: 11px; color: #8b949e; }
.next-turn { width: 100%; margin-top: 14px; padding: 14px; border: 0; border-radius: 12px;
  background: #238636; color: #fff; font-size: 16px; font-weight: 700; }
.next-turn:disabled { background: #30363d; color: #8b949e; }
.section-title { font-size: 14px; margin: 14px 0 8px; }
.section-title small { color: #8b949e; font-weight: 400; }
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/app test HomeScreen` / Expected: PASS 10

- [ ] **Step 5: 커밋**

```bash
git add packages/app/src
git commit -m "feat: HUD·탭바·홈 화면 (턴 진행 루프 UI)"
```

---

### Task 22: 시세 화면 · 종목 상세 · 계좌 화면

**Files:**
- Create: `packages/app/src/components/PriceChart.tsx`, `Donut.tsx`, `packages/app/src/screens/MarketScreen.tsx`, `StockDetail.tsx`, `AccountScreen.tsx`
- Modify: `packages/app/src/App.tsx`, `index.css`
- Test: `packages/app/src/screens/MarketScreen.test.tsx`

**Interfaces:**
- Produces:
  - `<PriceChart history={number[]} width? height? />` — SVG 폴리라인. 상승 빨강/하락 파랑 (한국 관례)
  - `<Donut slices={{ label, value, color }[]} />`
  - `<MarketScreen />` — 섹터 필터 + 종목 리스트. 티어 미달은 자물쇠 + 비활성
  - `<StockDetail />` — 차트, `analyzeStock` 결과(적정가 밴드·리스크·신뢰도), 수량 입력, 매수/매도. `canSell` 실패 시 사유 표시(`손이 안 나간다`)
  - `<AccountScreen />` — 보유 종목·평단·수익률·비중 도넛

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// packages/app/src/screens/MarketScreen.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketScreen } from './MarketScreen'
import { StockDetail } from './StockDetail'
import { AccountScreen } from './AccountScreen'
import { PriceChart } from '../components/PriceChart'
import { useGame } from '../store/store'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('PriceChart', () => {
  it('폴리라인을 그린다', () => {
    const { container } = render(<PriceChart history={[100, 120, 90, 130]} />)
    expect(container.querySelector('polyline')).not.toBeNull()
  })
  it('데이터가 1개여도 깨지지 않는다', () => {
    expect(() => render(<PriceChart history={[100]} />)).not.toThrow()
  })
  it('빈 배열이어도 깨지지 않는다', () => {
    expect(() => render(<PriceChart history={[]} />)).not.toThrow()
  })
})

describe('MarketScreen', () => {
  it('종목 10개가 보인다', () => {
    render(<MarketScreen />)
    expect(screen.getAllByTestId(/^stock-row-/)).toHaveLength(10)
  })
  it('티어 미달 종목은 잠겨 있다', () => {
    render(<MarketScreen />)
    expect(screen.getByTestId('stock-row-def').hasAttribute('disabled')).toBe(true)
  })
  it('티어 통과 종목을 누르면 선택된다', () => {
    render(<MarketScreen />)
    fireEvent.click(screen.getByTestId('stock-row-sjc'))
    expect(useGame.getState().selectedStock).toBe('sjc')
  })
  it('섹터 필터가 목록을 줄인다', () => {
    render(<MarketScreen />)
    fireEvent.click(screen.getByTestId('filter-반도체'))
    expect(screen.getAllByTestId(/^stock-row-/)).toHaveLength(1)
  })
})

describe('StockDetail', () => {
  beforeEach(() => useGame.getState().selectStock('sjc'))

  it('적정가 밴드와 리스크가 보인다', () => {
    render(<StockDetail />)
    expect(screen.getByTestId('fair-band')).toBeDefined()
    expect(screen.getByTestId('risk-grade')).toBeDefined()
  })
  it('매수하면 보유가 생긴다', () => {
    render(<StockDetail />)
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('buy'))
    expect(useGame.getState().state!.player.holdings).toHaveLength(1)
  })
  it('손절 봉인 상태면 매도 버튼이 잠기고 사유가 보인다', () => {
    useGame.getState().doBuy('sjc', 1)
    const s = useGame.getState().state!
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, mental: 5 },
      stocks: s.stocks.map(x => x.id === 'sjc' ? { ...x, price: Math.round(x.price * 0.5) } : x),
    } })
    render(<StockDetail />)
    expect(screen.getByTestId('sell').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/손이 안 나간다/)).toBeDefined()
  })
  it('현금보다 많이 사려 하면 매수가 잠긴다', () => {
    render(<StockDetail />)
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '99999' } })
    expect(screen.getByTestId('buy').hasAttribute('disabled')).toBe(true)
  })
})

describe('AccountScreen', () => {
  it('보유가 없으면 안내가 뜬다', () => {
    render(<AccountScreen />)
    expect(screen.getByTestId('empty-holdings')).toBeDefined()
  })
  it('보유 종목이 행으로 보인다', () => {
    useGame.getState().doBuy('sjc', 2)
    render(<AccountScreen />)
    expect(screen.getByTestId('holding-sjc')).toBeDefined()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/app test MarketScreen` / Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// packages/app/src/components/PriceChart.tsx
export function PriceChart({ history, width = 320, height = 120 }: { history: number[]; width?: number; height?: number }) {
  if (history.length === 0) return <svg width={width} height={height} role="img" aria-label="차트" />
  const min = Math.min(...history), max = Math.max(...history)
  const span = max - min || 1
  const dx = history.length > 1 ? width / (history.length - 1) : width
  const points = history.map((v, i) => `${(i * dx).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`).join(' ')
  const rising = history[history.length - 1]! >= history[0]!
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="차트">
      <polyline points={points} fill="none" stroke={rising ? '#f0616d' : '#58a6ff'} strokeWidth="2" />
    </svg>
  )
}
```

```tsx
// packages/app/src/components/Donut.tsx
export interface Slice { label: string; value: number; color: string }

export function Donut({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  const r = 50, c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label="비중">
      <g transform="translate(70,70) rotate(-90)">
        {slices.map(s => {
          const len = (s.value / total) * c
          const el = <circle key={s.label} r={r} fill="none" stroke={s.color} strokeWidth="20"
            strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />
          offset += len
          return el
        })}
      </g>
    </svg>
  )
}
```

```tsx
// packages/app/src/screens/MarketScreen.tsx
import { useState } from 'react'
import { canBuy } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { Art } from '../art/Art'
import { StockDetail } from './StockDetail'
import type { ArtKey } from '../art/keys'

export function MarketScreen() {
  const s = useGame(st => st.state)
  const selected = useGame(st => st.selectedStock)
  const selectStock = useGame(st => st.selectStock)
  const [sector, setSector] = useState<string | null>(null)
  if (!s) return null
  if (selected) return <StockDetail />

  const sectors = [...new Set(s.stockDefs.map(d => d.sector))]
  const rows = s.stockDefs.filter(d => !sector || d.sector === sector)

  return (
    <section className="screen market">
      <div className="filters">
        <button className={!sector ? 'on' : ''} data-testid="filter-all" onClick={() => setSector(null)}>전체</button>
        {sectors.map(x => (
          <button key={x} className={sector === x ? 'on' : ''} data-testid={`filter-${x}`} onClick={() => setSector(x)}>
            <Art id={`sector.${x}` as ArtKey} size={14} /> {x}
          </button>
        ))}
      </div>
      <ul className="stock-list">
        {rows.map(d => {
          const st = s.stocks.find(x => x.id === d.id)!
          const prev = st.history[st.history.length - 2] ?? st.price
          const chg = ((st.price - prev) / prev) * 100
          const locked = !canBuy(s, d.id).ok
          return (
            <li key={d.id}>
              <button data-testid={`stock-row-${d.id}`} disabled={locked} onClick={() => selectStock(d.id)}>
                <span className="s-name">{d.name}{locked && <Art id="ui.lock" size={12} />}</span>
                <span className="s-sector">{d.sector}</span>
                <span className="s-price">{won(st.price)}</span>
                <span className={chg >= 0 ? 'up' : 'down'}>{pct(chg)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

```tsx
// packages/app/src/screens/StockDetail.tsx
import { useState } from 'react'
import { analyzeStock, canSell, maxBuyQty, priceOf } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { PriceChart } from '../components/PriceChart'

const REASON: Record<string, string> = {
  SELL_BLOCKED: '손이 안 나간다',
  NO_QTY: '보유 수량이 없다',
  NOT_PLAYING: '게임이 끝났다',
}

export function StockDetail() {
  const s = useGame(st => st.state)
  const id = useGame(st => st.selectedStock)
  const selectStock = useGame(st => st.selectStock)
  const doBuy = useGame(st => st.doBuy)
  const doSell = useGame(st => st.doSell)
  const [qty, setQty] = useState(1)
  if (!s || !id) return null

  const def = s.stockDefs.find(d => d.id === id)!
  const stock = s.stocks.find(x => x.id === id)!
  const a = analyzeStock(s, id)
  const held = s.player.holdings.find(h => h.stockId === id)
  const sellChk = canSell(s, id)
  const price = priceOf(s, id)
  const canAfford = qty > 0 && qty <= maxBuyQty(s, id)

  return (
    <section className="screen detail">
      <button className="back" onClick={() => selectStock(null)}>← 목록</button>
      <h2>{def.name} <small>{def.sector}</small></h2>
      <p className="price-now">{won(price)}</p>
      <PriceChart history={stock.history} />

      <dl className="analysis">
        <dt>적정가 밴드</dt>
        <dd data-testid="fair-band">{won(a.fairLow)} ~ {won(a.fairHigh)}</dd>
        <dt>리스크</dt>
        <dd data-testid="risk-grade">{a.risk}</dd>
        <dt>분석 신뢰도</dt>
        <dd>{Math.round(a.confidence * 100)}%</dd>
      </dl>
      {a.confidence < 0.4 && <p className="warn">분석력이 낮다. 이 수치를 믿어도 될지 모르겠다.</p>}

      {held && (
        <p className="held">
          {held.qty}주 보유 · 평단 {won(held.avgCost)} ·{' '}
          <span className={price >= held.avgCost ? 'up' : 'down'}>
            {pct(((price - held.avgCost) / held.avgCost) * 100)}
          </span>
        </p>
      )}

      <div className="trade">
        <input data-testid="qty" type="number" min={1} value={qty}
          onChange={e => setQty(Math.max(1, Number(e.target.value) || 1))} />
        <button data-testid="buy" disabled={!canAfford} onClick={() => doBuy(id, qty)}>매수</button>
        <button data-testid="sell" disabled={!sellChk.ok || !held || held.qty < qty} onClick={() => doSell(id, qty)}>매도</button>
      </div>
      {!sellChk.ok && held && <p className="warn">{REASON[sellChk.reason!] ?? sellChk.reason}</p>}
    </section>
  )
}
```

```tsx
// packages/app/src/screens/AccountScreen.tsx
import { holdingValue, priceOf } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { Donut } from '../components/Donut'

const COLORS = ['#58a6ff', '#f0616d', '#3fb950', '#e6b45a', '#d2a8ff', '#79c0ff', '#ff9b72', '#7ee787', '#ffa198', '#a5d6ff']

export function AccountScreen() {
  const s = useGame(st => st.state)
  if (!s) return null
  const { holdings } = s.player

  if (holdings.length === 0) {
    return (
      <section className="screen account">
        <p data-testid="empty-holdings" className="empty">아직 아무것도 없다. 예수금 {won(s.player.cash)}.</p>
      </section>
    )
  }

  const slices = holdings.map((h, i) => ({
    label: s.stockDefs.find(d => d.id === h.stockId)!.name,
    value: h.qty * priceOf(s, h.stockId),
    color: COLORS[i % COLORS.length]!,
  }))
  slices.push({ label: '현금', value: s.player.cash, color: '#484f58' })

  return (
    <section className="screen account">
      <div className="donut-wrap"><Donut slices={slices} /></div>
      <p className="sum">평가액 {won(holdingValue(s))} · 예수금 {won(s.player.cash)}</p>
      <ul className="holdings">
        {holdings.map(h => {
          const def = s.stockDefs.find(d => d.id === h.stockId)!
          const p = priceOf(s, h.stockId)
          const roi = ((p - h.avgCost) / h.avgCost) * 100
          return (
            <li key={h.stockId} data-testid={`holding-${h.stockId}`}>
              <span className="h-name">{def.name}</span>
              <span className="h-qty">{h.qty}주 · {h.heldTurns}주차</span>
              <span className="h-avg">평단 {won(h.avgCost)}</span>
              <span className={roi >= 0 ? 'up' : 'down'}>{pct(roi)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

`App.tsx`의 `<div className="body">`를 확장한다:
```tsx
{tab === 'home' && <HomeScreen />}
{tab === 'market' && <MarketScreen />}
{tab === 'account' && <AccountScreen />}
```

`index.css`에 `.filters`, `.stock-list`, `.trade`, `.holdings`, `.warn { color: #e6b45a; font-size: 12px; }` 등 최소 스타일을 추가한다.

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/app test MarketScreen` / Expected: PASS 12

- [ ] **Step 5: 커밋**

```bash
git add packages/app/src
git commit -m "feat: 시세·종목 상세·계좌 화면 (SVG 차트·적정가 밴드·도넛)"
```

---

### Task 23: 오버레이 (프롤로그·이벤트 모달·컷신·엔딩) + 도감

**Files:**
- Create: `packages/app/src/overlays/PrologueView.tsx`, `EventModal.tsx`, `CutsceneView.tsx`, `EndingView.tsx`, `packages/app/src/screens/CodexScreen.tsx`
- Modify: `packages/app/src/App.tsx`, `index.css`
- Test: `packages/app/src/overlays/overlays.test.tsx`

**Interfaces:**
- Produces:
  - `<PrologueView onDone />` — 4컷 텍스트. 도감 `runs > 0`이면 App이 자동 스킵
  - `<EventModal />` — `pendingChoices[0]`을 렌더. 선택지 없으면 `확인` 하나. 열려 있는 동안 화면 하단 조작을 덮는다
  - `<CutsceneView />` — `state.cutscene`이 있으면 표시, 닫으면 `clearCutscene()`
  - `<EndingView />` — `status === 'ended'`면 전체화면. 칭호 + 엔딩명 + 최종 자산 + `다시 하기`
  - `<CodexScreen />` — 수집한 엔딩/칭호를 미수집분과 함께 표시(미수집은 `???`), 최고 자산·회차 수
  - 오버레이 우선순위: 엔딩 > 컷신 > 이벤트 > 프롤로그

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
// packages/app/src/overlays/overlays.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EventModal } from './EventModal'
import { CutsceneView } from './CutsceneView'
import { EndingView } from './EndingView'
import { PrologueView } from './PrologueView'
import { CodexScreen } from '../screens/CodexScreen'
import { useGame } from '../store/store'
import { loadEvents } from '@bb/core'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

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
    expect(screen.getByText(/슈퍼개미/)).toBeDefined()
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
    expect(screen.getAllByText('???').length).toBeGreaterThan(0)
  })
  it('수집한 엔딩은 이름이 보인다', () => {
    useGame.setState({ codex: { endings: ['super'], titles: ['박대박을 이긴'], bestAssets: 700_000_000, runs: 1 } })
    render(<CodexScreen />)
    expect(screen.getByText('슈퍼개미')).toBeDefined()
    expect(screen.getByText(/1회/)).toBeDefined()
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/app test overlays` / Expected: FAIL

- [ ] **Step 3: 구현**

```tsx
// packages/app/src/overlays/PrologueView.tsx
import { useState } from 'react'
import { Art } from '../art/Art'

const CUTS = [
  { art: 'npc.daebak', text: '회식 자리. 박대박이 계좌를 돌린다.\n"+3,240만원 (+412%)"' },
  { art: 'char.tier0.normal', text: '집에 오는 길 내내 그 숫자가 떠나지 않는다.' },
  { art: 'ui.cash', text: '새벽 2시. 증권사 앱을 깔고 적금을 깬다.\n시드 300만원.' },
  { art: 'char.tier0.joy', text: '"나만 없어 주식."\n\n그렇게 3년이 시작됐다.' },
] as const

export function PrologueView({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const cut = CUTS[i]!
  return (
    <div className="overlay prologue">
      <button className="skip" data-testid="prologue-skip" onClick={onDone}>건너뛰기</button>
      <Art id={cut.art} size={160} />
      <p className="cut-text">{cut.text}</p>
      <button className="primary" data-testid="prologue-next"
        onClick={() => (i + 1 >= CUTS.length ? onDone() : setI(i + 1))}>
        {i + 1 >= CUTS.length ? '시작' : '다음'}
      </button>
    </div>
  )
}
```

```tsx
// packages/app/src/overlays/EventModal.tsx
import { loadEvents } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import type { ArtKey } from '../art/keys'

const events = loadEvents()

export function EventModal() {
  const s = useGame(st => st.state)
  const choose = useGame(st => st.choose)
  const pending = s?.pendingChoices[0]
  if (!s || !pending) return null

  const def = events.find(e => e.id === pending.eventId)
  if (!def) return null
  const speaker = def.text.speaker

  return (
    <div className="overlay event" data-testid="event-modal">
      <div className="event-card">
        {speaker && <Art id={`npc.${speaker}` as ArtKey} size={56} />}
        <h3>{def.text.title}</h3>
        <p className="event-body">{def.text.body}</p>
        <div className="choices">
          {(def.choices ?? [{ label: '확인', effects: [] }]).map((c, i) => (
            <button key={i} data-testid={`choice-${i}`} onClick={() => choose(def.id, i)}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

```tsx
// packages/app/src/overlays/CutsceneView.tsx
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import type { ArtKey } from '../art/keys'

const LINES: Record<string, string> = {
  'cutscene.promote.1': '드디어 1주가 아니라 10주씩 산다.',
  'cutscene.promote.2': '이제 코스닥이 보인다. 보이면 안 되는데.',
  'cutscene.promote.3': '최존버가 처음으로 말을 걸었다. "조심해."',
  'cutscene.promote.4': '숫자가 현실감을 잃기 시작한다.',
  'cutscene.promote.5': '이제 내가 사면 오른다. 그게 제일 무섭다.',
  'cutscene.demote.0': '처음으로 돌아왔다. 시간만 썼다.',
  'cutscene.demote.1': '박대박한테서 카톡이 왔다. "괜찮냐?"',
  'cutscene.demote.2': '계좌를 안 열어본 지 나흘째다.',
  'cutscene.demote.3': '올라갈 때보다 내려올 때가 훨씬 빠르다.',
}

export function CutsceneView() {
  const s = useGame(st => st.state)
  const clear = useGame(st => st.clearCutscene)
  if (!s?.cutscene) return null
  return (
    <div className="overlay cutscene" data-testid="cutscene">
      <Art id={s.cutscene as ArtKey} size={260} />
      <p className="cut-text">{LINES[s.cutscene] ?? ''}</p>
      <button className="primary" data-testid="cutscene-close" onClick={clear}>계속</button>
    </div>
  )
}
```

```tsx
// packages/app/src/overlays/EndingView.tsx
import { ENDINGS } from '@bb/core'
import { useGame } from '../store/store'
import { won } from '../format'
import { Art } from '../art/Art'
import type { ArtKey } from '../art/keys'

export function EndingView() {
  const s = useGame(st => st.state)
  const newGame = useGame(st => st.newGame)
  if (!s || s.status !== 'ended' || !s.ending) return null

  const { endingId, endingName, titles, finalAssets } = s.ending
  const desc = ENDINGS.find(e => e.id === endingId)?.desc ?? ''

  return (
    <div className="overlay ending" data-testid="ending">
      <Art id={`ending.${endingId}` as ArtKey} size={280} />
      {titles.length > 0 && <p className="titles">{titles.join(' · ')}</p>}
      <h2>{endingName}</h2>
      <p className="ending-desc">{desc}</p>
      <p className="final-assets">{won(finalAssets)}</p>
      <button className="primary" data-testid="restart" onClick={() => newGame()}>다시 하기</button>
    </div>
  )
}
```

```tsx
// packages/app/src/screens/CodexScreen.tsx
import { ENDINGS, TITLES } from '@bb/core'
import { useGame } from '../store/store'
import { won } from '../format'

export function CodexScreen() {
  const codex = useGame(s => s.codex)
  return (
    <section className="screen codex">
      <p className="codex-sum">
        {codex.runs}회 플레이 · 최고 {won(codex.bestAssets)}
      </p>
      <h3>엔딩 {codex.endings.length}/{ENDINGS.length}</h3>
      <ul className="codex-list">
        {ENDINGS.map(e => {
          const got = codex.endings.includes(e.id)
          return (
            <li key={e.id} className={got ? 'got' : 'locked'}>
              <strong>{got ? e.name : '???'}</strong>
              <span>{got ? e.desc : '아직 보지 못한 결말'}</span>
            </li>
          )
        })}
      </ul>
      <h3>칭호 {codex.titles.length}/{TITLES.length}</h3>
      <ul className="codex-titles">
        {TITLES.map(t => (
          <li key={t.id} className={codex.titles.includes(t.name) ? 'got' : 'locked'}>
            {codex.titles.includes(t.name) ? t.name : '???'}
          </li>
        ))}
      </ul>
    </section>
  )
}
```

`App.tsx`를 최종 형태로:
```tsx
import { useState } from 'react'
import { useGame } from './store/store'
import { Hud } from './components/Hud'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { MarketScreen } from './screens/MarketScreen'
import { AccountScreen } from './screens/AccountScreen'
import { CodexScreen } from './screens/CodexScreen'
import { EventModal } from './overlays/EventModal'
import { CutsceneView } from './overlays/CutsceneView'
import { EndingView } from './overlays/EndingView'
import { PrologueView } from './overlays/PrologueView'

export default function App() {
  const state = useGame(s => s.state)
  const tab = useGame(s => s.tab)
  const codex = useGame(s => s.codex)
  const newGame = useGame(s => s.newGame)
  const [prologueDone, setPrologueDone] = useState(false)

  if (!state) {
    return (
      <main className="app start">
        <h1>흑우키우기</h1>
        <p>3년 뒤, 당신의 계좌는 어떻게 되어 있을까.</p>
        <button className="primary" data-testid="start" onClick={() => newGame()}>시작하기</button>
      </main>
    )
  }

  const needPrologue = codex.runs === 0 && state.turn === 1 && !prologueDone
  if (needPrologue) return <PrologueView onDone={() => setPrologueDone(true)} />

  return (
    <main className="app">
      <Hud />
      <div className="body">
        {tab === 'home' && <HomeScreen />}
        {tab === 'market' && <MarketScreen />}
        {tab === 'account' && <AccountScreen />}
        {tab === 'codex' && <CodexScreen />}
      </div>
      <TabBar />
      <EventModal />
      <CutsceneView />
      <EndingView />
    </main>
  )
}
```

`index.css`에 오버레이 공통 스타일 추가:
```css
.overlay { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px; padding: 24px;
  background: rgba(13, 17, 23, .96); text-align: center; }
.overlay .primary { padding: 12px 28px; border: 0; border-radius: 10px; background: #238636; color: #fff; font-size: 15px; font-weight: 700; }
.cut-text { white-space: pre-line; font-size: 15px; line-height: 1.7; max-width: 320px; }
.event-card { background: #161b22; border: 1px solid #30363d; border-radius: 14px; padding: 20px; max-width: 340px; }
.event-body { white-space: pre-line; font-size: 14px; color: #c9d1d9; line-height: 1.6; }
.choices { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; }
.choices button { padding: 11px; border-radius: 9px; border: 1px solid #30363d; background: #21262d; color: #e6edf3; }
.titles { color: #e6b45a; font-size: 13px; }
.final-assets { font-size: 24px; font-weight: 700; }
.codex-list, .codex-titles { list-style: none; padding: 0; }
.codex-list li { display: flex; flex-direction: column; padding: 9px 0; border-bottom: 1px solid #21262d; font-size: 13px; }
.codex-list li.locked, .codex-titles li.locked { color: #484f58; }
.skip { position: absolute; top: 16px; right: 16px; background: none; border: 0; color: #8b949e; font-size: 13px; }
```

- [ ] **Step 4: 통과 확인** — Run: `pnpm --filter @bb/app test` / Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add packages/app/src
git commit -m "feat: 프롤로그·이벤트 모달·컷신·엔딩 오버레이 + 도감 화면"
```

---

### Task 24: 통합 점검 · 밸런싱 튜닝 · README

**Files:**
- Create: `README.md`
- Modify: `packages/core/src/balance.ts` (튜닝 결과 반영), `package.json` (스크립트 추가)
- Test: `packages/app/src/integration.test.tsx`

**Interfaces:**
- Produces: 루트 스크립트 `pnpm dev`, `pnpm sim`, `pnpm typecheck`. 완주 통합 테스트.

- [ ] **Step 1: 실패하는 통합 테스트 작성**

```tsx
// packages/app/src/integration.test.tsx
import { describe, it, expect, beforeEach } from 'vitest'
import { useGame } from './store/store'
import { loadEvents, BALANCE } from '@bb/core'

const events = loadEvents()

/** UI 스토어만으로 156턴을 완주한다. */
function playToEnd(seed: number) {
  const g = useGame.getState()
  g.newGame(seed)
  for (let i = 0; i < BALANCE.totalTurns + 5; i++) {
    const s = useGame.getState().state!
    if (s.status === 'ended') break
    while (useGame.getState().state!.pendingChoices.length > 0) {
      const c = useGame.getState().state!.pendingChoices[0]!
      const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
      if (n > 0) useGame.getState().choose(c.eventId, 0)
      else break
    }
    useGame.getState().next(['hodl'])
  }
  return useGame.getState().state!
}

beforeEach(() => { localStorage.clear(); useGame.getState().reset() })

describe('통합: 스토어로 완주', () => {
  it('여러 시드에서 끝까지 가고 엔딩이 나온다', () => {
    for (const seed of [1, 2, 3, 7, 13]) {
      const s = playToEnd(seed)
      expect(s.status).toBe('ended')
      expect(s.ending!.endingId.length).toBeGreaterThan(0)
    }
  })
  it('완주 후 도감과 세이브가 남는다', () => {
    playToEnd(4)
    expect(useGame.getState().codex.runs).toBe(1)
    expect(localStorage.getItem('blackbull.save.v1')).not.toBeNull()
  })
  it('새로고침(reset)해도 진행이 복원된다', () => {
    useGame.getState().newGame(9)
    useGame.getState().next(['hodl'])
    useGame.getState().next(['hodl'])
    const turn = useGame.getState().state!.turn
    useGame.setState({ state: null })
    useGame.getState().reset()
    expect(useGame.getState().state!.turn).toBe(turn)
  })
  it('완주 중 멘탈·컨디션이 범위를 벗어나지 않는다', () => {
    const s = playToEnd(21)
    expect(s.player.mental).toBeGreaterThanOrEqual(0)
    expect(s.player.mental).toBeLessThanOrEqual(100)
    expect(s.player.condition).toBeGreaterThanOrEqual(0)
    expect(s.player.condition).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: 실패 확인** — Run: `pnpm --filter @bb/app test integration` / Expected: FAIL 또는 완주 중 예외

- [ ] **Step 3: 전체 검증 + 밸런싱 튜닝**

```bash
pnpm -r typecheck
pnpm test
pnpm --filter @bb/sim start -- --runs 2000 --strategy buyhold
pnpm --filter @bb/sim start -- --runs 2000 --strategy panic
pnpm --filter @bb/sim start -- --runs 2000 --strategy momentum
pnpm --filter @bb/sim start -- --runs 2000 --strategy random
```

목표치(벗어나면 **코드가 아니라 `BALANCE` 값**을 조정하고 다시 돌린다):

| 지표 | 목표 |
|---|---|
| buyhold 파산율 | < 10% |
| panic 파산율 | > 25% |
| panic 중앙 자산 | buyhold 중앙 자산보다 확실히 낮음 |
| random 엔딩 종류 | 4종 이상 등장 |
| 최다 엔딩 비중 | < 70% |
| 평균 흔들림 턴 | 10~50턴 (0이면 멘탈이 무의미, 100+면 너무 가혹) |

주로 만지는 값: `regime.*.drift`, `meanRev`, 종목 `volatility`/`hype`, `mental.worsenFactor`, `endings.*` 경계.

- [ ] **Step 4: 통과 확인 + 실제 구동**

Run: `pnpm test && pnpm -r typecheck`
Expected: 전부 PASS

Run: `pnpm dev` → 브라우저에서 프롤로그 → 몇 턴 진행 → 매수 → 이벤트 선택 → 탭 이동이 동작하는지 육안 확인.

- [ ] **Step 5: README 작성 + 커밋**

`README.md`:
````markdown
# 흑우키우기 (Black Bull)

주차 턴제 주식 육성 게임. 중소기업 3년차 직장인이 3년(156턴) 동안 주식으로 무엇을 잃고 얻는지에 대한 이야기.

## 실행

```bash
pnpm install
pnpm dev            # 개발 서버
pnpm test           # 전체 테스트
pnpm sim -- --runs 2000 --strategy buyhold   # 밸런싱 시뮬
```

## 구조

- `packages/core` — 순수 함수형 게임 코어. React 의존성 없음. 모든 규칙과 데이터가 여기 있다
- `packages/sim` — 코어를 headless로 수천 판 돌려 밸런스를 검증하는 CLI
- `packages/app` — React + Vite 프론트엔드

핵심 API는 `initGame(seed)` / `advanceTurn(state, cardIds)` / `buy` / `sell` 넷이다. 상태는 불변이고 난수는 시드 고정이라, 시드만 있으면 156턴 전체가 재현된다.

## 아트 교체

모든 그림은 `packages/app/src/art/registry.tsx` 한 곳에 등록되고, 화면에서는 `<Art id="..." />`로만 쓴다.
SVG를 AI 일러스트로 바꾸려면 registry의 해당 줄만 고치면 된다. 게임 코드는 건드리지 않는다.

```ts
'char.tier1.shaken': { kind: 'image', src: '/art/char_t1_shaken.webp' },
```

## 설계 문서

`docs/superpowers/specs/2026-08-25-black-bull-design.md`
````

루트 `package.json` 스크립트 추가:
```json
"scripts": {
  "test": "pnpm -r test",
  "typecheck": "pnpm -r typecheck",
  "dev": "pnpm --filter @bb/app dev",
  "build": "pnpm --filter @bb/app build",
  "sim": "pnpm --filter @bb/sim start"
}
```

```bash
git add -A
git commit -m "feat: 통합 테스트·밸런싱 튜닝·README"
```

---

## 자체 리뷰 결과

**스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| §2.1 주인공 현금흐름 | 3(BALANCE), 14(월급) |
| §2.2 프롤로그 | 23 |
| §2.3 국면 | 4, 6 |
| §2.4 티어 6단계·강등 | 14 |
| §2.5 게이지·5스탯 | 3, 9, 10, 11, 12(정보력), 16(분석력) |
| §2.6 조연 4인 | 13(플래그), 20(초상), 23(모달) |
| §2.7 밈 명칭 | 5, 11, 13 |
| §3 멘탈 2구간·데드락 | 7(손절봉인), 9, 11(카드잠김), 21(UI) |
| §4.1~4.3 주가·국면 | 5, 6 |
| §4.4 시드 RNG | 2 |
| §4.5 턴 루프 | 15 |
| §4.6 거래 비용 | 7 |
| §4.7 이벤트·delay | 12, 13 |
| §4.8 카드 12장 | 11 |
| §5.1 엔딩×칭호 | 17 |
| §5.2 퇴사 분기 | 13(이벤트), 15(카드 2장), 9(멘탈 −6) |
| §5.3 파산 | 15, 17 |
| §5.4 컷신 | 14(플래그), 20(아트), 23(뷰) |
| §5.5 회차 이월 | 19(도감), 23(도감 화면) |
| §6 화면·탭 | 21, 22, 23 |
| §7.2 구조 | 1, 18, 19 |
| §7.3 아트 슬롯 | 20 |
| §7.4 저장 | 19 |
| §8 테스트·밸런싱 | 전 태스크 + 18, 24 |
| §9 1차 범위 | 5(종목 10), 13(이벤트 60), 11(카드 12), 17(엔딩 8×칭호 7) |
| §10 비범위 | 백엔드·사운드·영구강화·실시세·네이티브 모두 미포함 |

신용거래는 스펙 §2.4의 티어3 해금 항목으로, 멘탈 −8 규칙(§3.1)이 작동하려면 필수라 Task 8로 명시했다.

**플레이스홀더 스캔** — TBD/TODO 없음. 유일한 요약 지시는 Task 13의 이벤트 60종으로, 파일별 개수·스키마·톤·실물 예시를 제시했다.

**타입 정합성** — `advanceTurn(state, cardIds: string[])`, `judgeEnding(state, bankrupt)`, `analyzeStock(state, stockId)`, `settleMental(state, recoveryDelta)`, `stepPrices(stocks, defs, regime, impacts, rng)` 시그니처가 정의 태스크와 호출 태스크에서 일치함을 확인했다. `ArtKey` 유니온과 `registry.tsx` 생성 키가 일치한다(Task 20 테스트가 강제). `BALANCE` 참조 키가 전 태스크에서 동일하다.

**순환 의존 주의** — `turn/effects.ts`가 `turn/trade.ts`를 부르고, `turn/cards.ts`가 `mental/mental.ts`를 부르며, `mental/mental.ts`는 `turn/accounting.ts`를 부른다. `accounting`은 아무것도 부르지 않으므로 순환은 없다. `turn/advance.ts`만 `endings/`를 참조한다.

# 흑우키우기 비주얼 노벨 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동작하는 1차 슬라이스를 "비주얼 노벨 + 가상 주식"으로 다시 세운다 — 행동력·카드 등급·슬롯 뽑기로 게임 루프를 바꾸고, 전 화면을 캐릭터 중심 VN 문법으로 재구성하며, 종목명을 법적으로 안전하게 만든다.

**Architecture:** `@bb/core`의 턴 루프에 행동력 예산과 등급 굴림을 넣고(결정론 유지), `@bb/app`의 화면을 디자인 토큰 위에 다시 짠다. 아트는 2레이어 슬롯(배경+인물)으로 두어 AI 생성 이미지가 나중에 순차 교체되도록 한다. 이미지가 없는 동안에도 완결된 화면으로 보이는 것이 슬롯 설계의 제1 요건이다.

**Tech Stack:** TypeScript strict · React 18 + Vite · zustand · vitest + Testing Library(jsdom) · pnpm workspace

**Spec:** `docs/superpowers/specs/2026-08-26-black-bull-vn-redesign.md`
(1차 설계는 `docs/superpowers/specs/2026-08-25-black-bull-design.md` — 여전히 유효한 게임 규칙의 출처)

## Global Constraints

- 의존 방향 `app → core`, `sim → core`. **역방향 금지.** `@bb/core`는 런타임 의존성 0개.
- core·sim에서 `Math.random`/`Date.now`/`new Date` **금지**. 모든 무작위성은 `GameState.rng`를 통과한다.
- **같은 시드는 156턴을 바이트 단위로 재현한다.** 등급 굴림·슬롯 뽑기·리롤 전부 시드된 RNG를 쓴다.
- 튜닝 가능한 모든 수치는 `packages/core/src/balance.ts`의 `BALANCE` 단일 객체에만 둔다.
- 돈은 정수 KRW. 주가 정수, 하한 50원. 수수료 0.015%(양방향), 증권거래세 0.18%(매도만).
- 멘탈·컨디션 0~100. 흔들림 구간 멘탈 ≤ 29. 손절 봉인: 흔들림 + 20% 이상 손실 포지션.
- **회복 슬롯은 항상 하나 열려 있다.** 회복 카드는 행동력을 소모하지 않는다.
- `resolveChoice`는 절대 던지지 않는다. 잘못된 인자면 state를 그대로 반환한다.
- UI 문구 한국어, 코드 식별자 영어. 모바일 세로 max-width 480px, 다크 테마, 터치 타깃 44px 이상.
- 상승 빨강 / 하락 파랑(한국 관례), 0은 중립.
- TypeScript strict, `tsc` 클린, `vite build` 성공.
- JSON import 위 `as` 타입 단언 **금지** — 1차에서 여섯 번 결함으로 잡혔다. `as const satisfies` + 항목별 루프를 쓴다.
- 테스트 설명문은 한국어.
- `prefers-reduced-motion`을 존중한다.

## UI 태스크의 스텝 표기

Task 9~22의 화면 작업은 `Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋`으로 접혀 있다.
**구현 코드를 미리 못 박지 않은 것은 의도적이다** — 컴포넌트의 시각적 형태는 테스트가 고정하는
동작과 스펙 §3·§4의 레이아웃 다이어그램이 함께 결정하며, 그 사이의 판단은 구현자의 몫이다.
각 태스크의 테스트는 전부 실제 코드로 적혀 있으므로 요구사항은 모호하지 않다.

화면 태스크를 맡은 구현자는 **`frontend-design` 스킬을 먼저 호출한다.**
기본 템플릿처럼 보이지 않는, 의도가 읽히는 다크 테마 모바일 게임 UI가 목표다.

## 파일 구조

**core (변경)**
```
data/stocks.json           종목명 8종 교체
data/cards.json            물타기 제거, 존버를 회복으로, 등급 기준값
data/events/*.json         실명 6곳 교체
data/listed-companies.json (이미 있음) 대조 테스트의 근거
src/types.ts               CardGrade, TurnSlots, Trackers 확장
src/balance.ts             action / grade / reroll / slots 블록 신설
src/turn/grade.ts          (신규) 등급 굴림
src/turn/slots.ts          (신규) 슬롯 뽑기·리롤
src/turn/cards.ts          등급 적용, 행동력 비용
src/turn/trade.ts          averageDown 신설
src/turn/effects.ts        averageDown 효과 제거
src/turn/advance.ts        행동력 예산, 슬롯 생성 단계
src/turn/accounting.ts     수수료·세금 누적 훅
```

**app (재작성)**
```
src/design/tokens.css      (신규) 색·간격·타이포·모션 토큰
src/design/motion.ts       (신규) 애니메이션 헬퍼(reduced-motion 존중)
src/art/slots.tsx          (신규) 2레이어 슬롯(배경+인물), 미니멀 폴백
src/components/TopBar.tsx      (신규) 알약 4개
src/components/CharacterStage.tsx (신규) 캐릭터 260px
src/components/StatChips.tsx   (신규) 스탯 5종
src/components/ActionMeter.tsx (신규) 행동력 + 리롤
src/components/CardTile.tsx    (신규) 등급 배지 카드 (core의 SlotCard 타입과 이름이 겹치지 않게)
src/components/NewsTicker.tsx  (신규) 한 줄 티커 + 시트
src/components/Hud.tsx         게이지만 남기고 축소
src/overlays/DialogueBox.tsx   (신규) 타이핑·이름표·로그
src/overlays/ChoiceSheet.tsx   (신규) 하단 시트
src/overlays/EndingView.tsx    잔고증명서로 재작성
src/screens/*.tsx              새 디자인 언어로 재구성
docs/art-prompts.md            (신규) 생성 프롬프트 48컷
```

---

### Task 1: 종목명 가상화 + 상장사 대조 테스트

**Files:**
- Modify: `packages/core/data/stocks.json`, `packages/core/data/events/*.json`
- Test: `packages/core/src/market/stocks.test.ts`

**Interfaces:**
- Produces: 종목명 8종 신규. `listed-companies.json`은 `string[]`(회사명 2,761개).

- [ ] **Step 1: 대조 테스트를 먼저 쓴다**

```ts
// packages/core/src/market/stocks.test.ts 에 추가
import listed from '../../data/listed-companies.json'

describe('종목명 법적 안전성', () => {
  // 순우리말 어근을 쓰는 이유: 실존 상장사는 대부분 한자어·영어 어근이라
  // 순우리말은 구조적으로 충돌 확률이 낮다. 종목 추가 시에도 같은 규칙을 따를 것.
  const ROOTS = ['윤슬', '청람', '나린', '해솔', '도깨비', '한들', '반딧불', '무쇠'] as const

  it('상장법인목록이 실제로 로드된다', () => {
    expect(Array.isArray(listed)).toBe(true)
    expect(listed.length).toBeGreaterThan(2000)
  })

  it('어떤 종목명도 실존 상장사와 완전일치하지 않는다', () => {
    const names = new Set<string>(listed)
    for (const d of loadStockDefs()) expect(names.has(d.name)).toBe(false)
  })

  it('종목명 어근이 어떤 상장사명에도 포함되지 않는다', () => {
    for (const root of ROOTS) {
      const hits = (listed as string[]).filter(n => n.includes(root))
      expect(hits).toEqual([])
    }
  })

  it('ETF 둘을 뺀 8종이 지정된 어근을 쓴다', () => {
    const nonEtf = loadStockDefs().filter(d => !d.etf)
    expect(nonEtf).toHaveLength(8)
    for (const d of nonEtf) {
      expect(ROOTS.some(r => d.name.startsWith(r))).toBe(true)
    }
  })

  it('이벤트 본문에 실존 기업명이 남아 있지 않다', () => {
    const banned = ['에코프로', '두산', '삼성', '하이닉스', '카카오', '네이버', 'HD한국조선', 'KB금융']
    const all = JSON.stringify(loadEvents())
    for (const w of banned) expect(all).not.toContain(w)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test src/market/stocks.test.ts`
Expected: FAIL — 현재 종목명이 `삼정전자` 등이라 어근 검사와 ETF 검사가 깨진다.

- [ ] **Step 3: `stocks.json`의 `name` 8곳을 교체**

| id | 기존 | 신규 |
|---|---|---|
| `sjc` | 삼정전자 | 윤슬반도체 |
| `ecp` | 에코프로형제 | 청람소재 |
| `bio` | 한알바이오 | 나린바이오 |
| `shp` | HD한국조선해왕 | 해솔중공업 |
| `gam` | 배그래프톤 | 도깨비게임즈 |
| `bnk` | KB금융지붕 | 한들금융지주 |
| `ent` | 하입엔터 | 반딧불엔터 |
| `def` | 두산로보뭐시기 | 무쇠정밀 |

`lev`(레버리지ETF)·`inv`(곱버스ETF)는 일반명사·업계 은어이므로 **유지한다.**

- [ ] **Step 4: 이벤트 본문의 실명 교체**

`grep -rn "에코프로\|두산" packages/core/data/events/`로 6곳을 찾아 각각 신규 종목명으로 바꾼다.
문맥이 특정 종목을 가리키면 해당 종목명으로, 일반적 언급이면 문장을 다듬는다.

- [ ] **Step 5: 통과 확인**

Run: `pnpm --filter @bb/core test`
Expected: PASS. 기존 종목명을 문자열로 단언하던 테스트가 있으면 함께 갱신한다.

- [ ] **Step 6: 커밋**

```bash
git add packages/core/data/stocks.json packages/core/data/events packages/core/src/market/stocks.test.ts
git commit -m "feat: 종목명 8종 가상화 + 상장사 대조 테스트"
```

---

### Task 2: 카드 재편 — 물타기 이관, 존버 흡수

**Files:**
- Modify: `packages/core/data/cards.json`, `packages/core/src/turn/effects.ts`
- Create: `packages/core/src/turn/trade.ts`에 `averageDown` 추가
- Test: `packages/core/src/turn/trade.test.ts`, `packages/core/src/turn/cards.test.ts`

**Interfaces:**
- Produces: `averageDown(state: GameState, stockId: string, budget: number): GameState`
- Produces: `canAverageDown(state, stockId): { ok: boolean; reason?: string }`
- 카드 풀이 12장 → 11장(물타기 제거), 그중 회복 4장(`rest`/`exercise`/`drink`/`hodl`).

- [ ] **Step 1: 실패하는 테스트**

```ts
// packages/core/src/turn/trade.test.ts 에 추가
describe('averageDown', () => {
  it('보유하지 않은 종목은 물타기할 수 없다', () => {
    const s = makeState({ player: { cash: 1_000_000, holdings: [] } })
    expect(canAverageDown(s, 'sjc').ok).toBe(false)
  })

  it('평단보다 현재가가 높으면 물타기할 수 없다', () => {
    const s = makeState({
      stocks: [makeStock({ id: 'sjc', price: 12000 })],
      player: { cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    expect(canAverageDown(s, 'sjc').ok).toBe(false)
  })

  it('물타기하면 평단이 실제로 내려간다', () => {
    const s = makeState({
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    const after = averageDown(s, 'sjc', 500_000)
    const h = after.player.holdings.find(x => x.stockId === 'sjc')!
    expect(h.avgCost).toBeLessThan(10000)
    expect(h.qty).toBeGreaterThan(10)
  })

  it('예산을 넘겨 쓰지 않는다', () => {
    const s = makeState({
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    const after = averageDown(s, 'sjc', 300_000)
    expect(s.player.cash - after.player.cash).toBeLessThanOrEqual(300_000)
  })

  it('현금이 1주 값에 못 미치면 상태가 그대로다', () => {
    const s = makeState({
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { cash: 100, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    expect(averageDown(s, 'sjc', 100)).toEqual(s)
  })
})

describe('카드 풀 재편', () => {
  it('물타기 카드가 사라졌다', () => {
    expect(loadCards().find(c => c.id === 'avgdown')).toBeUndefined()
  })
  it('존버가 회복 카드가 됐다', () => {
    expect(loadCards().find(c => c.id === 'hodl')!.isRecovery).toBe(true)
  })
  it('회복 4장 · 행동 7장이다', () => {
    const cards = loadCards()
    expect(cards.filter(c => c.isRecovery)).toHaveLength(4)
    expect(cards.filter(c => !c.isRecovery)).toHaveLength(7)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test src/turn/trade.test.ts src/turn/cards.test.ts`
Expected: FAIL — `averageDown`/`canAverageDown` 미정의, 카드 풀이 12장.

- [ ] **Step 3: `trade.ts`에 구현**

```ts
/** 물타기 — 이미 보유 중이고 손실 중인 종목을 예산 범위에서 추가 매수한다.
 *  1차에서는 카드 효과였으나(가장 많이 물린 종목을 자동 선택), 순수한 매매 행위이므로
 *  주간 행동을 소모하지 않는 종목 상세 화면의 버튼으로 옮겼다. */
export function canAverageDown(state: GameState, stockId: string): { ok: boolean; reason?: string } {
  const h = state.player.holdings.find(x => x.stockId === stockId)
  if (!h) return { ok: false, reason: '보유하지 않은 종목이다' }
  if (priceOf(state, stockId) >= h.avgCost) return { ok: false, reason: '평단보다 싸야 물탈 수 있다' }
  if (maxBuyQty(state, stockId) < 1) return { ok: false, reason: '현금이 부족하다' }
  return { ok: true }
}

export function averageDown(state: GameState, stockId: string, budget: number): GameState {
  if (!canAverageDown(state, stockId).ok) return state
  const capped = Math.min(budget, state.player.cash)
  const qty = maxBuyQty({ ...state, player: { ...state.player, cash: capped } }, stockId)
  if (qty < 1) return state
  return buy(state, stockId, qty)
}
```

- [ ] **Step 4: `effects.ts`에서 `averageDown` case 제거**

`case 'averageDown'` 블록과 `Effect` 유니온의 해당 항목, `BALANCE.averageDownPct`를 지운다.
`default: never` 가드가 있으므로 유니온에서 빼면 컴파일러가 남은 참조를 전부 잡아준다.

- [ ] **Step 5: `cards.json` 수정**

`avgdown` 항목을 삭제하고, `hodl`에 `"isRecovery": true`를 추가한다.

- [ ] **Step 6: 통과 확인 후 커밋**

```bash
pnpm --filter @bb/core test
git add packages/core/src/turn packages/core/data/cards.json
git commit -m "feat: 물타기를 매매 함수로 이관하고 존버를 회복 카드로"
```

---

### Task 3: 카드 등급 — `BALANCE.grade`와 굴림

**Files:**
- Create: `packages/core/src/turn/grade.ts`, `packages/core/src/turn/grade.test.ts`
- Modify: `packages/core/src/balance.ts`, `packages/core/src/types.ts`

**Interfaces:**
- Produces: `type CardGrade = 'E'|'D'|'C'|'B'|'A'|'S'`
- Produces: `GRADES: readonly CardGrade[]`
- Produces: `gradeMul(g: CardGrade): number`, `gradeAp(g: CardGrade): number`
- Produces: `rollGrade(rng: RngState, statValue: number): [CardGrade, RngState]`
- Produces: `cardStat(cardId: string): keyof Stats | null` — 카드가 어느 스탯에 걸리는가

- [ ] **Step 1: 실패하는 테스트**

```ts
// packages/core/src/turn/grade.test.ts
import { describe, it, expect } from 'vitest'
import { GRADES, gradeMul, gradeAp, rollGrade, cardStat } from './grade'
import { createRng } from '../rng/rng'

describe('등급 상수', () => {
  it('E부터 S까지 여섯 단계다', () => {
    expect(GRADES).toEqual(['E', 'D', 'C', 'B', 'A', 'S'])
  })
  it('등급이 오르면 배율이 단조 증가한다', () => {
    const muls = GRADES.map(gradeMul)
    for (let i = 1; i < muls.length; i++) expect(muls[i]!).toBeGreaterThan(muls[i - 1]!)
  })
  it('등급이 오르면 행동력 소모가 줄지 않는다', () => {
    const aps = GRADES.map(gradeAp)
    for (let i = 1; i < aps.length; i++) expect(aps[i]!).toBeGreaterThanOrEqual(aps[i - 1]!)
  })
  it('가장 낮은 등급도 행동력 1 이상을 쓴다', () => {
    expect(gradeAp('E')).toBeGreaterThanOrEqual(1)
  })
})

describe('rollGrade', () => {
  it('같은 rng·같은 스탯이면 같은 등급 (결정론)', () => {
    expect(rollGrade(createRng(7), 3)[0]).toBe(rollGrade(createRng(7), 3)[0])
  })
  it('rng를 소비해 새 상태를 돌려준다', () => {
    const rng = createRng(7)
    const [, next] = rollGrade(rng, 0)
    expect(next.s).not.toBe(rng.s)
  })
  it('스탯 0에서는 상위 등급이 드물다', () => {
    let rng = createRng(1); const counts: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) { const [g, n] = rollGrade(rng, 0); rng = n; counts[g] = (counts[g] ?? 0) + 1 }
    expect((counts['S'] ?? 0) / 2000).toBeLessThan(0.03)
    expect((counts['E'] ?? 0) + (counts['D'] ?? 0)).toBeGreaterThan(1000)
  })
  it('스탯이 높으면 상위 등급 비율이 실제로 올라간다', () => {
    const share = (stat: number) => {
      let rng = createRng(1); let high = 0
      for (let i = 0; i < 2000; i++) { const [g, n] = rollGrade(rng, stat); rng = n; if (g === 'A' || g === 'S') high++ }
      return high / 2000
    }
    expect(share(8)).toBeGreaterThan(share(0) * 3)
  })
})

describe('cardStat', () => {
  it('카드마다 대응 스탯이 정해져 있다', () => {
    expect(cardStat('analyze')).toBe('analysis')
    expect(cardStat('report')).toBe('analysis')
    expect(cardStat('news')).toBe('info')
    expect(cardStat('community')).toBe('info')
    expect(cardStat('study')).toBe('grit')
    expect(cardStat('forum')).toBe('network')
    expect(cardStat('overtime')).toBe('stamina')
  })
  it('회복 카드는 체력에 걸린다', () => {
    for (const id of ['rest', 'exercise', 'drink', 'hodl']) expect(cardStat(id)).toBe('stamina')
  })
  it('모르는 카드는 null이다', () => {
    expect(cardStat('nope')).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test src/turn/grade.test.ts`
Expected: FAIL — `./grade` 모듈 없음.

- [ ] **Step 3: `BALANCE.grade` 추가**

```ts
// balance.ts
/** 카드 등급. 뽑힐 때마다 굴려지며 성장해서 굳는 레벨이 아니다.
 *  mul은 효과와 컨디션 소모에 함께 곱해진다 — 보상이 커지면 소모도 커진다.
 *  weights는 대응 스탯 0일 때의 기본 분포이고, statShift만큼 상위로 질량이 이동한다. */
grade: {
  mul: { E: 0.4, D: 0.7, C: 1.0, B: 1.5, A: 2.2, S: 3.2 },
  ap:  { E: 1,   D: 1,   C: 2,   B: 2,   A: 3,   S: 3 },
  baseWeights: { E: 30, D: 30, C: 22, B: 12, A: 5, S: 1 },
  /** 대응 스탯 1당 상위 등급으로 옮겨가는 가중 계수. */
  statShift: 0.42,
},
```

- [ ] **Step 4: `grade.ts` 구현**

```ts
import type { CardGrade, Stats } from '../types'
import { BALANCE } from '../balance'
import { type RngState, rngNext } from '../rng/rng'

export const GRADES = ['E', 'D', 'C', 'B', 'A', 'S'] as const satisfies readonly CardGrade[]

export const gradeMul = (g: CardGrade) => BALANCE.grade.mul[g]
export const gradeAp = (g: CardGrade) => BALANCE.grade.ap[g]

const CARD_STAT: Record<string, keyof Stats> = {
  analyze: 'analysis', report: 'analysis',
  news: 'info', community: 'info',
  study: 'grit', forum: 'network', overtime: 'stamina',
  rest: 'stamina', exercise: 'stamina', drink: 'stamina', hodl: 'stamina',
}
export function cardStat(cardId: string): keyof Stats | null {
  return CARD_STAT[cardId] ?? null
}

/** 등급을 굴린다. 스탯이 높을수록 상위 등급 가중치가 지수적으로 커진다. */
export function rollGrade(rng: RngState, statValue: number): [CardGrade, RngState] {
  const w = GRADES.map((g, i) =>
    BALANCE.grade.baseWeights[g] * Math.exp(BALANCE.grade.statShift * statValue * (i / (GRADES.length - 1))))
  const total = w.reduce((a, b) => a + b, 0)
  const [r, next] = rngNext(rng)
  let acc = 0
  for (let i = 0; i < GRADES.length; i++) {
    acc += w[i]!
    if (r * total < acc) return [GRADES[i]!, next]
  }
  return [GRADES[GRADES.length - 1]!, next]
}
```

`types.ts`에 `export type CardGrade = 'E'|'D'|'C'|'B'|'A'|'S'`를 추가한다.

- [ ] **Step 5: 통과 확인 후 커밋**

```bash
pnpm --filter @bb/core test
git add packages/core/src/turn/grade.ts packages/core/src/turn/grade.test.ts packages/core/src/balance.ts packages/core/src/types.ts
git commit -m "feat: 카드 등급 E~S와 스탯 연동 굴림"
```

---

### Task 4: 행동력 — `cardsPerTurn` 대체

**Files:**
- Modify: `packages/core/src/balance.ts`, `packages/core/src/turn/advance.ts`, `packages/core/src/turn/cards.ts`
- Test: `packages/core/src/turn/advance.test.ts`

**Interfaces:**
- Produces: `actionPoints(state: GameState): number`
- Produces: `cardApCost(cardId: string, grade: CardGrade): number` — 회복 카드는 0
- `cardsPerTurn`은 **삭제**한다. 남은 참조는 컴파일러가 잡는다.

- [ ] **Step 1: 실패하는 테스트**

```ts
describe('행동력', () => {
  it('체력 0이면 기본값이다', () => {
    expect(actionPoints(makeState({ player: { stats: { stamina: 0 } } }))).toBe(BALANCE.action.base)
  })
  it('체력이 오르면 행동력이 늘어난다', () => {
    const lo = actionPoints(makeState({ player: { stats: { stamina: 0 } } }))
    const hi = actionPoints(makeState({ player: { stats: { stamina: 9 } } }))
    expect(hi).toBeGreaterThan(lo)
  })
  it('퇴사하면 보너스를 받는다', () => {
    const emp = actionPoints(makeState({ player: { employed: true, stats: { stamina: 3 } } }))
    const un  = actionPoints(makeState({ player: { employed: false, stats: { stamina: 3 } } }))
    expect(un - emp).toBe(BALANCE.action.unemployedBonus)
  })
  it('상한을 넘지 않는다', () => {
    expect(actionPoints(makeState({ player: { employed: false, stats: { stamina: 99 } } })))
      .toBeLessThanOrEqual(BALANCE.action.max)
  })
  it('회복 카드는 행동력을 쓰지 않는다', () => {
    for (const id of ['rest', 'exercise', 'drink', 'hodl']) expect(cardApCost(id, 'S')).toBe(0)
  })
  it('행동 카드는 등급을 따라 행동력을 쓴다', () => {
    expect(cardApCost('analyze', 'E')).toBe(gradeAp('E'))
    expect(cardApCost('analyze', 'S')).toBe(gradeAp('S'))
  })
})

describe('advanceTurn 행동력 예산', () => {
  it('예산을 넘는 조합은 거부된다', () => {
    const s = makeState({ player: { stats: { stamina: 0 } } })
    // base=2인 상태에서 ⚡3짜리를 넣으면 초과
    expect(() => advanceTurn({ ...s, slots: slotsWith('analyze', 'S') }, ['analyze'])).toThrow(/NO_AP/)
  })
  it('회복 카드는 예산과 무관하게 항상 쓸 수 있다', () => {
    const s = makeState({ player: { stats: { stamina: 0 }, mental: 5 } })
    expect(() => advanceTurn({ ...s, slots: slotsWith('rest', 'C') }, ['rest'])).not.toThrow()
  })
})
```

`slotsWith`는 Task 5에서 만들 `testkit` 헬퍼다. Task 5 완료 후 이 두 테스트를 활성화한다.

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test src/turn/advance.test.ts`
Expected: FAIL — `actionPoints`/`cardApCost` 미정의.

- [ ] **Step 3: `BALANCE.action` 추가**

```ts
/** 턴당 행동력. 1차의 cardsPerTurn(재직 1장/퇴사 2장)을 대체한다.
 *  퇴사가 카드 장수가 아니라 예산 보너스가 되는 편이 의미상 맞다 — 야근을 안 하니
 *  한 주가 통째로 남는다. 회복 카드는 이 예산을 소모하지 않는다(교착 방지). */
action: { base: 2, staminaPerAp: 3, unemployedBonus: 2, max: 6 },
```

- [ ] **Step 4: `cards.ts`에 구현**

```ts
export function actionPoints(state: GameState): number {
  const a = BALANCE.action
  const raw = a.base + Math.floor(state.player.stats.stamina / a.staminaPerAp)
    + (state.player.employed ? 0 : a.unemployedBonus)
  return Math.min(a.max, raw)
}

export function cardApCost(cardId: string, grade: CardGrade): number {
  const card = loadCards().find(c => c.id === cardId)
  return card?.isRecovery ? 0 : gradeAp(grade)
}
```

- [ ] **Step 5: `advance.ts`에서 `cardsPerTurn` 검사를 예산 검사로 교체**

```ts
// 기존: if (cardIds.length > cardsPerTurn(state)) throw new GameError('TOO_MANY_CARDS')
const budget = actionPoints(state)
const spent = cardIds.reduce((sum, id) => sum + cardApCost(id, gradeOfSlot(state, id)), 0)
if (spent > budget) throw new GameError('NO_AP')
```

`cardsPerTurn`을 export에서 제거한다. app이 쓰고 있으므로 Task 12에서 함께 고친다.

- [ ] **Step 6: 통과 확인 후 커밋**

```bash
pnpm --filter @bb/core test
git add packages/core/src/turn packages/core/src/balance.ts
git commit -m "feat: 행동력 예산으로 cardsPerTurn 대체"
```

---

### Task 5: 슬롯 뽑기와 리롤

**Files:**
- Create: `packages/core/src/turn/slots.ts`, `packages/core/src/turn/slots.test.ts`
- Modify: `packages/core/src/types.ts`, `packages/core/src/balance.ts`, `packages/core/src/testkit.ts`

**Interfaces:**
- Produces: `interface SlotCard { cardId: string; grade: CardGrade }`
- Produces: `interface TurnSlots { action: SlotCard[]; recovery: SlotCard }`
- Produces: `drawSlots(state: GameState): [TurnSlots, RngState]`
- Produces: `rerollSlots(state: GameState): GameState` — 행동 슬롯만 다시 굴리고 `rerollsLeft`를 1 줄인다
- Produces: `rerollCount(state: GameState): number`
- Produces: `gradeOfSlot(state: GameState, cardId: string): CardGrade` — 슬롯에서 해당 카드의 등급을 찾는다.
  행동 슬롯과 회복 슬롯을 모두 뒤지고, 없으면 `GameError('NOT_IN_SLOTS')`를 던진다.
- Produces: testkit `slotsWith(cardId: string, grade: CardGrade): TurnSlots`
- `GameState`에 `slots: TurnSlots`와 `rerollsLeft: number`가 추가된다.

- [ ] **Step 1: 실패하는 테스트**

```ts
// packages/core/src/turn/slots.test.ts
describe('drawSlots', () => {
  it('행동 3칸 · 회복 1칸을 만든다', () => {
    const [slots] = drawSlots(makeState({}))
    expect(slots.action).toHaveLength(BALANCE.slots.action)
    expect(slots.recovery).toBeDefined()
  })
  it('행동 슬롯에 회복 카드가 섞이지 않는다', () => {
    const [slots] = drawSlots(makeState({}))
    for (const s of slots.action) expect(loadCards().find(c => c.id === s.cardId)!.isRecovery).toBe(false)
  })
  it('회복 슬롯은 반드시 회복 카드다', () => {
    const [slots] = drawSlots(makeState({}))
    expect(loadCards().find(c => c.id === slots.recovery.cardId)!.isRecovery).toBe(true)
  })
  it('행동 슬롯에 같은 카드가 중복되지 않는다', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const [slots] = drawSlots(makeState({ rng: createRng(seed) }))
      expect(new Set(slots.action.map(s => s.cardId)).size).toBe(slots.action.length)
    }
  })
  it('같은 시드는 같은 슬롯을 만든다 (결정론)', () => {
    const a = drawSlots(makeState({ rng: createRng(9) }))[0]
    const b = drawSlots(makeState({ rng: createRng(9) }))[0]
    expect(a).toEqual(b)
  })
  it('다른 시드는 다른 슬롯을 만든다', () => {
    const a = drawSlots(makeState({ rng: createRng(1) }))[0]
    const b = drawSlots(makeState({ rng: createRng(2) }))[0]
    expect(a).not.toEqual(b)
  })
})

describe('리롤', () => {
  it('인맥 0에서도 기본 횟수가 있다', () => {
    expect(rerollCount(makeState({ player: { stats: { network: 0 } } }))).toBe(BALANCE.reroll.base)
  })
  it('인맥이 오르면 횟수가 늘어난다', () => {
    const lo = rerollCount(makeState({ player: { stats: { network: 0 } } }))
    const hi = rerollCount(makeState({ player: { stats: { network: 9 } } }))
    expect(hi).toBeGreaterThan(lo)
  })
  it('행동 슬롯만 바뀌고 회복 슬롯은 그대로다', () => {
    const s = { ...makeState({ rng: createRng(3) }), rerollsLeft: 2 }
    const after = rerollSlots(s)
    expect(after.slots.recovery).toEqual(s.slots.recovery)
    expect(after.slots.action).not.toEqual(s.slots.action)
  })
  it('남은 횟수가 1 줄어든다', () => {
    const s = { ...makeState({}), rerollsLeft: 2 }
    expect(rerollSlots(s).rerollsLeft).toBe(1)
  })
  it('남은 횟수가 0이면 아무 일도 일어나지 않는다', () => {
    const s = { ...makeState({}), rerollsLeft: 0 }
    expect(rerollSlots(s)).toEqual(s)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test src/turn/slots.test.ts`
Expected: FAIL — `./slots` 모듈 없음.

- [ ] **Step 3: `BALANCE`에 `slots`·`reroll` 추가**

```ts
slots: { action: 3, recovery: 1 },
/** 리롤은 행동 슬롯만 다시 굴린다. base가 없으면 인맥 0인 초반에 리롤이 아예 없어
 *  슬롯 뽑기의 운을 완화할 수단이 사라진다. */
reroll: { base: 1, networkPer: 3, max: 4 },
```

- [ ] **Step 4: `slots.ts` 구현**

```ts
import type { GameState, CardGrade, TurnSlots, SlotCard } from '../types'
import { BALANCE } from '../balance'
import { loadCards } from './cards'
import { rollGrade, cardStat } from './grade'
import { type RngState, Rand } from '../rng/rng'

function draw(pool: { id: string }[], n: number, state: GameState, rng: RngState): [SlotCard[], RngState] {
  const rand = new Rand(rng)
  const remaining = [...pool]
  const out: SlotCard[] = []
  for (let i = 0; i < n && remaining.length > 0; i++) {
    const pick = remaining.splice(rand.int(0, remaining.length - 1), 1)[0]!
    const stat = cardStat(pick.id)
    const [grade, next] = rollGrade(rand.state, stat ? state.player.stats[stat] : 0)
    rand.state = next
    out.push({ cardId: pick.id, grade })
  }
  return [out, rand.state]
}

export function drawSlots(state: GameState): [TurnSlots, RngState] {
  const cards = loadCards()
  const [action, r1] = draw(cards.filter(c => !c.isRecovery), BALANCE.slots.action, state, state.rng)
  const [recovery, r2] = draw(cards.filter(c => c.isRecovery), BALANCE.slots.recovery, state, r1)
  return [{ action, recovery: recovery[0]! }, r2]
}

export function rerollCount(state: GameState): number {
  const r = BALANCE.reroll
  return Math.min(r.max, r.base + Math.floor(state.player.stats.network / r.networkPer))
}

export function rerollSlots(state: GameState): GameState {
  if (state.rerollsLeft <= 0) return state
  const cards = loadCards().filter(c => !c.isRecovery)
  const [action, rng] = draw(cards, BALANCE.slots.action, state, state.rng)
  return { ...state, slots: { ...state.slots, action }, rng, rerollsLeft: state.rerollsLeft - 1 }
}
```

`Rand`에 가변 `state` 접근자가 없으면 추가한다(`rng/rng.ts`).

- [ ] **Step 5: `testkit.ts`에 `slotsWith` 추가**

```ts
export const slotsWith = (cardId: string, grade: CardGrade): TurnSlots => ({
  action: [{ cardId, grade }],
  recovery: { cardId: 'rest', grade: 'C' },
})
```

- [ ] **Step 6: 통과 확인 후 커밋**

```bash
pnpm --filter @bb/core test
git add packages/core/src/turn/slots.ts packages/core/src/turn/slots.test.ts packages/core/src/balance.ts packages/core/src/types.ts packages/core/src/testkit.ts
git commit -m "feat: 행동 슬롯 뽑기와 리롤"
```

---

### Task 6: 턴 루프 통합 — 슬롯 생성 단계와 등급 효과

**Files:**
- Modify: `packages/core/src/turn/advance.ts`, `packages/core/src/turn/cards.ts`, `packages/core/src/turn/effects.ts`
- Test: `packages/core/src/turn/advance.test.ts`

**Interfaces:**
- Consumes: `drawSlots`, `rerollCount`, `actionPoints`, `cardApCost`, `gradeMul`
- `playCard(state, cardId)` → `playCard(state, cardId, grade)`로 시그니처가 바뀐다. 효과에 `gradeMul(grade)`가 곱해진다.
- `initGame`이 첫 턴 슬롯을 만든다. `advanceTurn`은 턴이 끝날 때 다음 턴 슬롯을 만든다.

- [ ] **Step 1: 실패하는 테스트**

```ts
describe('턴 루프와 슬롯', () => {
  it('initGame이 첫 턴 슬롯을 준비한다', () => {
    const s = initGame(1)
    expect(s.slots.action).toHaveLength(BALANCE.slots.action)
    expect(s.rerollsLeft).toBe(rerollCount(s))
  })
  it('턴을 넘기면 슬롯이 새로 뽑힌다', () => {
    const s = initGame(1)
    const after = advanceTurn(s, [])
    expect(after.slots).not.toEqual(s.slots)
  })
  it('턴을 넘기면 리롤 횟수가 리셋된다', () => {
    const s = { ...initGame(1), rerollsLeft: 0 }
    expect(advanceTurn(s, []).rerollsLeft).toBe(rerollCount(s))
  })
  it('슬롯에 없는 카드는 쓸 수 없다', () => {
    const s = initGame(1)
    const notInSlots = loadCards().map(c => c.id)
      .find(id => !s.slots.action.some(a => a.cardId === id) && s.slots.recovery.cardId !== id)!
    expect(() => advanceTurn(s, [notInSlots])).toThrow(/NOT_IN_SLOTS/)
  })
  it('등급이 효과 크기를 바꾼다', () => {
    const base = makeState({ slots: slotsWith('analyze', 'C'), player: { stats: { stamina: 9 } } })
    const high = makeState({ slots: slotsWith('analyze', 'A'), player: { stats: { stamina: 9 } } })
    const gainC = advanceTurn(base, ['analyze']).player.stats.analysis - base.player.stats.analysis
    const gainA = advanceTurn(high, ['analyze']).player.stats.analysis - high.player.stats.analysis
    expect(gainA).toBeGreaterThan(gainC * 1.5)
  })
  it('등급이 컨디션 소모도 함께 키운다', () => {
    const base = makeState({ slots: slotsWith('analyze', 'C'), player: { stats: { stamina: 9 }, condition: 100 } })
    const high = makeState({ slots: slotsWith('analyze', 'A'), player: { stats: { stamina: 9 }, condition: 100 } })
    const dropC = 100 - advanceTurn(base, ['analyze']).player.condition
    const dropA = 100 - advanceTurn(high, ['analyze']).player.condition
    expect(dropA).toBeGreaterThan(dropC)
  })
  it('156턴을 완주한다 (회귀)', () => {
    let s = initGame(3)
    for (let i = 0; i < 156; i++) s = advanceTurn({ ...s, pendingChoices: [] }, [])
    expect(s.status).toBe('ended')
  })
  it('같은 시드는 같은 156턴을 만든다 (결정론)', () => {
    const play = (seed: number) => {
      let s = initGame(seed)
      for (let i = 0; i < 156; i++) s = advanceTurn({ ...s, pendingChoices: [] }, [])
      return s
    }
    expect(JSON.stringify(play(11))).toBe(JSON.stringify(play(11)))
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `pnpm --filter @bb/core test src/turn/advance.test.ts`
Expected: FAIL — `initGame`이 슬롯을 만들지 않는다.

- [ ] **Step 3: `playCard`에 등급을 받게 하고 효과에 배율 적용**

```ts
export function playCard(state: GameState, cardId: string, grade: CardGrade): GameState {
  const card = loadCards().find(c => c.id === cardId)
  if (!card) throw new GameError('NO_CARD')
  if (!isCardAvailable(state, card)) throw new GameError('CARD_LOCKED')
  return applyEffects(state, card.effects, gradeMul(grade))
}
```

`applyEffects(state, effects, mul = 1)`로 확장하고, `stat`/`mental`/`condition`/`cash` delta에 `mul`을 곱한다.
`cash` 음수 비용(최존버와 소주 −40,000)도 함께 커진다 — 보상이 커지면 대가도 커진다는 규칙에 맞는다.

- [ ] **Step 4: `advance.ts`에 슬롯 단계 추가**

`initGame` 끝에서 `drawSlots`를 호출해 `slots`·`rerollsLeft`를 채운다.
`advanceTurn`은 (a) 시작에서 카드가 슬롯 안에 있는지 검사하고(`NOT_IN_SLOTS`),
(b) 카드 재생 시 슬롯의 등급을 넘기고, (c) 턴 종료 직전에 다음 턴 슬롯을 뽑고 `rerollsLeft`를 리셋한다.

**슬롯 생성은 게이지 정산(6단계) 이후, 종료 판정(9단계) 이전**에 둔다. 종료된 턴에는 새 슬롯을 만들지 않는다.

- [ ] **Step 5: 통과 확인 후 커밋**

```bash
pnpm --filter @bb/core test
git add packages/core/src/turn
git commit -m "feat: 턴 루프에 슬롯 생성과 등급 효과 통합"
```

---

### Task 7: 트래커 확장 — 수수료·최고자산·최대낙폭·거래횟수

**Files:**
- Modify: `packages/core/src/types.ts`, `packages/core/src/turn/trade.ts`, `packages/core/src/turn/advance.ts`
- Test: `packages/core/src/turn/accounting.test.ts`

**Interfaces:**
- `Trackers`에 `feesPaid: number`, `taxPaid: number`, `peakAssets: number`, `maxDrawdownPct: number`, `tradeCount: number` 추가.

- [ ] **Step 1: 실패하는 테스트**

```ts
describe('거래 트래커', () => {
  it('매수하면 수수료가 누적되고 거래 횟수가 1 늘어난다', () => {
    const s = makeState({ stocks: [makeStock({ id: 'sjc', price: 10000 })], player: { cash: 1_000_000 } })
    const after = buy(s, 'sjc', 10)
    expect(after.trackers.feesPaid).toBeGreaterThan(0)
    expect(after.trackers.tradeCount).toBe(1)
  })
  it('매도하면 수수료와 세금이 둘 다 누적된다', () => {
    const s = makeState({
      stocks: [makeStock({ id: 'sjc', price: 10000 })],
      player: { cash: 0, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 9000, heldTurns: 2 }] },
    })
    const after = sell(s, 'sjc', 10)
    expect(after.trackers.feesPaid).toBeGreaterThan(0)
    expect(after.trackers.taxPaid).toBeGreaterThan(0)
  })
  it('최고 자산이 갱신되고 내려가지 않는다', () => {
    let s = makeState({ player: { cash: 1_000_000 } })
    s = advanceTurn(s, [])
    const peak = s.trackers.peakAssets
    s = { ...s, player: { ...s.player, cash: 1 } }
    s = advanceTurn(s, [])
    expect(s.trackers.peakAssets).toBe(peak)
  })
  it('최대 낙폭이 기록된다', () => {
    let s = makeState({ player: { cash: 10_000_000 } })
    s = advanceTurn(s, [])
    s = advanceTurn({ ...s, player: { ...s.player, cash: 5_000_000 } }, [])
    expect(s.trackers.maxDrawdownPct).toBeGreaterThan(30)
  })
})
```

- [ ] **Step 2: 실패 확인 → Step 3: `buy`/`sell`에서 트래커 누적 → Step 4: `advanceTurn` 8단계에서 peak·drawdown 갱신 → Step 5: 통과 확인**

```ts
// advance.ts 8단계
const assets = totalAssets(s)
const peak = Math.max(s.trackers.peakAssets, assets)
const dd = peak > 0 ? ((peak - assets) / peak) * 100 : 0
s = { ...s, trackers: { ...s.trackers, peakAssets: peak, maxDrawdownPct: Math.max(s.trackers.maxDrawdownPct, dd) } }
```

- [ ] **Step 6: 커밋**

```bash
git commit -am "feat: 수수료·세금·최고자산·최대낙폭·거래횟수 트래커"
```

---

### Task 8: 밸런스 재조정 — sim 갱신과 게이트

**Files:**
- Modify: `packages/sim/src/strategies.ts`, `packages/sim/src/runner.ts`, `packages/sim/src/cli.ts`, `packages/sim/src/balance.test.ts`
- Modify: `packages/core/src/balance.ts` (튜닝 결과)

**Interfaces:**
- `act()`가 슬롯에서 카드를 고르도록 바뀐다. 전략별로 "행동력을 어떻게 쓰는가"가 생긴다.
- `BatchReport`에 `avgApSpent`, `avgGradeIdx`, `rerollUse` 추가.

- [ ] **Step 1: 전략을 슬롯 구조에 맞게 고친다**

각 전략은 이제 `state.slots.action` 중 무엇을 고를지 정한다. 예산을 넘기지 않도록 `actionPoints`로 필터한다.
회복 슬롯은 멘탈/컨디션이 임계 아래일 때 집는다.

- [ ] **Step 2: 기존 게이트 14개가 여전히 도는지 확인**

Run: `pnpm --filter @bb/sim test`
Expected: 일부 FAIL — 성장 속도가 바뀌었으므로 자산 분포가 이동한다. **게이트를 낮추지 말고 `BALANCE`를 튜닝한다.**

- [ ] **Step 3: 새 게이트 3개 추가**

```ts
it('행동력이 대부분의 턴에서 실제로 소모된다', () => {
  // 예산이 남아도는 설계는 선택을 만들지 못한다
  expect(runBatch(200, 'buyhold').avgApSpent).toBeGreaterThan(BALANCE.action.base * 0.6)
})
it('등급 분포가 후반에 상위로 이동한다', () => {
  // 스탯이 등급 확률을 민다는 설계가 실제 플레이에서 성립하는가
  const r = runBatch(200, 'buyhold')
  expect(r.avgGradeIdxLate).toBeGreaterThan(r.avgGradeIdxEarly + 0.5)
})
it('회복 슬롯이 멘탈 교착을 막는다', () => {
  // 흔들림에 들어간 판이 전부 흔들림으로 끝나지 않는다
  expect(runBatch(300, 'panic').stuckInShakenRate).toBeLessThan(0.2)
})
```

- [ ] **Step 4: `BALANCE` 튜닝 — 측정하며 반복한다**

`pnpm --filter @bb/sim start -- --runs 2000 --strategy <전략>`으로 6전략을 반복 측정한다.
기존 게이트(시장 배율 중앙값 > 1, `panic < buyhold`, 엔딩 유형 ≥ 4 등)를 **전부 통과시킨 뒤** 커밋한다.

- [ ] **Step 5: 커밋**

```bash
git commit -am "feat: 슬롯·행동력에 맞춰 sim 전략과 밸런스 게이트 재조정"
```

---

### Task 9: 디자인 토큰과 모션 기반

**Files:**
- Create: `packages/app/src/design/tokens.css`, `packages/app/src/design/motion.ts`, `packages/app/src/design/motion.test.ts`
- Modify: `packages/app/index.html`, `packages/app/src/index.css`

**Interfaces:**
- Produces: CSS 커스텀 프로퍼티 — 색(`--bg`, `--surface`, `--up`, `--down`, `--neutral`, 등급색 6종), 간격 8단계, 타이포 6단계, 모션 3단계(`--dur-fast/base/slow`)
- Produces: `useCountUp(value: number): number` — 숫자 롤업 훅, reduced-motion이면 즉시 반환
- Produces: `useTypewriter(text: string): { shown: string; done: boolean; skip(): void }`

- [ ] **Step 1: 폰트를 실제로 로드한다**

지금 `index.css`가 `font-family: 'Pretendard', ...`를 선언하지만 `@font-face`도 `<link>`도 없어 조용히 시스템 폰트로 떨어진다. `index.html`에 Pretendard를 추가한다(CDN 또는 self-host).

- [ ] **Step 2: 실패하는 테스트**

```ts
describe('useCountUp', () => {
  it('reduced-motion이면 즉시 목표값이다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const { result } = renderHook(() => useCountUp(1000))
    expect(result.current).toBe(1000)
  })
  it('애니메이션 중에는 목표값보다 작다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', false)
    const { result } = renderHook(() => useCountUp(1000))
    expect(result.current).toBeLessThan(1000)
  })
})

describe('useTypewriter', () => {
  it('처음에는 일부만 보인다', () => {
    const { result } = renderHook(() => useTypewriter('안녕하세요 반갑습니다'))
    expect(result.current.shown.length).toBeLessThan('안녕하세요 반갑습니다'.length)
    expect(result.current.done).toBe(false)
  })
  it('skip하면 즉시 전문이 보인다', () => {
    const { result } = renderHook(() => useTypewriter('안녕하세요'))
    act(() => result.current.skip())
    expect(result.current.shown).toBe('안녕하세요')
    expect(result.current.done).toBe(true)
  })
  it('reduced-motion이면 처음부터 전문이다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const { result } = renderHook(() => useTypewriter('안녕하세요'))
    expect(result.current.done).toBe(true)
  })
})
```

- [ ] **Step 3~5: 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 디자인 토큰·폰트 로딩·모션 기반(reduced-motion 존중)"
```

---

### Task 10: 아트 슬롯 — 2레이어와 미니멀 폴백

**Files:**
- Create: `packages/app/src/art/slots.tsx`, `packages/app/src/art/slots.test.tsx`
- Modify: `packages/app/src/art/keys.ts`, `packages/app/src/art/registry.tsx`

**Interfaces:**
- Produces: `<ArtSlot kind="character" | "portrait" | "background" | "scene" id={ArtKey} />`
- Produces: `hasImage(id: ArtKey): boolean`
- `ArtKey`에 `bg.{office,home,street,exchange}`, `npc.*.{normal,alt}` 추가.

**슬롯의 제1 요건: 이미지가 없어도 완결된 화면으로 보인다.** 실루엣 + 그라디언트 + 타이포그래피로 채우고, 이미지가 하나씩 들어올 때마다 좋아진다.

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('ArtSlot', () => {
  it('이미지가 없으면 폴백을 그리되 빈칸이 아니다', () => {
    const { container } = render(<ArtSlot kind="character" id="char.tier0.normal" />)
    const el = container.firstElementChild!
    expect(el.getAttribute('data-fallback')).toBe('true')
    expect(el.querySelectorAll('svg, [class*=silhouette]').length).toBeGreaterThan(0)
  })
  it('이미지가 등록되면 img를 그린다', () => {
    registerImage('char.tier0.normal', '/art/c0.webp')
    const { container } = render(<ArtSlot kind="character" id="char.tier0.normal" />)
    expect(container.querySelector('img')).not.toBeNull()
  })
  it('종횡비가 슬롯 종류로 고정된다', () => {
    const { container } = render(<ArtSlot kind="background" id="bg.office" />)
    expect(getComputedStyle(container.firstElementChild!).aspectRatio).toBe('16 / 9')
  })
  it('alt가 한국어 설명이고 키 문자열이 아니다', () => {
    registerImage('npc.kim.normal', '/art/kim.webp')
    render(<ArtSlot kind="portrait" id="npc.kim.normal" />)
    const alt = screen.getByRole('img').getAttribute('alt')!
    expect(alt).not.toContain('npc.')
    expect(alt).toMatch(/[가-힣]/)
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 2레이어 아트 슬롯과 미니멀 폴백"
```

---

### Task 11: 상단바 · 진행바 · 캐릭터 스테이지

**Files:**
- Create: `packages/app/src/components/TopBar.tsx`, `CharacterStage.tsx` + 각 테스트
- Modify: `packages/app/src/screens/HomeScreen.tsx`

**Interfaces:**
- Produces: `<TopBar />` — 메뉴 / 연차·주차·D-day / 총자산 / 정보
- Produces: `<CharacterStage />` — 배경 레이어 + 인물 레이어 + 티어·수익률 배지, 260px

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('TopBar', () => {
  it('연차·주차와 남은 주를 보여준다', () => {
    renderWithState({ turn: 66 })
    expect(screen.getByTestId('topbar-date')).toHaveTextContent('2년차 14주')
    expect(screen.getByTestId('topbar-date')).toHaveTextContent('D-90')
  })
  it('총자산을 원 단위로 보여준다', () => {
    renderWithState({ player: { cash: 35_450_000 } })
    expect(screen.getByTestId('topbar-assets')).toHaveTextContent('35,450,000원')
  })
})

describe('CharacterStage', () => {
  it('티어에 맞는 캐릭터 슬롯을 그린다', () => {
    renderWithState({ player: { tier: 3 } })
    expect(screen.getByTestId('char-slot')).toHaveAttribute('data-art-id', 'char.tier3.normal')
  })
  it('흔들림이면 shaken 표정으로 바뀐다', () => {
    renderWithState({ player: { tier: 1, mental: 12 } })
    expect(screen.getByTestId('char-slot')).toHaveAttribute('data-art-id', 'char.tier1.shaken')
  })
  it('높이가 260px로 고정된다', () => {
    renderWithState({})
    expect(getComputedStyle(screen.getByTestId('char-stage')).height).toBe('260px')
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 상단바와 캐릭터 스테이지"
```

---

### Task 12: 스탯 칩 · 게이지 · 행동력 · 리롤

**Files:**
- Create: `packages/app/src/components/StatChips.tsx`, `ActionMeter.tsx` + 테스트
- Modify: `packages/app/src/components/Hud.tsx` (게이지만 남긴다), `packages/app/src/store/store.ts` (`doReroll` 추가)

**Interfaces:**
- Produces: `<StatChips />` — 5종, 스탯마다 고정 색, 증가 시 플래시
- Produces: `<ActionMeter />` — 남은 행동력 점과 리롤 버튼
- store에 `doReroll()` 추가.

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('StatChips', () => {
  it('다섯 스탯을 전부 보여준다', () => {
    renderWithState({})
    for (const k of ['grit', 'stamina', 'info', 'analysis', 'network'])
      expect(screen.getByTestId(`stat-${k}`)).toBeInTheDocument()
  })
  it('스탯마다 색이 다르다', () => {
    renderWithState({})
    const colors = ['grit','stamina','info','analysis','network']
      .map(k => getComputedStyle(screen.getByTestId(`stat-${k}`)).getPropertyValue('--chip'))
    expect(new Set(colors).size).toBe(5)
  })
})

describe('ActionMeter', () => {
  it('남은 행동력을 점으로 보여준다', () => {
    renderWithState({ player: { stats: { stamina: 3 } } })
    expect(screen.getAllByTestId('ap-dot')).toHaveLength(actionPoints(currentState()))
  })
  it('카드를 고르면 점이 꺼진다', () => {
    renderWithState({})
    fireEvent.click(screen.getAllByTestId(/^slot-card-/)[0]!)
    expect(screen.getAllByTestId('ap-dot-spent').length).toBeGreaterThan(0)
  })
  it('리롤 횟수가 0이면 버튼이 비활성이다', () => {
    renderWithState({ rerollsLeft: 0 })
    expect(screen.getByTestId('reroll')).toBeDisabled()
  })
  it('리롤하면 행동 슬롯이 바뀐다', () => {
    renderWithState({ rerollsLeft: 2 })
    const before = screen.getAllByTestId(/^slot-card-/).map(e => e.getAttribute('data-card-id'))
    fireEvent.click(screen.getByTestId('reroll'))
    const after = screen.getAllByTestId(/^slot-card-/).map(e => e.getAttribute('data-card-id'))
    expect(after).not.toEqual(before)
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 스탯 칩·행동력 미터·리롤"
```

---

### Task 13: 슬롯 카드 2×2

**Files:**
- Create: `packages/app/src/components/CardTile.tsx` + 테스트
- Modify: `packages/app/src/components/CardGrid.tsx` → 2×2 그리드로 재작성

**Interfaces:**
- Produces: `<CardTile slot={SlotCard} selected onPick />` — 타입 `SlotCard`(core)와 이름이 겹치지 않도록 컴포넌트는 `CardTile`이다 — 등급 배지, 효과 요약, 행동력·컨디션 비용

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('CardTile', () => {
  it('등급 배지를 보여준다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
    expect(screen.getByTestId('grade-badge')).toHaveTextContent('A')
  })
  it('등급마다 배지 색이 다르다', () => {
    const color = (g: CardGrade) => {
      const { container } = render(<CardTile slot={{ cardId: 'analyze', grade: g }} />)
      return getComputedStyle(container.querySelector('[data-testid=grade-badge]')!).backgroundColor
    }
    expect(new Set(['E','D','C','B','A','S'].map(g => color(g as CardGrade))).size).toBe(6)
  })
  it('효과가 등급 배율이 반영된 값으로 보인다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
    // 기본 analysis +0.5 × gradeMul('A')=2.2 → +1.1
    expect(screen.getByTestId('effect-summary')).toHaveTextContent('+1.1')
  })
  it('회복 카드는 행동력 0으로 표시된다', () => {
    render(<CardTile slot={{ cardId: 'rest', grade: 'C' }} />)
    expect(screen.getByTestId('ap-cost')).toHaveTextContent('0')
  })
  it('행동력이 모자라면 비활성이고 사유가 보인다', () => {
    renderWithState({ player: { stats: { stamina: 0 } } })  // base 2
    const card = screen.getByTestId('slot-card-analyze')     // ⚡3짜리
    expect(card).toBeDisabled()
    expect(card).toHaveTextContent('행동력이 부족하다')
  })
  it('잠긴 카드는 사유가 보인다 (흔들림 시 이성 카드)', () => {
    renderWithState({ player: { mental: 12 } })
    expect(screen.getByTestId('slot-card-analyze')).toHaveTextContent('흔들려서')
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 등급 배지가 붙은 슬롯 카드 2x2"
```

---

### Task 14: 뉴스 티커와 시트

**Files:**
- Create: `packages/app/src/components/NewsTicker.tsx` + 테스트
- Delete: `packages/app/src/components/NewsFeed.tsx`

**Interfaces:**
- Produces: `<NewsTicker />` — 한 줄, 탭하면 최근 8건 시트

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('NewsTicker', () => {
  it('가장 최근 뉴스 한 건만 한 줄로 보여준다', () => {
    renderWithState({ news: ['첫 소식', '둘째 소식', '셋째 소식'] })
    expect(screen.getByTestId('ticker-line')).toHaveTextContent('셋째 소식')
    expect(screen.queryByText('첫 소식')).toBeNull()
  })
  it('뉴스가 없으면 안내 문구가 나온다', () => {
    renderWithState({ news: [] })
    expect(screen.getByTestId('ticker-line')).toHaveTextContent('아직 아무 소식도 없다')
  })
  it('탭하면 최근 8건이 시트로 열린다', () => {
    renderWithState({ news: Array.from({ length: 20 }, (_, i) => `소식 ${i}`) })
    fireEvent.click(screen.getByTestId('ticker-line'))
    expect(screen.getAllByTestId(/^news-item-/)).toHaveLength(8)
  })
  it('루머는 다른 색으로 표시된다', () => {
    renderWithState({ news: ['[루머] 뭔가 돈다'] })
    expect(screen.getByTestId('ticker-line')).toHaveAttribute('data-rumor', 'true')
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 뉴스 티커와 시트"
```

---

### Task 15: 시세 화면과 종목 상세 — 물타기 버튼

**Files:**
- Modify: `packages/app/src/screens/MarketScreen.tsx`, `StockDetail.tsx`
- Modify: `packages/app/src/store/store.ts` (`doAverageDown` 추가)

**Interfaces:**
- store에 `doAverageDown(stockId: string, budget: number)` 추가.
- 시세 카드에 스파크라인 추가.

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('물타기 버튼', () => {
  it('보유하지 않은 종목에는 버튼이 없다', () => {
    renderDetail({ stockId: 'sjc', holdings: [] })
    expect(screen.queryByTestId('average-down')).toBeNull()
  })
  it('평단보다 비싸면 비활성이고 사유가 보인다', () => {
    renderDetail({ stockId: 'sjc', price: 12000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }] })
    expect(screen.getByTestId('average-down')).toBeDisabled()
    expect(screen.getByTestId('average-down-reason')).toHaveTextContent('평단보다 싸야')
  })
  it('물타기 후 평단이 실제로 내려간다', () => {
    renderDetail({ stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }] })
    const before = Number(screen.getByTestId('avg-cost').getAttribute('data-value'))
    fireEvent.click(screen.getByTestId('average-down'))
    expect(Number(screen.getByTestId('avg-cost').getAttribute('data-value'))).toBeLessThan(before)
  })
  it('물타기는 행동력을 소모하지 않는다', () => {
    renderDetail({ stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }] })
    const before = currentState().rerollsLeft
    fireEvent.click(screen.getByTestId('average-down'))
    expect(currentState().turn).toBe(1)          // 턴이 넘어가지 않는다
    expect(currentState().rerollsLeft).toBe(before)
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 종목 상세 물타기 버튼과 시세 스파크라인"
```

---

### Task 16: 계좌와 도감

**Files:**
- Modify: `packages/app/src/screens/AccountScreen.tsx`, `CodexScreen.tsx`

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('AccountScreen', () => {
  it('보유 종목마다 평단·수익률·비중을 보여준다', () => {
    renderWithState({ player: { holdings: [{ stockId: 'sjc', qty: 10, avgCost: 9000, heldTurns: 4 }] } })
    const row = screen.getByTestId('holding-sjc')
    expect(row).toHaveTextContent('9,000원')
    expect(row.querySelector('[data-testid=roi]')).not.toBeNull()
    expect(row.querySelector('[data-testid=weight]')).not.toBeNull()
  })
  it('누적 수수료·세금을 보여준다', () => {
    renderWithState({ trackers: { feesPaid: 12000, taxPaid: 34000 } })
    expect(screen.getByTestId('cost-total')).toHaveTextContent('46,000원')
  })
})

describe('CodexScreen', () => {
  it('미수집 엔딩은 ???로 가려진다', () => {
    renderWithCodex({ endings: ['bank'] })
    expect(screen.getAllByText('???').length).toBe(7)
  })
  it('수집한 엔딩은 이름이 보인다', () => {
    renderWithCodex({ endings: ['bank'] })
    expect(screen.getByTestId('codex-ending-bank')).toHaveTextContent('은행 이자보단 낫지')
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 계좌·도감 화면 재구성"
```

---

### Task 17: 대화창 — 타이핑·이름표·로그

**Files:**
- Create: `packages/app/src/overlays/DialogueBox.tsx` + 테스트

**Interfaces:**
- Produces: `<DialogueBox speaker={string | null} text={string} onAdvance />`
- 화자가 `null`이면 이름표를 그리지 않는다. 정체 미상은 `'???'`을 넘긴다.

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('DialogueBox', () => {
  it('대사가 타이핑되어 나타난다', () => {
    render(<DialogueBox speaker="김실장" text="형님, 이번 건은 확실합니다." />)
    expect(screen.getByTestId('dialogue-text').textContent!.length)
      .toBeLessThan('형님, 이번 건은 확실합니다.'.length)
  })
  it('탭하면 즉시 전문이 보인다', () => {
    render(<DialogueBox speaker="김실장" text="형님, 이번 건은 확실합니다." />)
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(screen.getByTestId('dialogue-text')).toHaveTextContent('형님, 이번 건은 확실합니다.')
  })
  it('이름표에 화자가 보인다', () => {
    render(<DialogueBox speaker="최존버" text="형은 15년째 그거 하나만 들고 있다." />)
    expect(screen.getByTestId('speaker-tag')).toHaveTextContent('최존버')
  })
  it('화자별로 이름표 색이 다르다', () => {
    const bg = (s: string) => {
      const { container } = render(<DialogueBox speaker={s} text="x" />)
      return getComputedStyle(container.querySelector('[data-testid=speaker-tag]')!).backgroundColor
    }
    expect(new Set(['박대박','최존버','김실장','엄마'].map(bg)).size).toBe(4)
  })
  it('정체 미상은 ???로 표시된다', () => {
    render(<DialogueBox speaker="???" text="안녕하십니까." />)
    expect(screen.getByTestId('speaker-tag')).toHaveTextContent('???')
  })
  it('화자가 없으면 이름표가 없다', () => {
    render(<DialogueBox speaker={null} text="원달러 환율이 1400원을 넘었다." />)
    expect(screen.queryByTestId('speaker-tag')).toBeNull()
  })
  it('전문이 보인 뒤 탭하면 다음으로 넘어간다', () => {
    const onAdvance = vi.fn()
    render(<DialogueBox speaker={null} text="짧다" onAdvance={onAdvance} />)
    fireEvent.click(screen.getByTestId('dialogue-box'))  // 즉시 완성
    fireEvent.click(screen.getByTestId('dialogue-box'))  // 다음
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: VN 대화창(타이핑·이름표·로그)"
```

---

### Task 18: 이벤트 모달 VN화

**Files:**
- Modify: `packages/app/src/overlays/EventModal.tsx`
- Test: `packages/app/src/overlays/overlays.test.tsx`

**Interfaces:**
- Consumes: `<DialogueBox />`, `<ArtSlot kind="portrait" />`, `<ArtSlot kind="background" />`

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('EventModal VN', () => {
  it('화자가 있으면 초상화 슬롯을 그린다', () => {
    renderEvent({ id: 's_kim_offer', speaker: 'kim' })
    expect(screen.getByTestId('speaker-portrait')).toHaveAttribute('data-art-id', 'npc.kim.normal')
  })
  it('화자가 없으면 초상화 대신 섹터/시황 아트가 나온다', () => {
    renderEvent({ id: 'n_fx_1400', speaker: undefined })
    expect(screen.queryByTestId('speaker-portrait')).toBeNull()
    expect(screen.getByTestId('event-visual')).toBeInTheDocument()
  })
  it('제목 배너가 이벤트 제목을 보여준다', () => {
    renderEvent({ id: 's_kim_offer', title: '낯이 익은 사람' })
    expect(screen.getByTestId('event-title')).toHaveTextContent('낯이 익은 사람')
  })
  it('배경 슬롯이 함께 그려진다', () => {
    renderEvent({ id: 's_kim_offer', speaker: 'kim' })
    expect(screen.getByTestId('event-bg')).toHaveAttribute('data-slot-kind', 'background')
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 이벤트 모달을 비주얼 노벨 문법으로"
```

---

### Task 19: 선택지 하단 시트

**Files:**
- Create: `packages/app/src/overlays/ChoiceSheet.tsx` + 테스트

**Interfaces:**
- Produces: `<ChoiceSheet eventId={string} choices={Choice[]} />`
- **`resolveChoice`는 절대 던지지 않는다.** 선택 후 `pendingChoices`가 실제로 비었는지 단언하는 것이 테스트의 책임이다.

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('ChoiceSheet', () => {
  it('대사를 다 읽기 전에는 시트가 열리지 않는다', () => {
    renderEventWithChoices({ text: '긴 대사가 아직 타이핑 중이다' })
    expect(screen.queryByTestId('choice-sheet')).toBeNull()
  })
  it('대사가 끝나면 시트가 올라온다', () => {
    renderEventWithChoices({ text: '짧다' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(screen.getByTestId('choice-sheet')).toBeInTheDocument()
  })
  it('선택하면 pendingChoices가 실제로 빈다', () => {
    renderEventWithChoices({ text: '짧다' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(currentState().pendingChoices).toHaveLength(0)
  })
  it('선택 효과가 실제로 적용된다', () => {
    renderEventWithChoices({ text: '짧다', choiceCashDelta: -500_000 })
    const before = currentState().player.cash
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(currentState().player.cash).toBe(before - 500_000)
  })
  it('같은 선택지를 두 번 눌러도 효과가 한 번만 적용된다', () => {
    renderEventWithChoices({ text: '짧다', choiceCashDelta: -500_000 })
    const before = currentState().player.cash
    fireEvent.click(screen.getByTestId('dialogue-box'))
    const btn = screen.getByTestId('choice-0')
    fireEvent.click(btn); fireEvent.click(btn)
    expect(currentState().player.cash).toBe(before - 500_000)
  })
  it('여러 선택지가 대기 중이면 순서대로 해소된다', () => {
    renderEventWithChoices({ pending: 2, text: '짧다' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(currentState().pendingChoices).toHaveLength(1)
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 선택지 하단 시트"
```

---

### Task 20: 컷신과 프롤로그

**Files:**
- Modify: `packages/app/src/overlays/CutsceneView.tsx`, `PrologueView.tsx`

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('CutsceneView', () => {
  it('승급 컷신이 새 티어 이름을 보여준다', () => {
    renderWithState({ cutscene: 'cutscene.promote.2', player: { tier: 2 } })
    expect(screen.getByTestId('cutscene-title')).toHaveTextContent('불개미')
  })
  it('강등 컷신은 승급과 다른 톤이다', () => {
    const tone = (k: string) => {
      renderWithState({ cutscene: k })
      return screen.getByTestId('cutscene').getAttribute('data-tone')
    }
    expect(tone('cutscene.promote.2')).not.toBe(tone('cutscene.demote.1'))
  })
  it('닫으면 다시 뜨지 않는다', () => {
    renderWithState({ cutscene: 'cutscene.promote.2' })
    fireEvent.click(screen.getByTestId('cutscene-close'))
    expect(currentState().cutscene).toBeNull()
  })
})

describe('PrologueView', () => {
  it('화자 초상화와 대화창을 함께 그린다', () => {
    render(<PrologueView />)
    expect(screen.getByTestId('speaker-portrait')).toBeInTheDocument()
    expect(screen.getByTestId('dialogue-box')).toBeInTheDocument()
  })
  it('건너뛰면 즉시 게임이 시작된다', () => {
    render(<PrologueView />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    expect(screen.queryByTestId('prologue')).toBeNull()
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 컷신·프롤로그를 VN 문법으로"
```

---

### Task 21: 엔딩 — 잔고증명서

**Files:**
- Modify: `packages/app/src/overlays/EndingView.tsx` (전면 재작성) + 테스트

**Interfaces:**
- Consumes: `state.ending`, `state.trackers`(`feesPaid`/`taxPaid`/`peakAssets`/`maxDrawdownPct`/`tradeCount`)

**실존 증권사의 상호·로고·서식을 쓰지 않는다.** 발행처는 가상 이름, 계좌번호는 마스킹 형태.

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('EndingView 잔고증명서', () => {
  it('예수금·주식평가금액·합계를 보여준다', () => {
    renderEnding({ cash: 31_311_114, holdingValue: 3_308_610 })
    expect(screen.getByTestId('doc-cash')).toHaveTextContent('31,311,114원')
    expect(screen.getByTestId('doc-stock')).toHaveTextContent('3,308,610원')
    expect(screen.getByTestId('doc-total')).toHaveTextContent('34,619,724원')
  })
  it('낸 수수료와 세금의 합계를 보여준다', () => {
    renderEnding({ trackers: { feesPaid: 300_000, taxPaid: 112_880 } })
    expect(screen.getByTestId('doc-cost')).toHaveTextContent('412,880원')
  })
  it('최고 자산·최대 낙폭·거래 횟수를 보여준다', () => {
    renderEnding({ trackers: { peakAssets: 42_180_000, maxDrawdownPct: 18.4, tradeCount: 47 } })
    expect(screen.getByTestId('doc-peak')).toHaveTextContent('42,180,000원')
    expect(screen.getByTestId('doc-drawdown')).toHaveTextContent('18.4')
    expect(screen.getByTestId('doc-trades')).toHaveTextContent('47')
  })
  it('엔딩 이름이 한국어로 나오고 내부 id가 새지 않는다', () => {
    renderEnding({ endingId: 'bank' })
    expect(screen.getByTestId('ending-name')).toHaveTextContent('은행 이자보단 낫지')
    expect(screen.getByTestId('ending-doc').textContent).not.toContain('bank')
  })
  it('칭호가 전부 표시된다', () => {
    renderEnding({ titles: ['강철멘탈의', '빚 없이'] })
    expect(screen.getAllByTestId(/^title-/)).toHaveLength(2)
  })
  it('실존 증권사명을 쓰지 않는다', () => {
    renderEnding({})
    const text = screen.getByTestId('ending-doc').textContent!
    for (const w of ['미래에셋','삼성증권','키움','NH투자','한국투자','토스증권'])
      expect(text).not.toContain(w)
  })
  it('계좌번호가 마스킹된 형태다', () => {
    renderEnding({})
    expect(screen.getByTestId('doc-account')).toHaveTextContent(/^0{3}-0{2}-0{6}$/)
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 엔딩을 잔고증명서 형식으로"
```

---

### Task 22: 애니메이션 3층 적용

**Files:**
- Modify: `packages/app/src/index.css`, 각 컴포넌트

- [ ] **Step 1: 실패하는 테스트**

```tsx
describe('애니메이션', () => {
  it('자산 숫자가 롤업된다', () => {
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_000_000 } })
    expect(Number(screen.getByTestId('topbar-assets').getAttribute('data-value'))).toBeLessThan(2_000_000)
  })
  it('reduced-motion이면 즉시 반영된다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_000_000 } })
    expect(Number(screen.getByTestId('topbar-assets').getAttribute('data-value'))).toBe(2_000_000)
  })
  it('막힌 동작은 흔들림 클래스를 받는다', () => {
    renderDetail({ blocked: true })
    fireEvent.click(screen.getByTestId('sell'))
    expect(screen.getByTestId('sell')).toHaveClass('shake')
  })
  it('흔들림 진입 시 화면 가장자리가 맥동한다', () => {
    renderWithState({ player: { mental: 40 } })
    setState({ player: { mental: 12 } })
    expect(screen.getByTestId('app-root')).toHaveAttribute('data-pulse', 'shaken')
  })
})
```

- [ ] **Step 2~5: 실패 확인 → 구현 → 통과 확인 → 커밋**

```bash
git commit -am "feat: 상태 전이·화면 전환·타격감 애니메이션"
```

---

### Task 23: 이미지 생성 프롬프트 문서

**Files:**
- Create: `docs/art-prompts.md`

48컷 전부의 프롬프트를 쓴다. **화풍 고정 문장을 모든 컷에 토씨 하나 바꾸지 않고 반복한다** — 생성 도구가 ChatGPT·Gemini·Grok으로 갈리므로 그것이 유일한 일관성 장치다.

- [ ] **Step 1: 화풍 고정 블록을 정한다**

```
STYLE (모든 컷에 그대로 붙인다):
Korean webtoon style, clean bold line art, flat cel shading with soft rim light,
muted desaturated palette with one accent color, cinematic dark tone,
character centered, waist-up, facing viewer, neutral studio lighting.

BACKGROUND (인물 컷 전용):
flat solid magenta (#FF00FF) background, completely uniform, no gradient,
no vignette, no shadow cast onto the background, no drop shadow,
subject fully inside frame, no cropping at edges.

NEGATIVE:
text, watermark, signature, logo, multiple characters, extra limbs,
blurry, low quality, jpeg artifacts, realistic photo, 3d render
```

- [ ] **Step 2: 컷별 프롬프트를 쓴다**

| 슬롯 | 비율 | 개수 |
|---|---|---|
| `char.tier{0..5}.{normal,shaken,joy}` | 3:4 | 18 |
| `npc.{daebak,cho,kim,mom}.{normal,alt}` | 3:4 | 8 |
| `bg.{office,home,street,exchange}` | 16:9 | 4 |
| `cutscene.{promote,demote}.*` | 4:3 | 10 |
| `ending.*` | 1:1 | 8 |

티어 6단계는 **같은 인물이 성장하는 것**이므로 인물 묘사(성별·나이·머리 모양·얼굴 특징)를 고정하고 복장과 자세만 바꾼다. 각 컷에 그 고정 묘사를 반복해서 넣는다.

- [ ] **Step 3: 파일 배치 규칙과 교체 절차를 문서에 남긴다**

`packages/app/public/art/<슬롯키>.webp`에 두고 `registry.tsx`에서 `{kind:'image', src}`로 바꾼다.

- [ ] **Step 4: 커밋**

```bash
git add docs/art-prompts.md
git commit -m "docs: AI 이미지 생성 프롬프트 48컷"
```

---

### Task 24: 통합 점검 · 브라우저 완주 · README

**Files:**
- Modify: `README.md`
- Test: `packages/app/src/integration.test.tsx`

- [ ] **Step 1: 통합 테스트를 갱신한다**

행동력·슬롯·리롤이 들어간 새 루프로 156턴을 완주하는 테스트로 고친다.

- [ ] **Step 2: 브라우저로 156턴을 완주한다**

```bash
pnpm --filter @bb/app build
# 프리뷰를 띄우고 Playwright로 완주:
#   프롤로그 prologue-next → 선택지 choice-* → 컷신 cutscene-close → 엔딩 ending
#   오버레이가 없으면 홈 탭 → 슬롯 카드 → next-turn
```

콘솔 에러 0건, 4xx 0건을 확인하고 결과를 보고서에 남긴다.

- [ ] **Step 3: README 갱신**

- 행동력·등급·슬롯 구조 설명
- 상장법인목록 갱신 방법 (KRX kind.krx.co.kr → 상장법인목록 → 엑셀)
- 이미지 교체 절차 (`docs/art-prompts.md` 참조)
- `SAVE_VERSION` 규율 — `GameState` 스키마가 바뀌면 반드시 올린다

- [ ] **Step 4: 전체 확인 후 커밋**

```bash
pnpm -r test && pnpm -r typecheck && pnpm --filter @bb/app build
git commit -am "chore: 통합 점검·README 갱신"
```

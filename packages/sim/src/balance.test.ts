import { describe, it, expect } from 'vitest'
import { playOne, runBatch } from './runner'
import { act, withinApBudget, CARD_PREF, RECOVERY_AT } from './strategies'
import {
  BALANCE, initGame, advanceTurn, resolveChoice, loadEvents, loadCards, Rand, createRng,
  buy, maxBuyQty, priceOf, type GameState,
} from '@bb/core'
import type { Strategy } from './strategies'

/**
 * 2턴차에 sjc를 `qtyOf(state)`만큼 사고 156턴 존버한다. 매 턴 '존버' 카드만 쓴다.
 * 매수 규모만 다른 두 판을 비교하기 위한 하네스 — 전략은 그대로 두고 노출만 바꾼다.
 *
 * Task 6부터 슬롯 밖 카드는 거부되므로, '존버'를 그 턴 회복 슬롯에 직접 꽂아 넣는다.
 * (뽑힌 회복 카드를 그대로 쓰면 하네스가 재는 대상이 바뀐다 — 휴식·운동은 등급 배율이
 *  붙으면 존버보다 몇 배 강한 회복이라, 노출이 아니라 회복 운을 재게 된다.)
 */
function ladder(seeds: number, qtyOf: (s: GameState) => number) {
  const events = loadEvents()
  let shakenRuns = 0, shakenTurns = 0
  for (let seed = 1; seed <= seeds; seed++) {
    let s = initGame(seed)
    const rand = new Rand(createRng(seed ^ 0xabcdef))
    for (let i = 0; i < BALANCE.totalTurns && s.status === 'playing'; i++) {
      while (s.pendingChoices.length > 0) {
        const c = s.pendingChoices[0]!
        const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
        s = n > 0 ? resolveChoice(s, c.eventId, rand.int(0, n - 1), events)
                  : { ...s, pendingChoices: s.pendingChoices.slice(1) }
      }
      if (s.turn === 2) {
        const q = Math.min(maxBuyQty(s, 'sjc'), qtyOf(s))
        if (q > 0) { try { s = buy(s, 'sjc', q) } catch { /* 티어락·자금부족은 무시 */ } }
      }
      s = advanceTurn({ ...s, slots: { ...s.slots, recovery: { cardId: 'hodl', grade: 'C' } } }, ['hodl'])
    }
    if (s.trackers.shakenTurns > 0) shakenRuns++
    shakenTurns += s.trackers.shakenTurns
  }
  return { shakenRate: shakenRuns / seeds, avgShakenTurns: shakenTurns / seeds }
}

/**
 * `runBatch`는 (runs, strategy, seed0)의 **순수 함수**다 — 같은 인자는 같은 리포트를
 * 바이트 단위로 낸다. 이 파일에서만 같은 배치를 여러 게이트가 다시 돌리고 있어
 * (buyhold 200판이 네 번) 스위트 시간의 절반이 중복 계산이었다. 메모는 결과를 바꾸지
 * 않고 시간만 줄인다 — 표본을 키운 게이트의 비용을 여기서 되산다.
 */
const cache = new Map<string, ReturnType<typeof runBatch>>()
function batch(runs: number, strategy: Strategy, seed0 = 1) {
  const key = `${runs}/${strategy}/${seed0}`
  const hit = cache.get(key)
  if (hit) return hit
  const r = runBatch(runs, strategy, seed0)
  cache.set(key, r)
  return r
}

describe('playOne', () => {
  it('한 판이 끝까지 돌고 엔딩이 나온다', () => {
    const r = playOne(1, 'seedhold')
    // ending.length>0과 turns>0만으로는 루프가 1턴 만에 멈춰도 통과한다
    // ('unknown'.length===7, turns===1이 둘 다 두 조건을 만족) — 실제로 끝까지
    // 돌았는지는 알려진 엔딩 id로 확정됐는지를 봐야 한다 (뮤테이션 검증: 보고서 참고).
    expect(r.ending).not.toBe('unknown')
    expect(r.ending.length).toBeGreaterThan(0)
    expect(r.turns).toBeGreaterThan(0)
    expect(r.turns).toBeLessThanOrEqual(BALANCE.totalTurns)
  })
  it('같은 시드·전략은 같은 결과 (결정론)', () => {
    expect(playOne(5, 'momentum')).toEqual(playOne(5, 'momentum'))
  })
  it('여섯 전략 모두 예외 없이 완주한다', () => {
    for (const s of ['cash', 'seedhold', 'buyhold', 'momentum', 'random', 'panic'] as const) {
      expect(() => playOne(3, s)).not.toThrow()
    }
  })
  it('여섯 전략은 같은 시드에서 서로 다른 결과를 낸다', () => {
    // panic vs buyhold는 §8.2 게이트가 이미 구분하지만, 나머지 조합은 구분하는 테스트가
    // 없었다 — momentum이 조용히 buyhold로 퇴화해도 스위트가 그린으로 남는 맹점.
    // "momentum vs random·cash"만 비교하면 momentum이 buyhold로 퇴화해도 random·cash와는
    // 여전히 다르므로 안 잡힌다 — 그래서 6개 전략 전부를 서로 pairwise로 비교한다.
    // seedhold(옛 buyhold)와 buyhold(=진짜 존버, 매 턴 현금 90% 투입·무매도)가 같은 것으로
    // 퇴화하는 것도 여기서 잡힌다.
    const seed = 21
    const strategies = ['cash', 'seedhold', 'buyhold', 'momentum', 'random', 'panic'] as const
    const results = strategies.map(s => playOne(seed, s))
    for (let i = 0; i < results.length; i++) {
      for (let j = i + 1; j < results.length; j++) {
        expect(results[i], `${strategies[i]} vs ${strategies[j]}`).not.toEqual(results[j])
      }
    }
  })
  it('cash 전략은 어떤 턴에도 매수하지 않는다 (보유 종목이 항상 0)', () => {
    // Ruling 52 — 무매매 기준선. playOne은 보유 종목 목록을 노출하지 않으므로
    // act()를 직접 호출해 매 턴마다 holdings가 비어 있는지 확인한다. assets>0 같은
    // 간접 확인은 buy를 실제로 호출해도(예: seedhold와 동일하게 동작해도) 통과해버려
    // 아무것도 고정하지 못한다 — 아래 뮤테이션 검증 참고(보고서).
    let s = initGame(7)
    const rand = new Rand(createRng(7 ^ 0xabcdef))
    const events = loadEvents()
    for (let i = 0; i < 40 && s.status === 'playing'; i++) {
      while (s.pendingChoices.length > 0) {
        const c = s.pendingChoices[0]!
        const def = events.find(e => e.id === c.eventId)
        const n = def?.choices?.length ?? 0
        s = n > 0 ? resolveChoice(s, c.eventId, rand.int(0, n - 1), events)
                  : { ...s, pendingChoices: s.pendingChoices.slice(1) }
      }
      const { state, cards } = act(s, 'cash', rand)
      expect(state.player.holdings).toEqual([])
      s = advanceTurn(state, withinApBudget(state, cards))
    }
  })
})

/**
 * 리뷰 Minor 1 — sim이 "슬롯에서만 고른다"가 어떤 테스트로도 고정돼 있지 않았다.
 * `withinApBudget`가 슬롯 밖 id를 조용히 걸러냈기 때문에, 카드 선택을 `loadCards()`
 * 전체로 되돌려도 예외 없이 통과하고 결과만 소리 없이 움직였다(panic 32.9M → 34.7M).
 */
describe('전략은 이번 턴 슬롯에서만 카드를 고른다 (리뷰 Minor 1)', () => {
  const ALL = ['cash', 'seedhold', 'buyhold', 'momentum', 'random', 'panic'] as const satisfies readonly Strategy[]

  it('여섯 전략 × 여러 시드에서 고른 카드가 항상 슬롯 안에 있다', () => {
    const events = loadEvents()
    for (const strategy of ALL) {
      for (const seed of [1, 2, 3]) {
        let s = initGame(seed)
        const rand = new Rand(createRng(seed ^ 0xabcdef))
        for (let i = 0; i < 30 && s.status === 'playing'; i++) {
          while (s.pendingChoices.length > 0) {
            const c = s.pendingChoices[0]!
            const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
            s = n > 0 ? resolveChoice(s, c.eventId, rand.int(0, n - 1), events)
                      : { ...s, pendingChoices: s.pendingChoices.slice(1) }
          }
          const { state, cards } = act(s, strategy, rand)
          const inSlots = [...state.slots.action.map(a => a.cardId), state.slots.recovery.cardId]
          for (const id of cards) expect(inSlots, `${strategy} / seed ${seed} / turn ${state.turn}`).toContain(id)
          s = advanceTurn(state, withinApBudget(state, cards))
        }
      }
    }
  })

  it('슬롯 밖 카드를 넘기면 조용히 떨구지 않고 NOT_IN_SLOTS로 터진다', () => {
    const s = initGame(1)
    const inSlots = [...s.slots.action.map(a => a.cardId), s.slots.recovery.cardId]
    const outside = loadCards().map(c => c.id).find(id => !inSlots.includes(id))!
    expect(outside).toBeDefined()
    expect(() => withinApBudget(s, [outside])).toThrow(/NOT_IN_SLOTS/)
  })
})

describe('runBatch', () => {
  it('리포트 필드가 채워진다', () => {
    const r = batch(60, 'seedhold')
    expect(r.runs).toBe(60)
    expect(Object.values(r.endingCounts).reduce((a, b) => a + b, 0)).toBe(60)
    expect(r.assetsP10).toBeLessThanOrEqual(r.assetsMedian)
    expect(r.assetsMedian).toBeLessThanOrEqual(r.assetsP90)
  })

  // 최종 리뷰 C1: 표정 축이 상수로 붕괴해 있었다(월급 입금만으로 턴 4부터 영구 joy,
  // char.tier{n}.normal 6개 키가 사장). 붕괴는 단위 테스트로는 안 보인다 —
  // "실제 플레이 156턴에서 세 표정이 다 나오는가"로만 잡힌다.
  it('캐릭터 표정 3종이 실제 플레이에서 모두 나타난다', () => {
    // buyhold: 노출이 짙어 손실·회복을 다 겪는 전형적인 판.
    const r = batch(40, 'buyhold')
    for (const m of ['normal', 'joy', 'shaken'] as const) {
      expect(r.moodShare[m], `${m} 점유율`).toBeGreaterThan(0.02)
      expect(r.moodReach[m], `${m} 도달 판 비율`).toBeGreaterThan(0.2)
    }
    // 어느 한 표정도 화면을 독점하지 않는다.
    for (const m of ['normal', 'joy', 'shaken'] as const) {
      expect(r.moodShare[m], `${m} 독점`).toBeLessThan(0.9)
    }
  })

  // 밸런스 게이트 — 스펙 §8.2
  it('두 존버 전략 모두 파산율이 15% 미만이다', () => {
    // seedhold: 시드의 90%만 넣고 방치 (얇은 노출) / buyhold: 매 턴 현금 90% 투입 (짙은 노출).
    // 노출이 10배 넘게 차이 나므로 둘 다 재야 "사놓고 버티면 망하지 않는다"가 성립한다.
    expect(batch(200, 'seedhold').bankruptRate, 'seedhold').toBeLessThan(0.15)
    expect(batch(200, 'buyhold').bankruptRate, 'buyhold').toBeLessThan(0.15)
  })
  it('panic이 buyhold(노출을 맞춘 존버)보다 확실히 나쁘다', () => {
    // 재리뷰 §5: panic은 매 턴 자본의 95%를 굴리므로 시장 노출이 buyhold(진짜 존버)와
    // 거의 같다. 옛 buyhold(=seedhold, 노출 40%)와 비교하면 "뇌동매매는 손해다"가 -1%로
    // 재어졌지만, 노출을 맞춘 buyhold와 비교하면 **중앙값 -28%**다. 처벌의 크기를
    // 제대로 재려면 비교 대상이 노출을 맞춘 벤치마크여야 한다.
    //
    // **표본을 200 → 500으로 키웠다(Task 8).** 통과선(×0.85)은 그대로다. Task 7 끝에
    // 이 게이트가 0.854로 red였을 때 원인은 버그가 아니라 **검정력 부족**이었다:
    // 시드창 5개를 훑으면 0.854 / 0.808 / 0.741 / 0.790 / 0.886으로 창마다 ±7%p씩
    // 흔들렸고, 카드를 한 장도 쓰지 않는 변형에서도 0.8555가 나왔다(격차를 만드는 건
    // 카드가 아니라 매매다). 통과선을 내리면 "뇌동매매의 처벌이 얼마나 커야 하는가"라는
    // 이 게이트의 문언이 훼손되므로, 문언을 그대로 두고 표본을 키웠다.
    // 재측정(시드창 6개, n=500): 0.726 / 0.750 / 0.755 / 0.763 / 0.785 / 0.795 —
    // 폭이 0.102 → 0.069로 좁아졌고 모든 창이 통과선 아래다.
    const panic = batch(500, 'panic')
    const hold = batch(500, 'buyhold')
    expect(panic.assetsMedian, `panic/buyhold ${(panic.assetsMedian / hold.assetsMedian).toFixed(4)}`)
      .toBeLessThan(hold.assetsMedian * 0.85)
  })
  it('seedhold가 무매매(cash)를 마진 이상으로 이긴다 — 투자할 이유가 있는 시장인가', () => {
    // Task 24의 핵심 게이트. 시장 기대수익률이 0 이하면 아무것도 안 한 사람(cash)이
    // 바이앤홀드를 이기고, 그 순간 이 게임은 "투자하지 마라"를 가르친다.
    // 두 배치를 같은 시드 창에서 실제로 돌려 비교한다 — 기준선을 리터럴로 박으면
    // 밸런싱 한 번에 무의미해진다.
    //
    // 일부러 **얇은 노출**인 seedhold로 잰다. 시드의 90%(270만원)만 한 번 넣고 방치하는
    // 전략이 3년 뒤 무매매를 3% 이상 이겨야 "시장이 투자를 보상한다"고 말할 수 있다.
    // 마진(×1.03)이 필요한 이유: 마진 없는 `>`는 튜닝 전 BALANCE에서도 통과했다
    // (29,022,906 vs 29,020,000 = +0.01%, 2,906원 차이 — 동전던지기).
    // 상대 마진은 '기준선 리터럴'이 아니라 두 배치의 관계라 밸런싱을 해도 유효하다.
    // 현재 실측 +10.8%. (뮤테이션 검증: 보고서 Fix Round 1 §뮤테이션)
    //
    // 표본을 200 → 500으로 키웠다(Task 8). 이 게이트는 마진이 원래 얇고(+3%) Task 6~7의
    // 성장 구조 변경으로 실측 마진이 +10.8% → +4.7%까지 줄었다 — 창 하나로 재면
    // 동전던지기가 된다. 500판 시드창 6개 재측정: 1.045 / 1.052 / 1.055 / 1.058 /
    // 1.062 / 1.066 (전부 통과, 최악의 창도 +1.5%p 여유).
    //
    // `cash`와 `seedhold`는 **카드 정책이 같다**(strategies.ts의 CARD_PREF). 한쪽만
    // 야근을 하면 이 게이트가 재는 것이 "시장이 투자를 보상하는가"가 아니라 "누가 더
    // 일했는가"가 된다 — 아래 '대조쌍은 카드 정책이 같다' 테스트가 그 전제를 고정한다.
    const bh = batch(500, 'seedhold')
    const cash = batch(500, 'cash')
    expect(bh.assetsMedian, `seedhold/cash ${(bh.assetsMedian / cash.assetsMedian).toFixed(4)}`)
      .toBeGreaterThan(cash.assetsMedian * 1.03)
  })
  it('어떤 종목도 시드와 무관하게 확정 승리·확정 패배가 아니다', () => {
    // Fix Round 1의 핵심 게이트. 이전에는 청람소재(ecp)가 300시드 전부에서 초기가 아래로
    // 끝났고(상승률 0%), 10종 중 5종이 상승률 6% 이하였다 — 플레이어가 배우는 것이
    // "위험을 어떻게 다룰까"가 아니라 "어떤 티커를 피할까"라는 정답표가 된다.
    // 자산 분위수로는 안 보이는 결함이라 리포트에 종목별 최종가 배율을 추가했다.
    const r = batch(200, 'random')
    const ids = Object.keys(r.priceUpRate)
    expect(ids.length).toBeGreaterThanOrEqual(10)
    const bad = ids
      .filter(id => r.priceUpRate[id]! < 0.15 || r.priceUpRate[id]! > 0.95)
      .map(id => `${id}: 상승률 ${(r.priceUpRate[id]! * 100).toFixed(0)}% (배율 중앙 x${r.priceMulMedian[id]!.toFixed(2)})`)
    expect(bad).toEqual([])
  })
  it('시장 자체가 3년 뒤 우상향한다 (얇은 포지션을 통하지 않고 직접 잰다)', () => {
    // seedhold는 시드머니의 90%(270만원)를 딱 한 번 사고 끝이라, 나머지 3천만원은 월급이다.
    // 그래서 seedhold vs cash 비교는 시장 성질을 아주 얇게만 반영한다 — 시장 튜닝을 통째로
    // 되돌려도 그 게이트는 통과한다(FM1: 1.064). 시장은 직접 재야 한다.
    // 지수 ETF는 파생이라 제외하고, 실제 종목들의 최종가 배율 중앙값의 중앙값을 본다.
    // 현재 1.24 / 시장 튜닝을 되돌리면 0.78. (뮤테이션 검증: 보고서 Fix Round 1)
    const r = batch(200, 'random')
    const muls = Object.entries(r.priceMulMedian)
      .filter(([id]) => id !== 'lev' && id !== 'inv')
      .map(([, m]) => m)
      .sort((a, b) => a - b)
    expect(muls.length).toBeGreaterThanOrEqual(8)
    const median = muls[Math.floor(muls.length / 2)]!
    expect(median, `종목 배율 중앙값 ${median.toFixed(3)}`).toBeGreaterThan(1)
  })
  it('멘탈 시스템이 살아 있다 — 흔들림이 가끔은 발동한다', () => {
    // 이전에는 200시드 전부가 shakenTurns 0이었다(멘탈은 100 고정). 흔들림·이성 카드
    // 잠김·손절 봉인이 정상 플레이에서 한 번도 발동하지 않으면 그 시스템은 없는 것과 같다.
    // 반대로 늘 발동하면 게임이 안 굴러가므로 위쪽도 막는다.
    // 노출도 가중(재리뷰 N1) 이후로는 **노출이 짙은** buyhold로 잰다 — 얇은 seedhold로
    // 재면 "토큰 포지션 하나로 게이트가 만족되는" 문제가 그대로 남는다.
    const r = batch(200, 'buyhold')
    expect(r.shakenRate).toBeGreaterThan(0.1)
    expect(r.shakenRate).toBeLessThan(0.9)
  })
  it('멘탈 피해가 노출도를 따라간다 — 1주와 몰빵이 같은 피해를 입지 않는다', () => {
    // 재리뷰 N1. portfolioLossPct가 보유 원가 대비라, 노출 가중이 없으면 7만원짜리 1주와
    // 시드 90% 투입이 같은 멘탈 피해를 입는다. 실측(가중 제거 시): 1주 56% vs 시드90% 50%
    // — 단조 증가가 아니라 오히려 역전이었다. 노출을 바꿔가며 직접 잰다.
    const tiny = ladder(60, () => 1)
    const heavy = ladder(60, s => Math.floor((s.player.cash * 0.9) / priceOf(s, 'sjc')))
    expect(tiny.shakenRate, `1주 ${(tiny.shakenRate * 100).toFixed(0)}%`).toBeLessThan(0.1)
    expect(heavy.shakenRate, `몰빵 ${(heavy.shakenRate * 100).toFixed(0)}%`).toBeGreaterThan(0.15)
    expect(heavy.shakenRate).toBeGreaterThan(tiny.shakenRate * 3)
  })
  // ── Task 8이 추가한 게이트 3개 ──────────────────────────────────────────────
  // 슬롯·행동력·등급이 들어온 뒤에도 "선택이 실제로 존재하는가 / 성장이 체감되는가 /
  // 교착이 나는가"를 재는 자가 하나도 없었다. 셋 다 단위 테스트로는 안 보이고
  // 156턴 실제 플레이에서만 보인다.

  it('행동력이 대부분의 턴에서 실제로 소모된다', () => {
    // 예산이 남아도는 설계는 선택을 만들지 못한다 — 슬롯 3칸 중 무엇을 낼지가 고민이
    // 되려면 예산이 실제로 빡빡해야 한다.
    // 통과선을 `BALANCE.action.base`에서 유도하는 것이 이 게이트의 핵심이다: 예산을
    // 부풀리는 뮤테이션(base 2 → 20)은 **통과선도 같이 올라가** 잡힌다. 행동 슬롯이
    // 3칸이고 한 장의 최대 비용이 3AP라 한 턴에 태울 수 있는 상한이 9AP이므로,
    // 예산을 20으로 늘리면 통과선 12AP는 원리적으로 도달 불가능하다(보고서 §뮤테이션).
    const r = batch(200, 'buyhold')
    expect(r.avgApSpent, `턴당 행동력 ${r.avgApSpent.toFixed(2)} / 기본 ${BALANCE.action.base}`)
      .toBeGreaterThan(BALANCE.action.base * 0.6)
  })

  it('등급 분포가 후반에 상위로 이동한다', () => {
    // 스탯이 등급 확률을 민다(BALANCE.grade.statShift)는 설계가 **실제 플레이에서**
    // 성립하는가. 단위 테스트는 "스탯 10이면 상위 등급이 많다"까지만 보이고, 156턴
    // 동안 스탯이 실제로 그만큼 자라는지는 못 본다.
    // 재는 대상은 낸 카드가 아니라 **뽑힌 슬롯 4칸 전부**다 — 낸 카드만 세면 전략
    // 취향이 등급 분포에 섞여 들어와 설계가 아니라 취향을 재게 된다.
    const r = batch(200, 'buyhold')
    expect(r.avgGradeIdxLate, `초반 ${r.avgGradeIdxEarly.toFixed(2)} → 후반 ${r.avgGradeIdxLate.toFixed(2)}`)
      .toBeGreaterThan(r.avgGradeIdxEarly + 0.5)
  })

  it('회복 슬롯이 멘탈 교착을 막는다', () => {
    // 흔들림에 들어간 판이 전부 흔들림으로 끝나지는 않는다 — 회복 슬롯이 항상 열려 있고
    // 행동력을 쓰지 않는다는 불변식(스펙 §3.3, BALANCE.action)이 실제로 탈출구인가.
    // panic으로 재는 이유: 커뮤니티 눈팅(멘탈 −6)과 뇌동매매 손실이 겹쳐 흔들림에
    // 가장 자주 빠지는 전략이다.
    const r = batch(300, 'panic')
    // 분모 방어. stuckInShakenRate는 **흔들림을 겪은 판**을 분모로 쓰므로, 아무도
    // 흔들리지 않으면 0으로 공허하게 통과한다(그건 회복이 일했다는 증거가 아니라
    // 멘탈 시스템이 죽었다는 증거다). 분모가 유의미한지를 먼저 못박는다.
    expect(r.shakenRate, `panic 흔들림 겪은 판 ${(r.shakenRate * 100).toFixed(0)}%`).toBeGreaterThan(0.2)
    expect(r.stuckInShakenRate, `교착률 ${(r.stuckInShakenRate * 100).toFixed(1)}%`).toBeLessThan(0.2)
  })

  it('엔딩이 한 종류로 쏠리지 않는다', () => {
    // Ruling 53 — 브리프 기본값(seed0=1, runs=300) 그대로. 이전 라운드에서 seed0=5000으로
    // 옮겨 3종 이상을 억지로 만들었으나, 13개 seed0 창을 훑어보면 3종이 뜨는 창도 3번째
    // 엔딩이 300판 중 1~3판뿐인 동전던지기였다 — 게이트를 우회한 것이지 결함을 고친 게
    // 아니었다. 시드 창은 앞으로도 갈아끼우지 않는다.
    //
    // Task 24에서 원인(시장 기대수익률 음수 + 엔딩 경계가 3년치 월급을 무시한 시드머니
    // 기준)을 고친 뒤 단언을 원래 값인 4종으로 되돌렸다. 현재 실측: savings/breakeven/
    // bank/wise/kimheir 5종, 최다 33%.
    const r = batch(300, 'random')
    expect(Object.keys(r.endingCounts).length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...Object.values(r.endingCounts)) / r.runs).toBeLessThan(0.7)
  })
})

/**
 * Task 8 — "전략이 행동력을 어떻게 쓰는가"가 전략마다 실제로 다른지 실측으로 고정한다.
 * 여섯 전략이 전부 같은 카드를 고르면 위의 전략 비교 게이트들은 전략 차이가 아니라
 * 매매 차이만 재게 되고, `CARD_PREF` 표는 있으나 마나 한 장식이 된다.
 */
describe('전략별 행동력 사용이 실제로 다르다 (Task 8)', () => {
  const ALL = ['cash', 'seedhold', 'buyhold', 'momentum', 'random', 'panic'] as const satisfies readonly Strategy[]
  const use = () => Object.fromEntries(ALL.map(s => [s, batch(60, s).cardUse]))
  /** 두 카드 사용 분포의 거리(L1). 0이면 완전히 같고 2면 겹치는 카드가 하나도 없다. */
  function l1(a: Record<string, number>, b: Record<string, number>): number {
    const ids = new Set([...Object.keys(a), ...Object.keys(b)])
    let d = 0
    for (const id of ids) d += Math.abs((a[id] ?? 0) - (b[id] ?? 0))
    return d
  }

  it('CARD_PREF는 실제 행동 카드 전부를 빠짐없이 담는다', () => {
    // 오타 난 id는 조용히 '취향 없음'(맨 뒤)이 되어 그 전략의 성격만 사라진다 —
    // 어떤 게이트도 그걸 잡지 못한다. 표를 데이터와 직접 맞춰 둔다.
    const actionIds = loadCards().filter(c => !c.isRecovery).map(c => c.id).sort()
    expect(actionIds.length).toBeGreaterThan(0)
    for (const s of ALL) {
      if (s === 'random') { expect(CARD_PREF[s]).toEqual([]); continue }   // 취향 없음이 성격이다
      expect([...CARD_PREF[s]].sort(), `${s}의 취향 표`).toEqual(actionIds)
    }
  })

  it('대조쌍(cash·seedhold)은 카드 정책이 같다 — 매매만 다르다', () => {
    // `seedhold > cash × 1.03` 게이트의 전제다. 한쪽 취향 표만 바꾸면 그 게이트가
    // 시장이 아니라 노동을 재기 시작하는데, 그 순간을 잡을 자가 여기 말고는 없다.
    const u = use()
    expect(l1(u['cash']!, u['seedhold']!), '카드 사용 분포 L1 거리').toBeLessThan(0.05)
  })

  it('나머지 전략 쌍은 카드 사용 분포가 뚜렷이 다르다', () => {
    const u = use()
    const pairs: string[] = []
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) {
        const a = ALL[i]!, b = ALL[j]!
        if (a === 'cash' && b === 'seedhold') continue          // 위에서 '같아야 한다'로 고정
        const d = l1(u[a]!, u[b]!)
        if (d < 0.2) pairs.push(`${a} vs ${b}: L1 ${d.toFixed(3)}`)
      }
    }
    // 실측 최소 거리는 buyhold vs panic의 0.31이다(둘 다 야근이 1순위라 가장 가깝다).
    expect(pairs).toEqual([])
  })

  it('회복 임계는 리터럴이 아니라 BALANCE에서 유도된다', () => {
    // 문턱을 다시 튜닝했을 때 sim이 따라오지 않으면 게이트가 옛 문턱을 재게 된다.
    expect(RECOVERY_AT.mental).toBeGreaterThan(BALANCE.mental.shakenMax)
    expect(RECOVERY_AT.condition).toBeGreaterThan(BALANCE.condition.forcedSkipBelow)
  })
})

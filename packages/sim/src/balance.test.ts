import { describe, it, expect } from 'vitest'
import { playOne, runBatch } from './runner'
import { act, apCostOf, CARD_PREF, RECOVERY_AT, recoveryAt } from './strategies'
import {
  BALANCE, ENDING_IDS, initGame, advanceTurn, resolveChoice, loadEvents, loadCards, Rand, createRng,
  buy, maxBuyQty, priceOf, maxLoan, marginShortfall, type GameState,
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
/**
 * `leverage` 배치의 판수. 신용 게이트들과 아래 엔딩 조사가 **같은 배치 하나**를 나눠 쓰므로
 * (메모가 먹는다) 이 숫자를 올리면 스위트 시간이 그만큼만 늘고 조사 표본도 같이 커진다.
 *
 * 1,500인 이유는 `fire` 때문이다. `fire`는 자산 10억 + 퇴사라 조사에서 가장 희소한
 * 엔딩이고(실측 0.07~0.4%, 시드창 4개에서 1500판당 3~6판), 500판으로 줄이면 창에 따라
 * 0판이 되어 아래 '도달 가능한 엔딩 집합' 게이트가 시드 운에 흔들린다.
 * 누적 실측(seed0=1): 250판 fire=1 · 500판 2 · 1000판 3 · 1500판 4.
 */
const CENSUS_LEVERAGE_RUNS = 1500

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
  /**
   * **이 게이트가 지키는 것은 '재현성'이지 '전개 불변'이 아니다.**
   * 같은 시드로 두 번 돌리면 같은 결과가 나온다는 것까지가 여기서 참인 문장이다.
   * 이벤트를 하나 추가하면 같은 시드라도 **뽑히는 이벤트가 달라진다**(가중추첨의 후보가
   * 늘었으니 당연하다) — 이 브랜치가 넣은 `st_kim_credit`(tierMin 3)이 그랬고,
   * 티어 3 이상 판은 이전 코드와 전개가 갈린다(README §SAVE_VERSION 규율에 실측).
   * 그러니 "결정성 무손상"을 이 게이트의 통과로 주장하지 마라 — 그건 이 게이트가
   * 말한 적 없는 문장이다.
   */
  it('같은 시드·전략은 같은 결과 (결정론 — 재현성)', () => {
    expect(playOne(5, 'momentum')).toEqual(playOne(5, 'momentum'))
    // `leverage`는 대출·상환·강제청산이라는 새 상태 경로를 탄다. `Math.random`이 하나만
    // 섞여도 sim 스위트 전체가 flaky해지므로, 신용 경로도 같은 시드 두 번이 바이트 단위로
    // 같은지 따로 잰다 — 실제로 빚을 진 시드를 골라서 재야 의미가 있다(seed 162는
    // 아래 조사에서 `fire`가 나온 판이라 대출·퇴사 경로를 둘 다 지난다).
    const a = playOne(162, 'leverage')
    expect(a).toEqual(playOne(162, 'leverage'))
    expect(a.peakLoan, '이 시드는 실제로 빚을 진 판이어야 결정성 검사가 신용 경로를 덮는다')
      .toBeGreaterThan(0)
  })
  it('여덟 전략 모두 예외 없이 완주한다', () => {
    for (const s of ['cash', 'labor', 'seedhold', 'buyhold', 'momentum', 'random', 'panic', 'leverage'] as const) {
      expect(() => playOne(3, s)).not.toThrow()
    }
  })
  it('여덟 전략은 같은 시드에서 서로 다른 결과를 낸다', () => {
    // panic vs buyhold는 §8.2 게이트가 이미 구분하지만, 나머지 조합은 구분하는 테스트가
    // 없었다 — momentum이 조용히 buyhold로 퇴화해도 스위트가 그린으로 남는 맹점.
    // "momentum vs random·cash"만 비교하면 momentum이 buyhold로 퇴화해도 random·cash와는
    // 여전히 다르므로 안 잡힌다 — 그래서 6개 전략 전부를 서로 pairwise로 비교한다.
    // seedhold(옛 buyhold)와 buyhold(=진짜 존버, 매 턴 현금 90% 투입·무매도)가 같은 것으로
    // 퇴화하는 것도 여기서 잡힌다.
    // `labor`는 `cash`와 **매매가 같고 카드만 다르다** — 카드 정책이 퇴화하면 여기서 잡힌다.
    const seed = 21
    const strategies = ['cash', 'labor', 'seedhold', 'buyhold', 'momentum', 'random', 'panic', 'leverage'] as const
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
      s = advanceTurn(state, cards)
    }
  })
})

/**
 * 리뷰 Minor 1 — sim이 "슬롯에서만 고른다"가 어떤 테스트로도 고정돼 있지 않았다.
 * 예전 예산 필터가 슬롯 밖 id를 조용히 걸러냈기 때문에, 카드 선택을 `loadCards()`
 * 전체로 되돌려도 예외 없이 통과하고 결과만 소리 없이 움직였다(panic 32.9M → 34.7M).
 */
describe('전략은 이번 턴 슬롯에서만 카드를 고른다 (리뷰 Minor 1)', () => {
  const ALL = ['cash', 'labor', 'seedhold', 'buyhold', 'momentum', 'random', 'panic', 'leverage'] as const satisfies readonly Strategy[]

  it('여덟 전략 × 여러 시드에서 고른 카드가 항상 슬롯 안에 있다', () => {
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
          s = advanceTurn(state, cards)
        }
      }
    }
  })

  it('슬롯 밖 카드를 넘기면 조용히 떨구지 않고 NOT_IN_SLOTS로 터진다', () => {
    // sim이 카드를 세는 경로(`apCostOf`)와 실제로 내는 경로(`advanceTurn`) **둘 다**
    // 슬롯 밖 id를 거부해야 한다. 한쪽만 막으면 계측과 플레이가 조용히 갈라진다.
    const s = initGame(1)
    const inSlots = [...s.slots.action.map(a => a.cardId), s.slots.recovery.cardId]
    const outside = loadCards().map(c => c.id).find(id => !inSlots.includes(id))!
    expect(outside).toBeDefined()
    expect(() => apCostOf(s, [outside])).toThrow(/NOT_IN_SLOTS/)
    expect(() => advanceTurn(s, [outside])).toThrow(/NOT_IN_SLOTS/)
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
  /**
   * **Ruling 16의 절반 — 신용을 부르지 않는 전략의 파산율이 0인 것은 성질이 아니라 정의다.**
   *
   * 예전 제목은 `두 존버 전략 모두 파산율이 15% 미만이다`였고, 하한이 없는 `< 15%`는
   * 언제나 0을 보고 통과했다(전 전략 0.0%) — 구조적으로 공허했다. 진짜 이유는
   * "존버가 안전하다"가 아니라 **그 전략들이 `takeLoan`을 부르지 않는다**는 것이다.
   * 총자산(`cash + 보유평가액 − loan`)이 **0 미만**으로 내려가려면 빚이 있어야 한다 —
   * 현금은 0에서 잘리고(`effects.ts`·`economy.ts`) 보유 평가액은 음수가 못 되기 때문이다.
   * 파산 판정은 `<= 0`이라 '정확히 0'이라는 구멍이 하나 남지만(전 재산을 다 쓰고 보유도
   * 없는 계좌), 조사 4,360판에서도 신용 없는 대조군 23,800판에서도 관측된 적이 없다.
   *
   * 그래서 여기서 재는 것은 "일곱 전략이 조용히 빚을 지기 시작하지 않았는가"다 —
   * `marginRate === 0`이 전제고 `bankruptRate === 0`이 그 따름정리다. 앞의 것이 깨지면
   * 뒤의 것도 의미가 바뀌므로 둘을 나란히 단언한다.
   *
   * **파산이 실제로 일어나는가는 `leverage`가 잰다**(바로 아래 게이트). 그쪽이
   * "가끔은 망한다"와 "자주 망하지는 않는다"를 하한·상한으로 둘 다 못박는다.
   */
  it('신용을 부르지 않는 일곱 전략에서는 파산이 원리적으로 발생하지 않는다 (Ruling 16)', () => {
    // 이미 다른 게이트가 돌린 배치를 그대로 재사용한다(메모) — `leverage`를 뺀 일곱을 전부 덮는다.
    const probes: [number, Strategy][] = [
      [500, 'cash'], [500, 'labor'], [500, 'seedhold'], [500, 'buyhold'],
      [500, 'panic'], [300, 'random'], [200, 'momentum'],
    ]
    for (const [n, st] of probes) {
      const r = batch(n, st)
      expect(r.marginRate, `${st} 신용 사용률`).toBe(0)
      expect(r.bankruptRate, `${st} 파산율`).toBe(0)
    }
  })

  /**
   * **신용 시스템이 살아 있다 — `leverage`가 실제로 빚을 지고, 가끔 그 빚에 망한다.**
   *
   * 예전 게이트('신용을 쓰지 않는 sim 전략에서는 파산이 원리적으로 발생하지 않는다')는
   * "이 테스트가 red가 되면 그건 회귀가 아니라 신용 시스템이 살아났다는 뜻이다. 그때는
   * `bankruptRate === 0`을 지우고 예전의 상한 게이트(`< 0.15`)를 **하한과 함께**
   * 되살려라"라고 적어 두었다. 그 조건이 왔다 — 여기가 그 되살린 게이트다.
   *
   * 상한만 두면 0으로 공허하게 통과하고(그게 예전 결함이다), 하한만 두면 "매판 파산"도
   * 통과한다. 실측(n=1500, 시드창 4개): 신용 사용 30.0~32.2% · 파산 2.8~3.9%.
   */
  it('leverage는 실제로 빚을 지고, 가끔은 그 빚에 망한다', () => {
    const r = batch(CENSUS_LEVERAGE_RUNS, 'leverage')
    expect(r.marginRate, `신용 사용률 ${(r.marginRate * 100).toFixed(1)}%`).toBeGreaterThan(0.2)
    // '썼다'와 '판을 키웠다'는 다른 말이다. 1원을 빌려도 marginRate는 1이 되므로,
    // 빚의 규모가 대출이 열리는 티어의 자산선을 실제로 넘는지를 따로 못박는다.
    expect(r.peakLoanMax, `빚 최고잔액 ${r.peakLoanMax}원`)
      .toBeGreaterThan(BALANCE.tierMins[BALANCE.loan.minTier]!)
    expect(r.bankruptRate, `파산율 ${(r.bankruptRate * 100).toFixed(2)}% — 가끔은 망해야 한다`)
      .toBeGreaterThan(0)
    expect(r.bankruptRate, `파산율 ${(r.bankruptRate * 100).toFixed(2)}% — 자주 망하면 안 된다`)
      .toBeLessThan(0.15)
  })

  /**
   * **마진콜의 유예 한 주가 실제로 쓰인다.**
   *
   * core는 담보가 무너진 그 주에 경고(`marginCallDueTurn`)만 세우고, 다음 주에도 회복하지
   * 못했을 때 비로소 전량 청산한다. 그 유예가 의미를 가지려면 **경고를 받고도 살아 나오는
   * 판이 실제로 있어야** 한다 — 경고 = 청산이면 유예는 코드에만 있는 장치다.
   *
   * 두 값을 나란히 놓는 것이 이 게이트의 전부다. 경고율만 재면 "전부 청산됐다"도 통과하고,
   * 청산율만 재면 "경고가 아예 안 선다"도 통과한다.
   * 실측(n=1500, 시드창 4개): 경고 22.6~23.9% · 강제청산 1.8~2.3% — 경고받은 판의 90%가
   * 유예 안에 살아 나온다.
   */
  it('마진콜 경고를 받고도 대부분 살아 나온다 — 유예 한 주가 코드에만 있는 장치가 아니다', () => {
    const r = batch(CENSUS_LEVERAGE_RUNS, 'leverage')
    expect(r.marginWarnRate, `경고율 ${(r.marginWarnRate * 100).toFixed(2)}%`).toBeGreaterThan(0.05)
    expect(r.marginCallRate, `강제청산율 ${(r.marginCallRate * 100).toFixed(2)}%`).toBeGreaterThan(0)
    expect(r.marginCallRate, `경고 ${(r.marginWarnRate * 100).toFixed(2)}% → 청산 ${(r.marginCallRate * 100).toFixed(2)}%`)
      .toBeLessThan(r.marginWarnRate * 0.5)
  })

  /**
   * **대출 문턱에 닿는다.** 예전 주석은 "막고 있는 것은 문턱이 아니라 sim 전략이 대출을
   * 부르지 않는다는 사실"이라고 적혀 있었다 — `leverage`가 생긴 지금 그 문장은 거짓이다.
   *
   * 지금 재는 것은 하나다: `BALANCE.loan.minTier`의 자산선(1억)이 실제 플레이에서 닿는
   * 높이인가. 최종 자산이 아니라 `trackers.peakAssets`로 재야 한다 — 닿았다가 잃으면
   * 최종 자산에는 흔적이 남지 않는다. 실측(각 500판): leverage 29.6% · panic 15.6% ·
   * momentum 9.0% · random 2.8% · buyhold 1.0%.
   *
   * **한계(Fix Round 2 재리뷰):** 이 게이트는 도달 여부만 보고 **도달 난이도는 못 잰다** —
   * `loan.minTier`를 3 → 1로 **낮춰도** 그린이다(더 쉽게 닿을 뿐이므로). 난이도까지
   * 고정하면 밸런스 튜닝을 과하게 묶으므로 일부러 조이지 않았다.
   */
  it('대출 문턱 자체에 도달한다 — 신용을 쓰지 않는 전략도 닿는다 (Ruling 16)', () => {
    const floor = BALANCE.tierMins[BALANCE.loan.minTier]
    expect(floor, '대출 문턱 티어의 자산선').toBeGreaterThan(0)
    const reach = (['panic', 'buyhold'] as const).map(st => batch(500, st).loanReachRate)
    expect(Math.max(...reach), `문턱 ${floor}원 도달률 ${reach.map(x => (x * 100).toFixed(1)).join(' / ')}%`)
      .toBeGreaterThan(0)
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
  /**
   * **Fix Round 1 Major 1 — 이 태스크의 헤드라인 주장에 게이트가 없었다.**
   *
   * Task 8은 `BALANCE.grade.cashMul`을 새로 들여 야근 S를 576,000원(턴당 월급의 3.16배)
   * 에서 180,000원으로 내렸다. 그런데 리뷰어가 `cashMul`을 옛 `grade.mul`(0.4~3.2)로
   * 되돌리자 core 1건만 red고 **sim 24/24가 전부 그린**이었다 — 성질을 만들어 놓고
   * 고정하지 않았던 것이다. `labor` 전략은 오직 이 게이트를 위해 존재한다.
   *
   * **비교 대상을 고르는 데 실측이 필요했다.** 브리프가 제안한 "노동 특화 무매매 vs
   * 짙은 노출 투자"(buyhold/labor)는 **구분하지 못한다**: buyhold도 야근이 1순위라
   * 양쪽이 같이 커져 비율이 거의 안 움직인다 — 500판 시드창 6개 실측으로
   * 새 배율 1.274~1.366 / 옛 배율 1.295~1.338로 **범위가 겹친다.**
   * 노동 소득만 분리하려면 **야근을 쓰지 않는 기준선**과 비교해야 한다:
   *
   * | 지표 (n=500, 시드창 6개) | 새 cashMul | 옛 grade.mul |
   * |---|---|---|
   * | `labor / cash` (노동 소득 그 자체) | 1.079 ~ 1.097 | 1.213 ~ 1.233 |
   * | `labor / seedhold` (노동 vs 얇은 투자) | 1.012 ~ 1.034 | 1.130 ~ 1.164 |
   * | `buyhold / labor` (브리프 제안) | 1.274 ~ 1.366 | 1.295 ~ 1.338 (겹침) |
   *
   * 통과선은 두 범위의 **가운데**에 둔다 — 실측값에 딱 붙이지 않되(시드창 변동 흡수)
   * 옛 배율을 통과시킬 만큼 헐겁지도 않게. 여유: 아래 1.15는 현행 최악 창(1.097) 위로
   * 5.3%p, 옛 배율 최선 창(1.213) 아래로 6.3%p다. 1.08은 각각 4.6%p / 5.0%p.
   */
  it('노동이 투자를 압도하지 못한다 — 야근은 무위험 차익거래가 아니다 (Fix Round 1)', () => {
    const labor = batch(500, 'labor')
    const cash = batch(500, 'cash')
    const seedhold = batch(500, 'seedhold')
    // ① 노동 소득 자체의 상한. `labor`와 `cash`는 매매가 같고(하지 않는다) 야근 우선순위만
    //    다르므로, 이 비율이 곧 "카드로 버는 돈이 무매매 기준선을 얼마나 밀어 올리는가"다.
    expect(labor.assetsMedian, `labor/cash ${(labor.assetsMedian / cash.assetsMedian).toFixed(4)}`)
      .toBeLessThan(cash.assetsMedian * 1.15)
    // ② 노동이 **얇은 노출 투자**를 크게 앞지르지 않는다. 지금도 labor가 seedhold를
    //    1~3% 이기지만(보고서 §Fix Round 1 Minor 6 — 어중간한 투자는 성실한 노동만
    //    못하다는 의도된 결과다), 옛 배율에서는 그 격차가 13~16%였다.
    expect(labor.assetsMedian, `labor/seedhold ${(labor.assetsMedian / seedhold.assetsMedian).toFixed(4)}`)
      .toBeLessThan(seedhold.assetsMedian * 1.08)
  })

  it('짙은 노출 투자가 노동 특화 무매매를 확실히 이긴다', () => {
    // 이 태스크의 헤드라인 문장. **`cashMul` 되돌리기는 이 게이트로 잡히지 않는다**
    // (위 표의 buyhold/labor 행 — 두 범위가 겹친다). 여기서 잡는 것은 다른 것이다:
    // 시장의 상승 원천이 죽으면(`fundamentalGrowth → 0` 같은) 짙은 노출의 우위가
    // 사라지고 이 게이트가 red가 된다. 실측 여유: 현행 최악 창 1.274, 통과선 1.15.
    const bh = batch(500, 'buyhold')
    const labor = batch(500, 'labor')
    expect(bh.assetsMedian, `buyhold/labor ${(bh.assetsMedian / labor.assetsMedian).toFixed(4)}`)
      .toBeGreaterThan(labor.assetsMedian * 1.15)
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
    // **다양성(몇 종이 나오는가)은 이 테스트가 더 이상 재지 않는다** — 아래
    // '엔딩 도달 가능성 조사'가 집합 자체를 못박는다(최종 리뷰 M5). 여기 남은 것은
    // 쏠림 하나다.
    const r = batch(300, 'random')
    expect(Math.max(...Object.values(r.endingCounts)) / r.runs).toBeLessThan(0.7)
  })
})

/**
 * 엔딩 도달 가능성 조사 — 최종 리뷰 M5 / Ruling 48.
 *
 * 예전 게이트는 `Object.keys(endingCounts).length >= 4` 하나였다. 그 부등식은 **상단
 * 붕괴를 못 본다**: 실측 5종 중 하나(`wise`)를 도달 불가로 만들어도 4종이 남아
 * sim 27/27이 그대로 green이었다(리뷰어 실측). 8종 중 3종이 이미 0판인 상태에서
 * "4종 이상"은 두 칸의 여유를 그냥 내주는 문턱이었다.
 *
 * 그래서 부등식을 버리고 **집합을 그대로 못박는다** — 위로든(새로 하나가 열림)
 * 아래로든(하나가 닫힘) 달라지면 red다.
 *
 * **이번에 그 집합이 실제로 움직였다.** 직전 판정은 5종(`bank`·`breakeven`·`kimheir`·
 * `savings`·`wise`)이었고 `legend`·`fire`·`super`는 "원인: `takeLoan` 호출부 부재"로
 * 이름을 적어 남겨둔 도달 불가였다. 신용 진입점이 생기고(app의 계좌 화면, 그리고 sim의
 * `leverage` 전략) 그 셋이 전부 실제로 나온다 — 조사 4,360판 기준 `legend` 54판 ·
 * `super` 9판 · `fire` 4판. 그래서 REACHABLE은 **엔딩 8종 전부**가 됐고 UNREACHABLE은
 * 비었다. 도달 불가의 원인을 적어두던 자리는 이제 남길 이름이 없다.
 */
describe('엔딩 도달 가능성 조사 (최종 리뷰 M5, Ruling 48)', () => {
  /** 이 조사가 훑는 배치 목록. 전부 이 파일의 다른 게이트가 이미 도는 (runs, strategy)
   *  조합이라 `batch`의 메모가 그대로 먹는다 — 조사 자체의 추가 실행 비용은 0이다.
   *
   *  **한 전략당 한 배치만 담는다.** 모든 배치가 `seed0 = 1`에서 시작하므로
   *  같은 전략의 작은 배치는 큰 배치의 **부분집합**이다 — 둘 다 담으면 같은 판을 두 번
   *  센다. 예전 목록은 `[500,'panic']`·`[500,'buyhold']`·`[300,'random']`·
   *  `[1500,'leverage']`에 각각 `[300,'panic']`·`[200,'buyhold']`·`[200,'random']`·
   *  `[60,'leverage']`을 겹쳐 담아 760판을 이중 계상했다(리뷰 Minor 2). 표본 크기가
   *  거짓이면 "표본이 크다"는 아래 게이트도 거짓이 된다. */
  const CENSUS = [
    [500, 'cash'], [500, 'labor'], [500, 'seedhold'], [500, 'buyhold'], [500, 'panic'],
    [300, 'random'], [60, 'momentum'], [CENSUS_LEVERAGE_RUNS, 'leverage'],
  ] as const satisfies readonly (readonly [number, Strategy])[]

  /** 조사가 실제로 도는 **서로 다른** 판수. 위 목록에서 유도하지 않고 손으로 적는다 —
   *  유도하면 목록이 쪼그라들어도 기대값이 같이 따라 내려가 아무것도 못 잡는다. */
  const CENSUS_RUNS = 4360

  /** 지금 **실제로 도달 가능한** 엔딩. 실측(2026-08-27, 아래 조사 4,360판)이 출처다.
   *  지금은 `ENDING_IDS` 전체와 같지만 **일부러 손으로 적는다** — `ENDING_IDS`에서
   *  유도하면 "엔딩 목록에 있는 것은 도달 가능하다"는 동어반복이 되어, 하나가 닫혀도
   *  기대값이 같이 따라 내려가 아무것도 잡지 못한다. */
  const REACHABLE = [
    'bank', 'breakeven', 'fire', 'kimheir', 'legend', 'savings', 'super', 'wise',
  ] as const
  /** 지금 **도달 불가능한** 엔딩. 비어 있다 — 8종 전부가 조사에서 실제로 나온다.
   *  다시 채워야 할 일이 생기면 그때는 **원인과 함께** 이름을 적어라(예전에는
   *  `legend`·`fire`·`super`가 "takeLoan 호출부 부재"라는 이유로 여기 있었다). */
  const UNREACHABLE: readonly string[] = []

  /** 조사 전체의 엔딩별 판수 합계와, 같은 조사에서 **따로 계산된** 파산 판수. */
  function census(): { counts: Record<string, number>; runs: number; bankrupts: number } {
    const counts: Record<string, number> = {}
    let runs = 0
    let bankrupts = 0
    for (const [n, st] of CENSUS) {
      const r = batch(n, st)
      runs += r.runs
      bankrupts += Math.round(r.bankruptRate * r.runs)
      for (const [id, c] of Object.entries(r.endingCounts)) counts[id] = (counts[id] ?? 0) + c
    }
    return { counts, runs, bankrupts }
  }

  it('조사 표본이 실제로 크다 — 표본이 쪼그라들면 아래 두 게이트가 공허해진다', () => {
    const { runs } = census()
    expect(runs).toBe(CENSUS_RUNS)
    // 세는 판이 **서로 다른 판**인지도 함께 본다. 같은 전략을 두 번 담으면 위 단언은
    // 여전히 통과할 수 있지만(숫자를 같이 올리면 된다) 표본은 커지지 않는다.
    expect(new Set(CENSUS.map(([, st]) => st)).size, '한 전략이 두 번 담겨 판이 이중 계상된다')
      .toBe(CENSUS.length)
  })

  it('분류표가 엔딩 전수를 덮는다 — 새 엔딩을 추가하면 분류를 강요당한다', () => {
    expect([...REACHABLE, ...UNREACHABLE].sort()).toEqual([...ENDING_IDS].sort())
  })

  it('도달 가능한 엔딩 집합이 정확히 그 8종이다 (위로도 아래로도 달라지면 red)', () => {
    const { counts } = census()
    // `Object.keys`는 0판인 엔딩을 애초에 담지 않지만, 어떤 이유로든 0이 기록되는
    // 구현으로 바뀌어도 이 게이트가 헐거워지지 않도록 0을 명시적으로 걸러낸다.
    const observed = Object.entries(counts).filter(([, n]) => n > 0).map(([id]) => id).sort()
    expect(observed, `조사 실측: ${JSON.stringify(counts)}`).toEqual([...REACHABLE].sort())
  })

  it('도달 가능한 8종은 전부 실제로 판수가 있다 — 목록만 적어두고 0판이면 red', () => {
    const { counts } = census()
    for (const id of REACHABLE) {
      expect(counts[id] ?? 0, `${id}가 조사 4,360판에서 한 번도 안 나왔다`).toBeGreaterThan(0)
    }
  })

  /**
   * **상단 3종의 여유가 얼마나 얇은지를 숫자로 남긴다.**
   *
   * 위 두 게이트는 "0판이 아니다"까지만 본다. `fire`는 조사 4,360판에서 **4판**이라
   * 그 통과선 바로 위에 있고, 밸런스가 조금만 눌려도 0으로 떨어진다 — 그때 red가 되는
   * 것은 옳지만, **얼마나 아슬아슬했는지를 아무도 모르는 채로** red가 되면 원인을 다시
   * 찾아야 한다. 그래서 실측 판수를 실패 메시지에 담아 기록한다.
   *
   * 하한은 실측값에 붙이지 않는다(시드창마다 `fire` 3~6판, `super` 8~11판, `legend`
   * 42~59판으로 흔들린다). 잡으려는 것은 "상단이 통째로 닫혔다"이지 "몇 판 줄었다"가
   * 아니다 — 통계적 잡음까지 못박으면 밸런싱 한 번에 의미 없이 red가 된다.
   */
  it('상단 3종(legend·fire·super)이 실제로 나온다 — 그리고 이 조사에서는 전부 leverage 몫이다', () => {
    const { counts } = census()
    const top = ['legend', 'fire', 'super'] as const
    const seen = top.map(id => `${id} ${counts[id] ?? 0}판`).join(' · ')
    for (const id of top) {
      expect(counts[id] ?? 0, `${seen} — ${id}가 닫혔다`).toBeGreaterThan(0)
    }
    /**
     * **"신용이 없으면 원리적으로 닫힌다"는 셋 중 어느 것에도 그대로 쓸 수 없다.**
     * 예전 제목이 그렇게 말했고 그것은 거짓이었다(리뷰 Major 3). 실제로 참인 것만 적는다.
     *
     * - `legend`(파산): 빚이 없으면 총자산은 **0 미만이 될 수 없다** — 현금은 0에서
     *   잘리고(`effects.ts`/`economy.ts`) 보유 평가액은 음수가 못 된다. 남는 구멍은
     *   '정확히 0'뿐이고, 신용 없는 대조군 23,800판(7전략 × 400 seed0=500001,
     *   7전략 × 3000 seed0=700001)에서 0판이었다.
     * - `super`(5억): **신용 없이도 나온다.** 반례 `playOne(500355, 'momentum')` →
     *   `super`, 자산 749,493,552원, `usedMargin=false`, `peakLoan=0`. 대조군 23,800판에서
     *   3판(0.013%) 관측됐다.
     * - `fire`(10억 + 퇴사): 대조군 23,800판에서 0판이다. 다만 **불가능함이 보여진 것은
     *   아니다** — 반례를 못 찾았을 뿐이다. `super`가 신용 없이 7.5억까지 갔으므로
     *   10억이 원리적으로 닫혀 있다고 볼 근거도 없다.
     *
     * 요약하면 참인 문장은 "신용이 상단 엔딩을 압도적으로 연다"이지
     * "신용 없이는 불가능하다"가 아니다. 아래 두 단언이 그 참인 쪽만 고정한다.
     */
    // (1) 이 조사가 담은 상단 3종은 전부 `leverage` 배치에서 나왔다 — 나머지 일곱
    //     전략 몫 2,860판의 기여가 0이라는 뜻이다. 이 등식이 깨지면 코드가 고장난 게
    //     아니라 **위 문단과 README의 문장을 다시 재야 한다**는 신호다.
    const lev = batch(CENSUS_LEVERAGE_RUNS, 'leverage').endingCounts
    for (const id of top) {
      expect(lev[id] ?? 0, `${id}: 조사 ${counts[id] ?? 0}판 중 leverage 몫은 ${lev[id] ?? 0}판이다`)
        .toBe(counts[id] ?? 0)
    }
    // (2) 그 leverage 배치가 실제로 신용을 쓴다 — 대출을 그만두면 여기서 red다
    //     (보고서 §뮤테이션 MU-S1).
    expect(batch(CENSUS_LEVERAGE_RUNS, 'leverage').marginRate, '상단 3종의 출처는 신용이다')
      .toBeGreaterThan(0)
  })

  it('legend 판수와 파산 판수가 일치한다 — 판정 경로가 갈라지지 않았다', () => {
    // `legend`는 `bankrupt || assets <= 0`일 때만 나온다. 두 수를 **서로 다른 경로로**
    // 세서 맞대면 판정 버그가 드러난다: 엔딩 쪽은 core의 `judgeEnding`이 고른 id를 세고,
    // 파산 쪽은 sim이 최종 상태에서 직접 잰 `totalAssets(s) <= 0`을 센다(runner.ts).
    // (예전에는 sim의 `bankrupt`가 `ending === 'legend'`였다 — 그 정의로는 이 단언이
    //  자기 자신을 비교하는 자기충족 문장이 된다.)
    // **이 게이트는 그 되돌림을 못 잡는다** — 완주한 판에서 두 정의는 절대 어긋나지 않아서,
    // 옛 정의로 되돌려도 여기는 그대로 green이다(실측). 되돌림을 잡는 지킴이는
    // `bankruptcy.test.ts`이고, 이 단언은 **core의 판정 자체가 갈라졌는지**를 본다.
    const { counts, bankrupts } = census()
    expect(counts['legend'] ?? 0, `legend ${counts['legend'] ?? 0}판 vs 파산 ${bankrupts}판`)
      .toBe(bankrupts)
    expect(bankrupts, '파산이 0건이면 위 단언이 0 === 0으로 공허하게 통과한다').toBeGreaterThan(0)
  })
})

/**
 * Task 8 — "전략이 행동력을 어떻게 쓰는가"가 전략마다 실제로 다른지 실측으로 고정한다.
 * 일곱 전략이 전부 같은 카드를 고르면 위의 전략 비교 게이트들은 전략 차이가 아니라
 * 매매 차이만 재게 되고, `CARD_PREF` 표는 있으나 마나 한 장식이 된다.
 */
describe('전략별 행동력 사용이 실제로 다르다 (Task 8)', () => {
  const ALL = ['cash', 'labor', 'seedhold', 'buyhold', 'momentum', 'random', 'panic', 'leverage'] as const satisfies readonly Strategy[]
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
    // 실측 최소 거리는 labor vs buyhold의 0.262다(둘 다 야근이 1순위라 가장 가깝다).
    // `leverage`가 가장 가까운 상대는 panic(0.429)이고 나머지는 전부 0.43 이상이다 —
    // 기업분석·커뮤니티를 위에 두고 인맥 카드(forum·study)를 맨 뒤로 미는 표라서
    // 어느 기존 전략과도 상위 두 장이 겹치지 않는다.
    expect(pairs).toEqual([])
  })

  /**
   * **Fix Round 2 Minor 1 — 값이 아니라 연결(coupling)을 잰다.**
   *
   * 이 테스트는 두 번 헛발질했다. ①처음에는 `35 > 29`, `30 > 20`으로 **순서만** 재서
   * 리터럴 하드코딩이 그대로 통과했다. ②다음에는 `toBe(shakenMax + 6)`로 등가 비교를
   * 했는데, 그건 **틀린 리터럴만** 잡고 "우연히 지금 유도값과 같은 리터럴"
   * (`{ mental: 35, condition: 30 }`)은 여전히 통과했다 — 재리뷰어가 실제로 재현했다.
   *
   * 고정해야 하는 것은 임계의 **값**이 아니라 그 값이 `BALANCE`에서 **온다는 사실**이다.
   * 그래서 임계를 순수 함수 `recoveryAt(balance)`로 두고, **가짜 밸런스를 밀어 넣어
   * 결과가 따라 움직이는지**를 본다. 인자를 무시하는 구현(=리터럴)은 입력을 바꿔도
   * 값이 안 움직이므로 이 테스트를 **통과할 수 없다**(뮤테이션 MU-J / MU-J2 — 보고서).
   *
   * 두 축을 따로 미는 것도 의도적이다. 한 축만 고정하고 다른 축은 공허하게 두는 실수가
   * 이 저장소에서 반복됐다 — 멘탈을 밀면 멘탈만, 컨디션을 밀면 컨디션만 움직여야 한다.
   */
  it('회복 임계가 BALANCE에 실제로 연결돼 있다 — 리터럴 구현은 통과할 수 없다', () => {
    const base = recoveryAt(BALANCE)
    // 모듈 상수가 그 함수의 결과 그대로여야 한다 — 둘이 갈라지면 sim은 옛 임계로 논다.
    expect(RECOVERY_AT).toEqual(base)

    // ① 흔들림 문턱을 밀면 멘탈 임계만 따라 올라간다.
    const shakier = recoveryAt({
      ...BALANCE,
      mental: { ...BALANCE.mental, shakenMax: BALANCE.mental.shakenMax + 21 },
    })
    expect(shakier.mental, '흔들림 문턱을 올렸는데 멘탈 임계가 안 움직인다').toBeGreaterThan(base.mental)
    expect(shakier.condition, '멘탈 문턱이 컨디션 임계를 오염시킨다').toBe(base.condition)

    // ② 강제 스킵 문턱을 밀면 컨디션 임계만 따라 올라간다.
    const sleepier = recoveryAt({
      ...BALANCE,
      condition: { ...BALANCE.condition, forcedSkipBelow: BALANCE.condition.forcedSkipBelow + 17 },
    })
    expect(sleepier.condition, '스킵 문턱을 올렸는데 컨디션 임계가 안 움직인다').toBeGreaterThan(base.condition)
    expect(sleepier.mental, '컨디션 문턱이 멘탈 임계를 오염시킨다').toBe(base.mental)

    // ③ 임계는 문턱보다 **위**다 — 한 턴 앞서 반응한다는 설계 그 자체(strategies.ts 주석).
    expect(base.mental).toBeGreaterThan(BALANCE.mental.shakenMax)
    expect(base.condition).toBeGreaterThan(BALANCE.condition.forcedSkipBelow)
  })
})

/**
 * **`leverage`가 이름값을 하는가** — 신용을 다루는 세 갈래를 각각 직접 부른다.
 *
 * 배치 통계(위의 `marginRate`·`marginWarnRate`)는 "전체적으로 그런 일이 일어난다"까지만
 * 말한다. 세 갈래 중 하나가 죽어도 나머지 둘이 통계를 그대로 유지할 수 있으므로
 * (예: 경고 대응을 통째로 지워도 신용 사용률은 그대로다), 갈래마다 상태를 만들어
 * `act`를 한 번 부르고 **그 한 번이 무엇을 했는지**를 본다.
 *
 * 각 상태는 전제(한도가 실제로 열려 있는가 / 담보가 실제로 무너져 있는가)를 core의
 * `maxLoan`·`marginShortfall`로 **먼저 단언한다** — 전제가 성립하지 않으면 뒤의 단언은
 * 우연히 통과하는 문장이 된다.
 */
describe('leverage의 신용 조작 세 갈래', () => {
  const rand = () => new Rand(createRng(0x5eed))
  /** 티어·현금·빚·보유를 갈아 끼운 판. `initGame`의 나머지(가격·국면·슬롯)는 그대로 둔다. */
  function rig(seed: number, over: {
    tier?: number; cash?: number; loan?: number; qty?: number; due?: number | null
  }): GameState {
    const s = initGame(seed)
    const price = priceOf(s, 'sjc')
    const qty = over.qty ?? 0
    return {
      ...s,
      player: {
        ...s.player,
        tier: (over.tier ?? s.player.tier) as GameState['player']['tier'],
        cash: over.cash ?? s.player.cash,
        loan: over.loan ?? 0,
        holdings: qty > 0 ? [{ stockId: 'sjc', qty, avgCost: price, heldTurns: 10 }] : [],
        marginCallDueTurn: over.due ?? null,
      },
    }
  }

  it('① 한도가 열려 있으면 빌려서 산다', () => {
    const s = rig(4, { tier: 3, cash: 200_000_000 })
    expect(maxLoan(s), '전제: 한도가 실제로 열려 있어야 한다').toBeGreaterThan(0)
    const { state } = act(s, 'leverage', rand())
    expect(state.player.loan, '대출을 일으키지 않았다').toBeGreaterThan(0)
    expect(state.player.holdings.length, '빌린 돈을 시장에 넣지 않았다').toBeGreaterThan(0)
  })

  it('② 티어가 모자라면 빌리지 않는다 — TIER_LOCKED를 삼키는 것이 아니라 애초에 안 부른다', () => {
    const s = rig(4, { tier: BALANCE.loan.minTier - 1, cash: 200_000_000 })
    expect(maxLoan(s), '전제: 티어락이 걸려 한도가 0이어야 한다').toBe(0)
    expect(act(s, 'leverage', rand()).state.player.loan).toBe(0)
  })

  it('③ 마진콜 경고가 서면 팔아서 갚는다 — 담보가 멀쩡해도 경고 하나로 움직인다', () => {
    // 담보는 건전하다(빚 1천만 · 보유 1억). 그런데도 경고가 서 있으면 물러난다 —
    // 이 상태를 고른 이유는 경고 갈래를 **부족액 갈래(④)와 분리해서** 재기 위해서다.
    const s = rig(4, { tier: 3, cash: 0, loan: 10_000_000, qty: 1500, due: 2 })
    expect(marginShortfall(s), '전제: 이 상태의 담보는 부족하지 않아야 한다').toBe(0)
    expect(s.player.marginCallDueTurn, '전제: 경고가 서 있어야 한다').not.toBeNull()
    const { state } = act(s, 'leverage', rand())
    expect(state.player.loan, '경고를 받고도 빚을 그대로 뒀다').toBe(0)
    expect(state.player.holdings, '경고를 받고도 포지션을 그대로 뒀다').toEqual([])
  })

  it('④ 담보가 무너지면 경고가 서기 전에 먼저 줄인다', () => {
    const s = rig(4, { tier: 3, cash: 0, loan: 100_000_000, qty: 1500, due: null })
    expect(marginShortfall(s), '전제: 담보가 실제로 모자라야 한다').toBeGreaterThan(0)
    const { state } = act(s, 'leverage', rand())
    expect(state.player.loan, '부족액을 보고도 빚을 안 줄였다')
      .toBeLessThan(s.player.loan)
    expect(marginShortfall(state), '줄이고도 여전히 담보가 모자란다').toBe(0)
  })
})

/**
 * **`leverage`가 대조군과 실제로 다르게 노는가** — 이름만 다른 전략을 Major로 취급해 온
 * 저장소의 전례 때문에, 매매 패턴·자산 상단·신용을 전부 대조군과 **비율로** 맞댄다.
 * 리터럴 기준선을 박으면 밸런싱 한 번에 무의미해지므로 전부 다른 배치와의 관계로 쓴다.
 */
describe('leverage는 대조군과 다르게 논다', () => {
  const lev = () => batch(CENSUS_LEVERAGE_RUNS, 'leverage')

  it('갈아타지 않는다 — 판당 주문 수가 뇌동매매의 절반 아래다', () => {
    // 실측(판당 주문): panic 312.1 · momentum 149.8 · buyhold 82.7 · leverage 62.6.
    // 레버리지는 종목을 바꾸는 것이 아니라 **같은 종목의 크기**를 빚으로 바꾼다.
    const l = lev(), p = batch(500, 'panic')
    expect(l.avgTrades, `leverage ${l.avgTrades.toFixed(1)} / panic ${p.avgTrades.toFixed(1)}`)
      .toBeLessThan(p.avgTrades * 0.5)
  })

  it('빚이 판의 상단을 연다 — 최고자산 중앙값과 문턱 도달률이 대조군을 넘는다', () => {
    const l = lev(), p = batch(500, 'panic'), b = batch(500, 'buyhold')
    const rival = Math.max(p.peakAssetsMedian, b.peakAssetsMedian)
    expect(l.peakAssetsMedian, `leverage ${l.peakAssetsMedian} / 대조군 최고 ${rival}`)
      .toBeGreaterThan(rival * 1.15)
    expect(l.loanReachRate, `문턱 도달 leverage ${(l.loanReachRate * 100).toFixed(1)}% / panic ${(p.loanReachRate * 100).toFixed(1)}%`)
      .toBeGreaterThan(p.loanReachRate * 1.5)
  })

  it('그 상단이 공짜가 아니다 — 중앙값은 오히려 짙은 노출 존버보다 낮다', () => {
    // 이 게임이 가르치려는 것은 "빚을 지면 부자가 된다"가 아니다. 레버리지는 분포의
    // 꼬리를 양쪽으로 늘릴 뿐이고(위로는 super·fire, 아래로는 legend), 중앙값은
    // 이자와 강제청산에 깎인다. 실측: leverage 0.31억 vs buyhold 0.41억.
    // 이 단언이 뒤집히면 신용이 무위험 차익거래가 됐다는 뜻이다.
    const l = lev(), b = batch(500, 'buyhold')
    expect(l.assetsMedian, `leverage ${l.assetsMedian} / buyhold ${b.assetsMedian}`)
      .toBeLessThan(b.assetsMedian)
  })
})

import { describe, it, expect } from 'vitest'
import { playOne, runBatch } from './runner'
import { act } from './strategies'
import {
  BALANCE, initGame, advanceTurn, resolveChoice, loadEvents, cardsPerTurn, Rand, createRng,
  buy, maxBuyQty, priceOf, type GameState,
} from '@bb/core'

/**
 * 2턴차에 sjc를 `qtyOf(state)`만큼 사고 156턴 존버한다. 매 턴 '존버' 카드만 쓴다.
 * 매수 규모만 다른 두 판을 비교하기 위한 하네스 — 전략은 그대로 두고 노출만 바꾼다.
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
      s = advanceTurn(s, ['hodl'].slice(0, cardsPerTurn(s)))
    }
    if (s.trackers.shakenTurns > 0) shakenRuns++
    shakenTurns += s.trackers.shakenTurns
  }
  return { shakenRate: shakenRuns / seeds, avgShakenTurns: shakenTurns / seeds }
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
      s = advanceTurn(state, cards.slice(0, cardsPerTurn(state)))
    }
  })
})

describe('runBatch', () => {
  it('리포트 필드가 채워진다', () => {
    const r = runBatch(60, 'seedhold')
    expect(r.runs).toBe(60)
    expect(Object.values(r.endingCounts).reduce((a, b) => a + b, 0)).toBe(60)
    expect(r.assetsP10).toBeLessThanOrEqual(r.assetsMedian)
    expect(r.assetsMedian).toBeLessThanOrEqual(r.assetsP90)
  })

  // 밸런스 게이트 — 스펙 §8.2
  it('두 존버 전략 모두 파산율이 15% 미만이다', () => {
    // seedhold: 시드의 90%만 넣고 방치 (얇은 노출) / buyhold: 매 턴 현금 90% 투입 (짙은 노출).
    // 노출이 10배 넘게 차이 나므로 둘 다 재야 "사놓고 버티면 망하지 않는다"가 성립한다.
    expect(runBatch(200, 'seedhold').bankruptRate, 'seedhold').toBeLessThan(0.15)
    expect(runBatch(200, 'buyhold').bankruptRate, 'buyhold').toBeLessThan(0.15)
  })
  it('panic이 buyhold(노출을 맞춘 존버)보다 확실히 나쁘다', () => {
    // 재리뷰 §5: panic은 매 턴 자본의 95%를 굴리므로 시장 노출이 buyhold(진짜 존버)와
    // 거의 같다. 옛 buyhold(=seedhold, 노출 40%)와 비교하면 "뇌동매매는 손해다"가 -1%로
    // 재어졌지만, 노출을 맞춘 buyhold와 비교하면 **중앙값 -28%**다. 처벌의 크기를
    // 제대로 재려면 비교 대상이 노출을 맞춘 벤치마크여야 한다.
    const panic = runBatch(200, 'panic')
    const hold = runBatch(200, 'buyhold')
    expect(panic.assetsMedian).toBeLessThan(hold.assetsMedian * 0.85)
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
    const bh = runBatch(200, 'seedhold')
    const cash = runBatch(200, 'cash')
    expect(bh.assetsMedian).toBeGreaterThan(cash.assetsMedian * 1.03)
  })
  it('어떤 종목도 시드와 무관하게 확정 승리·확정 패배가 아니다', () => {
    // Fix Round 1의 핵심 게이트. 이전에는 에코프로형제가 300시드 전부에서 초기가 아래로
    // 끝났고(상승률 0%), 10종 중 5종이 상승률 6% 이하였다 — 플레이어가 배우는 것이
    // "위험을 어떻게 다룰까"가 아니라 "어떤 티커를 피할까"라는 정답표가 된다.
    // 자산 분위수로는 안 보이는 결함이라 리포트에 종목별 최종가 배율을 추가했다.
    const r = runBatch(200, 'random')
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
    const r = runBatch(200, 'random')
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
    const r = runBatch(200, 'buyhold')
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
  it('엔딩이 한 종류로 쏠리지 않는다', () => {
    // Ruling 53 — 브리프 기본값(seed0=1, runs=300) 그대로. 이전 라운드에서 seed0=5000으로
    // 옮겨 3종 이상을 억지로 만들었으나, 13개 seed0 창을 훑어보면 3종이 뜨는 창도 3번째
    // 엔딩이 300판 중 1~3판뿐인 동전던지기였다 — 게이트를 우회한 것이지 결함을 고친 게
    // 아니었다. 시드 창은 앞으로도 갈아끼우지 않는다.
    //
    // Task 24에서 원인(시장 기대수익률 음수 + 엔딩 경계가 3년치 월급을 무시한 시드머니
    // 기준)을 고친 뒤 단언을 원래 값인 4종으로 되돌렸다. 현재 실측: savings/breakeven/
    // bank/wise/kimheir 5종, 최다 33%.
    const r = runBatch(300, 'random')
    expect(Object.keys(r.endingCounts).length).toBeGreaterThanOrEqual(4)
    expect(Math.max(...Object.values(r.endingCounts)) / r.runs).toBeLessThan(0.7)
  })
})

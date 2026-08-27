import { describe, it, expect } from 'vitest'
import { makeState, makeStock, makeStockDef } from '../testkit'
import { BALANCE } from '../balance'
import { investmentRoi, noTradeBaseline, totalAssets, fee, tax } from './accounting'
import { advanceTurn, initGame } from './advance'
import { buy, sell, averageDown } from './trade'
import { resolveChoice } from '../events/engine'
import { loadEvents } from '../events/content'

describe('무매매 기준선 (최종 리뷰 C1)', () => {
  it('기준선은 시드머니 + 누적 순월급이다', () => {
    const s = makeState()
    expect(noTradeBaseline(s)).toBe(BALANCE.seedMoney)
    const paid = { ...s, trackers: { ...s.trackers, netPayroll: 5_000_000 } }
    expect(noTradeBaseline(paid)).toBe(BALANCE.seedMoney + 5_000_000)
  })

  it('월급만 받고 매매를 안 했으면 수익률이 0%다 — 시드머니 기준이면 +1,000%가 된다', () => {
    // 3년 만근(39개월)한 무매매 플레이어의 최종 상태를 그대로 만든다.
    const netPayroll = BALANCE.employedNet * 39
    const s = makeState({
      player: { ...makeState().player, cash: BALANCE.seedMoney + netPayroll, holdings: [] },
      trackers: { ...makeState().trackers, netPayroll },
    })
    expect(investmentRoi(s)).toBe(0)
    // 옛 식(시드머니 기준)이 무엇을 냈는지 같이 고정해 둔다 — 이 테스트가 지키는 게
    // '작은 수'가 아니라 '기준선을 바꿨다'라는 사실임을 분명히 하기 위해서다.
    const oldRoi = ((totalAssets(s) - BALANCE.seedMoney) / BALANCE.seedMoney) * 100
    expect(oldRoi).toBeGreaterThan(900)
  })

  it('기준선보다 많으면 양수, 적으면 음수다', () => {
    const base = makeState({ trackers: { ...makeState().trackers, netPayroll: 1_000_000 } })
    const rich = { ...base, player: { ...base.player, cash: 5_000_000 } }   // 기준선 4,000,000
    const poor = { ...base, player: { ...base.player, cash: 3_000_000 } }
    expect(investmentRoi(rich)).toBeCloseTo(25, 6)
    expect(investmentRoi(poor)).toBeCloseTo(-25, 6)
  })

  it('기준선이 0 이하면 0을 돌려준다 (0으로 나누지 않는다)', () => {
    const s = makeState({ trackers: { ...makeState().trackers, netPayroll: -BALANCE.seedMoney } })
    expect(noTradeBaseline(s)).toBe(0)
    expect(investmentRoi(s)).toBe(0)
  })

  it('스스로 한 주도 사지 않고 156턴을 완주해도 수익률이 세 자릿수가 되지 않는다', () => {
    // 존버 카드만 고르고 매수 주문은 한 번도 내지 않는다. 그래도 완전한 무매매는 아니다 —
    // buyStockPct 이벤트가 강제로 사게 하는 경로가 남아 있다(Ruling 72). 그래서
    // '보유 0'이 아니라 '노출이 작다'로 검사한다.
    const pool = loadEvents()
    let s = initGame(7)
    while (s.status === 'playing') {
      while (s.pendingChoices.length > 0) s = resolveChoice(s, s.pendingChoices[0]!.eventId, 0, pool)
      // Task 6부터 슬롯 밖 카드는 거부되므로, '존버'가 이번 턴 회복 슬롯에 있는 상황을
      // 직접 만든다 — 이 테스트의 의도(매 턴 존버만 고른다)를 그대로 유지하기 위해서다.
      s = advanceTurn({ ...s, slots: { ...s.slots, recovery: { cardId: 'hodl', grade: 'C' } } }, ['hodl'])
    }
    expect(totalAssets(s)).toBeGreaterThan(20_000_000)  // 월급은 실제로 쌓였다
    // 실측(seed 7): 총자산 32,062,426 / 기준선 31,470,000 → +1.9%.
    // 옛 식(시드머니 기준)이라면 같은 판이 +968.7%다.
    expect(Math.abs(investmentRoi(s))).toBeLessThan(50)
  })
})

describe('거래 트래커', () => {
  it('매수하면 수수료가 누적되고 거래 횟수가 1 늘어난다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
      stocks: [makeStock({ id: 'sjc', price: 10000 })],
      player: { cash: 1_000_000 },
    })
    const after = buy(s, 'sjc', 10)
    expect(after.trackers.feesPaid).toBeGreaterThan(0)
    expect(after.trackers.tradeCount).toBe(1)
  })
  it('매도하면 수수료와 세금이 둘 다 누적된다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
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

  // MU3 대응 — 위 두 테스트는 feesPaid/taxPaid가 0보다 큰지만 본다. `feesPaid += 1`처럼
  // 엉터리로 누적해도 통과한다. buy/sell이 실제로 낸 수수료·세금과 정확히 같은 금액을
  // 누적하는지 fee()/tax()로 독립 계산해 고정한다.
  it('누적된 수수료·세금이 fee()/tax()로 독립 계산한 값과 정확히 같다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc' })],
      stocks: [makeStock({ id: 'sjc', price: 10000 })],
      player: { cash: 1_000_000 },
    })
    const grossBuy = 10000 * 10
    const afterBuy = buy(s, 'sjc', 10)
    expect(afterBuy.trackers.feesPaid).toBe(fee(grossBuy))

    const afterSell = sell(afterBuy, 'sjc', 10)
    const grossSell = afterBuy.stocks.find(x => x.id === 'sjc')!.price * 10
    expect(afterSell.trackers.feesPaid).toBe(fee(grossBuy) + fee(grossSell))
    expect(afterSell.trackers.taxPaid).toBe(tax(grossSell))
  })

  // MU6 대응 — 위 낙폭 테스트는 낙폭이 커지는 방향만 본다. 자산이 떨어졌다가 다시
  // 회복(또는 신고점 경신)해도 역대 최대 낙폭이 줄어들지 않는지 고정한다.
  it('자산이 회복돼도 최대 낙폭은 줄지 않는다', () => {
    const pool = loadEvents()
    const resolvePending = (state: ReturnType<typeof advanceTurn>) => {
      let s = state
      while (s.pendingChoices.length > 0) s = resolveChoice(s, s.pendingChoices[0]!.eventId, 0, pool)
      return s
    }
    let s = makeState({ player: { cash: 10_000_000 } })
    s = resolvePending(advanceTurn(s, []))
    s = resolvePending(advanceTurn({ ...s, player: { ...s.player, cash: 5_000_000 } }, [])) // 50% 낙폭
    const ddAfterDrop = s.trackers.maxDrawdownPct
    expect(ddAfterDrop).toBeGreaterThan(30)
    // 신고점까지 완전히 회복한다
    s = resolvePending(advanceTurn({ ...s, player: { ...s.player, cash: 20_000_000 } }, []))
    expect(s.trackers.maxDrawdownPct).toBe(ddAfterDrop)
  })

  // MU7 대응 — 총자산이 정확히 0인 파산 경로에서 0으로 나누어 NaN이 되지 않는지 고정한다.
  it('총자산이 0이 되는 파산 경로에서도 낙폭이 NaN이 아니다', () => {
    const s = makeState({ player: { cash: 0, loan: 0, holdings: [] } })
    const after = advanceTurn(s, [])
    expect(Number.isFinite(after.trackers.maxDrawdownPct)).toBe(true)
    expect(after.trackers.maxDrawdownPct).toBe(0)
    expect(Number.isFinite(after.trackers.peakAssets)).toBe(true)
  })

  // MU9 대응 — averageDown은 내부에서 buy를 부르므로 tradeCount가 늘어나는 게 맞지만,
  // averageDown 자체가 따로 또 늘리면(이중 계상) 물타기 한 번에 2가 늘어난다.
  it('물타기 한 번에 거래 횟수가 정확히 1 늘어난다', () => {
    const s = makeState({
      stockDefs: [makeStockDef({ id: 'sjc', initialPrice: 5000, fundamental: 5000 })],
      stocks: [makeStock({ id: 'sjc', price: 5000 })],
      player: { cash: 1_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }] },
    })
    const after = averageDown(s, 'sjc', 500_000)
    expect(after.trackers.tradeCount).toBe(s.trackers.tradeCount + 1)
  })
})

describe('최대 낙폭 100% 상한 (Fix Round 1 — 리뷰 Major)', () => {
  // T-B9(advance.test.ts)와 같은 담보 강제청산 시나리오를 재사용한다. 담보(현금+평가액)가
  // 대출×callRatio에 못 미치면 보유를 전량 청산해 상환하고, 그래도 못 갚은 빚이 남으면
  // 총자산이 음수가 된다 — 클램프가 없으면 (peak-assets)/peak*100이 100을 가볍게 넘는다.
  //
  // initGame 직후(1턴째)에 곧바로 마진콜을 걸면 trackers.peakAssets가 아직 0이라
  // peak>0 가드가 먼저 걸려 dd가 0으로 막혀버려서 오버플로 경로 자체를 타지 않는다
  // (리뷰어가 실측한 150%대는 T-B9를 그대로 썼는데 왜 이 파일에서 재현이 안 됐는지가
  // 바로 이 지점이었다). 그래서 정상적인 1턴을 먼저 흘려 peak을 양수로 만든 다음,
  // 그 위에서 마진콜을 건다.
  const pool = loadEvents()
  const resolvePending = (state: ReturnType<typeof advanceTurn>) => {
    let s = state
    while (s.pendingChoices.length > 0) s = resolveChoice(s, s.pendingChoices[0]!.eventId, 0, pool)
    return s
  }

  it('peak이 이미 양수로 서 있는 상태에서 담보 강제청산으로 순자산이 크게 음수가 돼도 낙폭은 100%를 넘지 않는다', () => {
    const base = initGame(1)
    let s = resolvePending(advanceTurn(base, [])) // 1턴 정상 진행 — peakAssets를 양수로 세운다
    expect(s.trackers.peakAssets).toBeGreaterThan(0) // 전제 조건: 오버플로 경로를 실제로 태우려면 peak > 0이어야 한다
    // 담보 10만 << 대출×1.3. marginCallDueTurn을 이번 턴으로 직접 세워, 지난주에 이미
    // 경고를 받은 계좌로 만든다 — 마진콜은 한 주 유예를 주므로 경고 없이는 이번 턴에
    // 청산이 일어나지 않는다(margin.test.ts '마진콜 한 주 유예'가 그 규칙을 고정한다).
    // 이 테스트의 관심사는 유예가 아니라 청산 이후의 낙폭 클램프다.
    s = { ...s, player: { ...s.player, cash: 100_000, loan: 5_000_000, marginCallDueTurn: s.turn } }
    const after = resolvePending(advanceTurn(s, []))
    expect(after.flags['marginCalled']).toBe(true)
    expect(totalAssets(after)).toBeLessThan(0) // 순자산이 실제로 음수인지 먼저 확인(전제 조건)
    // 클램프 없이 계산했을 때 실제로 100%를 넘는지도 같이 고정해 둔다 — 이 테스트가
    // 클램프 없는 raw 값으로도 100% 근처거나 미만이면(공회전) 클램프가 아무것도
    // 잡아내지 못한다.
    const rawDd = ((s.trackers.peakAssets - totalAssets(after)) / s.trackers.peakAssets) * 100
    expect(rawDd).toBeGreaterThan(100)
    expect(after.trackers.maxDrawdownPct).toBeLessThanOrEqual(100)
    expect(after.trackers.maxDrawdownPct).toBeGreaterThanOrEqual(0)
  })
})

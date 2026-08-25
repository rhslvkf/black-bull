import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { BALANCE } from '../balance'
import { investmentRoi, noTradeBaseline, totalAssets } from './accounting'
import { advanceTurn, initGame } from './advance'
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
      s = advanceTurn(s, ['hodl'])
    }
    expect(totalAssets(s)).toBeGreaterThan(20_000_000)  // 월급은 실제로 쌓였다
    // 실측(seed 7): 총자산 32,062,426 / 기준선 31,470,000 → +1.9%.
    // 옛 식(시드머니 기준)이라면 같은 판이 +968.7%다.
    expect(Math.abs(investmentRoi(s))).toBeLessThan(50)
  })
})

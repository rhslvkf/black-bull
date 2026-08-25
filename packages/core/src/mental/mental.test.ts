import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { settleMental, isShaken, mentalResist } from './mental'
import { BALANCE } from '../balance'

/**
 * 보유 손실률을 정확히 pct%로 만든 상태.
 * avgCost는 10000으로 고정하고 가격을 정수 연산으로 내려서 반올림 오차 없이
 * 정확한 손실률을 만든다 (avgCost를 반올림하면 손실률이 근사치가 되어 버린다).
 */
function losing(pct: number, mental = 80) {
  const s = makeState()
  s.player.mental = mental
  s.player.cash = 0
  const price = (10000 * (100 - pct)) / 100
  s.stocks = s.stocks.map(st => (st.id === 's1' ? { ...st, price } : st))
  s.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 10000, heldTurns: 0 }]
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
  it('순자산이 0 이하(지급불능)면 신용을 써도 현금 안정 보너스가 붙지 않는다', () => {
    // cash=0, loan=1,000,000 → totalAssets = -1,000,000 <= 0.
    // drop = margin(-8) * resist(grit=1 기본값 0.94) = -7.52, gain = 0 (보너스 없음)
    // mental = round(50 - 7.52) = 42. cashRatio가 예전처럼 지급불능을 1로 읽었다면
    // gain에 cashCalm(+5)이 더해져 round(50 - 7.52 + 5) = 47이 나왔을 것이다.
    const s = makeState({ player: { ...makeState().player, mental: 50, cash: 0, loan: 1_000_000 } })
    expect(settleMental(s, 0).player.mental).toBe(42)
  })
  it('강인함이 높으면 같은 상황에서 덜 깎인다', () => {
    const weak = losing(40); weak.prevLossPct = 0
    const tough = losing(40); tough.prevLossPct = 0
    tough.player.stats = { ...tough.player.stats, grit: 10 }
    expect(settleMental(tough, 0).player.mental).toBeGreaterThan(settleMental(weak, 0).player.mental)
  })
  it('저항은 감소 항에만 적용된다 (grit=10처럼 기본값에서 멀리 떨어진 값으로 전체-델타 저항과 구분)', () => {
    // 퇴사, 손실 30% 고정(악화 없음), 무신용, 저항 0.4(grit=10), mental 0에서 recoveryDelta=20.
    // 올바른 구현(drop*resist + gain): -6*0.4 + 20 = 17.6 → round(0+17.6) = 18
    // 잘못된 구현((drop+gain)*resist): (-6+20)*0.4 = 5.6 → round(0+5.6) = 6
    // 기본 grit=1(저항 0.94)에서는 두 식이 반올림 후 같은 정수로 겹칠 수 있어 이 케이스로 구분한다.
    const s = losing(30, 0)
    s.prevLossPct = 30
    s.player.employed = false
    s.player.stats = { ...s.player.stats, grit: 10 }
    expect(settleMental(s, 20).player.mental).toBe(18)
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
  it('정상(29 초과)에서 흔들림(29 이하)으로 넘어가면 트래킹이 증가한다 (사후 기준)', () => {
    // mental 35(정상)에서 시작. cash=0, loan=1,000,000 → 지급불능이라 보너스 없음.
    // drop = margin(-8) * resist(grit=1) = -7.52 → mental = round(35 - 7.52) = 27 (<=29, 흔들림)
    const s = makeState({ player: { ...makeState().player, mental: 35, cash: 0, loan: 1_000_000 } })
    const r = settleMental(s, 0)
    expect(r.player.mental).toBe(27)
    expect(r.player.mental).toBeLessThanOrEqual(BALANCE.mental.shakenMax)
    expect(r.trackers.shakenTurns).toBe(1)
  })
  it('흔들림(29 이하)에서 정상(29 초과)으로 벗어나면 트래킹이 증가하지 않는다 (사전 기준이었다면 증가했을 것)', () => {
    // mental 25(흔들림, 사전 기준으로는 <=29)에서 시작. 손실 없음, 현금뿐이라 보너스 +5,
    // recoveryDelta 20 → mental = round(25 + 25) = 50 (>29, 정상). 사후 기준이면 증가 없음.
    const s = makeState({ player: { ...makeState().player, mental: 25 } })
    const r = settleMental(s, 20)
    expect(r.player.mental).toBeGreaterThan(BALANCE.mental.shakenMax)
    expect(r.trackers.shakenTurns).toBe(0)
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

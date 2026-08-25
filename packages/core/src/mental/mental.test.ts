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
    // losing()의 avgCost는 Math.round로 정수화되므로 실제 손실률은 25%에서
    // 정수 반올림 오차(약 0.00188%p, 실측 24.998124953123828)만큼 벗어난다.
    // brief 원안(precision=5, 오차 허용 0.000005)은 이 반올림 오차보다 작아
    // 구성상 통과 불가능 — precision=2(오차 허용 0.005)로 완화.
    expect(settleMental(s, 0).prevLossPct).toBeCloseTo(25, 2)
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

import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { cashRatio as cashRatioOf } from '../turn/accounting'
import { settleMental, isShaken, mentalResist, lossExposure, moodOf } from './mental'
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
  // ── 노출도 가중 (재리뷰 N1) ───────────────────────────────────────────────
  // portfolioLossPct는 '보유 원가 대비' 손실률이라 노출 규모가 전혀 반영되지 않는다.
  // 가중이 없으면 7만원짜리 1주와 몰빵이 같은 피해를 입는다 — 실측으로도 1주(56%)가
  // 시드 90%(50%)보다 오히려 더 자주 흔들렸다. 아래 테스트들이 그 규칙을 못박는다.
  describe('손실 멘탈 피해의 노출도 가중', () => {
    /** 손실률은 pct%로 고정하고 노출도(보유평가액/총자산)만 바꾼다. */
    function atExposure(pct: number, holdValue: number, cash: number) {
      const s = makeState()
      s.player.mental = 80
      s.player.cash = cash
      const price = (10000 * (100 - pct)) / 100
      s.stocks = s.stocks.map(st => (st.id === 's1' ? { ...st, price } : st))
      s.player.holdings = [{ stockId: 's1', qty: Math.round(holdValue / price), avgCost: 10000, heldTurns: 0 }]
      s.prevLossPct = pct       // 악화 항 제거 — 고정감소만 본다
      return s
    }

    it('lossExposure는 0에서 시작해 lossExposureFull에서 1로 포화한다', () => {
      const full = BALANCE.mental.lossExposureFull
      expect(lossExposure(atExposure(30, 0, 10_000_000))).toBe(0)
      // 노출도 = full/2 → 가중 0.5
      expect(lossExposure(atExposure(30, 1_000_000, Math.round(1_000_000 / (full / 2) - 1_000_000))))
        .toBeCloseTo(0.5, 2)
      // 노출도 = full 이상 → 1로 상한
      expect(lossExposure(atExposure(30, 9_000_000, 1_000_000))).toBe(1)
    })

    it('지급불능(총자산 0 이하)이면 노출을 최대로 본다', () => {
      const s = makeState()
      s.player.cash = 0; s.player.loan = 1_000_000; s.player.holdings = []
      expect(lossExposure(s)).toBe(1)
    })

    it('같은 손실률이라도 노출도가 낮으면 멘탈이 훨씬 덜 깎인다', () => {
      // 손실 30% 고정. 총자산은 둘 다 3,000만원이고 그중 주식 비중만 다르다.
      const tiny = atExposure(30, 60_000, 29_940_000)       // 노출 0.2% — 1주짜리
      const heavy = atExposure(30, 27_000_000, 3_000_000)   // 노출 90% — 몰빵
      const dTiny = 80 - settleMental(tiny, 0).player.mental
      const dHeavy = 80 - settleMental(heavy, 0).player.mental
      expect(dHeavy, `몰빵 ${dHeavy} vs 1주 ${dTiny}`).toBeGreaterThan(dTiny)
      // 가중이 없으면 둘이 정확히 같아진다 — '더 크다'만으로는 1 차이도 통과하므로 비율을 본다.
      expect(dHeavy).toBeGreaterThanOrEqual(dTiny * 4)
      expect(dTiny).toBeLessThanOrEqual(1)
    })

    it('손실 악화 항도 노출도로 가중된다', () => {
      const mk = (holdValue: number, cash: number) => {
        const s = atExposure(40, holdValue, cash)
        s.prevLossPct = 10                                   // 30%p 악화
        return s
      }
      const tiny = 80 - settleMental(mk(60_000, 29_940_000), 0).player.mental
      const heavy = 80 - settleMental(mk(27_000_000, 3_000_000), 0).player.mental
      expect(heavy).toBeGreaterThan(tiny * 4)
    })

    it('신용(margin) 감소는 노출도와 무관하게 그대로 물린다', () => {
      // 빚을 졌다는 사실 자체에 대한 페널티라 노출로 깎이면 안 된다.
      const base = makeState({ player: { ...makeState().player, mental: 50 } })
      const withLoan = makeState({ player: { ...makeState().player, mental: 50, loan: 1_000_000 } })
      expect(settleMental(withLoan, 0).player.mental)
        .toBe(settleMental(base, 0).player.mental + BALANCE.mental.margin)
    })
  })

  // ── 현금 안정 보너스는 물려 있지 않을 때만 (Fix Round 1의 규칙, 재리뷰 N2) ──────
  it('현금비중이 충분해도 물려 있으면 현금 안정 보너스가 붙지 않는다', () => {
    // 이 규칙이 없으면 cashCalm이 lossHold를 이겨서 "물려 있는데 멘탈이 오른다".
    // 손실 5%(작게) · 노출 100% · 현금비중 0 → 보너스 조건(현금비중)만 다른 두 상태를 비교한다.
    const withLoss = makeState()
    withLoss.player.mental = 50
    withLoss.player.cash = 90_000_000                     // 현금비중 99.9% (문턱 0.7 초과)
    withLoss.stocks = withLoss.stocks.map(st => (st.id === 's1' ? { ...st, price: 9500 } : st))
    withLoss.player.holdings = [{ stockId: 's1', qty: 10, avgCost: 10000, heldTurns: 0 }]
    withLoss.prevLossPct = 5
    expect(cashRatioOf(withLoss)).toBeGreaterThan(BALANCE.mental.calmCashRatio)

    const noLoss = makeState({ player: { ...makeState().player, mental: 50, cash: 90_000_000 } })
    // 물려 있지 않은 쪽에는 보너스가 붙는다
    expect(settleMental(noLoss, 0).player.mental).toBe(50 + BALANCE.mental.cashCalm)
    // 물려 있는 쪽에는 붙지 않는다 → 50을 넘지 못한다
    expect(settleMental(withLoss, 0).player.mental).toBeLessThanOrEqual(50)
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
    // 올바른 구현(drop*resist + gain): lossHoldUnemployed*0.4 + 20
    // 잘못된 구현((drop+gain)*resist): (lossHoldUnemployed+20)*0.4
    // 기본 grit=1(저항 0.94)에서는 두 식이 반올림 후 같은 정수로 겹칠 수 있어 이 케이스로 구분한다.
    // 기대값은 BALANCE에서 유도한다 — 밸런싱으로 lossHoldUnemployed가 바뀌어도(Task 8에서
    // −6 → −8) 이 테스트가 고정하는 것은 계속 '저항이 걸리는 자리'다.
    const s = losing(30, 0)
    s.prevLossPct = 30
    s.player.employed = false
    s.player.stats = { ...s.player.stats, grit: 10 }
    const resist = Math.max(0.2, 1 - 10 * BALANCE.mental.resistPer)
    const right = Math.round(BALANCE.mental.lossHoldUnemployed * resist + 20)
    const wrong = Math.round((BALANCE.mental.lossHoldUnemployed + 20) * resist)
    expect(right, '두 식이 같은 값이면 이 케이스는 아무것도 구분하지 못한다').not.toBe(wrong)
    expect(settleMental(s, 20).player.mental).toBe(right)
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
  it('신용 미사용 시 최악의 한 턴에서도 회복 카드가 순증가를 만든다', () => {
    // 스펙 §3.3 데드락 부재 보증의 수치 버전. 최악 조건(퇴사·손실 99% 고정·grit 0)에서
    // 회복 20이 손실 고정감소를 이겨야 흔들림에서 빠져나올 길이 남는다.
    // 기대값은 리터럴이 아니라 BALANCE에서 유도한다 — 예전에는 +14로 박혀 있어
    // lossHoldUnemployed를 −6 → −8로 튜닝하자 곧바로 red가 됐다(Task 8).
    const s = losing(99, 0); s.prevLossPct = 99; s.player.employed = false
    s.player.stats = { ...s.player.stats, grit: 0 }
    const after = settleMental(s, 20)
    const expected = 20 + BALANCE.mental.lossHoldUnemployed   // 저항 1.0(grit 0), 악화 0
    expect(expected, '회복 20이 최악의 감소를 못 이기면 탈출구가 없다').toBeGreaterThan(0)
    expect(after.player.mental - 0).toBe(expected)
  })
})

// 최종 리뷰 C1 부작용: 표정이 '시드머니 대비 ROI ≥ 20%'로 갈려서, 월급 입금만으로
// 턴 4에 임계를 넘어 normal 6종이 사실상 화면에 뜨지 않았다.
describe('moodOf — 세 표정이 모두 도달 가능하다', () => {
  /** 기준선 대비 수익률을 정확히 roiPct로 만든 상태.
   *  held=true면 총액의 일부를 주식으로 들고 있다(joy의 '시장에 들어가 있다' 조건). */
  const withRoi = (mental: number, roiPct: number, held = true) => {
    const netPayroll = 10_000_000
    const base = BALANCE.seedMoney + netPayroll
    const total = Math.round(base * (1 + roiPct / 100))
    const s = makeState()
    // s1 1주 = 10,000원 (testkit 기본값)
    const qty = held ? 100 : 0
    return {
      ...s,
      player: {
        ...s.player, mental, cash: total - qty * 10_000,
        holdings: qty > 0 ? [{ stockId: 's1', qty, avgCost: 10_000, heldTurns: 1 }] : [],
      },
      trackers: { ...s.trackers, netPayroll },
    }
  }

  it('흔들림이면 무조건 shaken이다 (수익률이 아무리 좋아도)', () => {
    expect(moodOf(withRoi(BALANCE.mental.shakenMax, 500))).toBe('shaken')
  })
  it('멘탈이 넉넉하고 기준선을 앞서면 joy다', () => {
    expect(moodOf(withRoi(100, BALANCE.mood.joyRoiPct + 1))).toBe('joy')
  })
  it('멘탈이 넉넉해도 기준선과 비슷하면 normal이다 — 월급만 받은 판이 여기 있다', () => {
    expect(moodOf(withRoi(100, 0))).toBe('normal')
    expect(moodOf(withRoi(100, BALANCE.mood.joyRoiPct - 1))).toBe('normal')
  })
  it('수익률이 좋아도 멘탈이 깎여 있으면 normal이다', () => {
    expect(moodOf(withRoi(BALANCE.mood.joyMental - 1, 100))).toBe('normal')
  })
  it('턴 1의 새 판은 normal이다 (예전에는 턴 4부터 영구 joy였다)', () => {
    expect(moodOf(makeState({ player: { ...makeState().player, mental: 100 } }))).toBe('normal')
  })
  it('주식을 한 주도 안 샀으면 현금이 아무리 늘어도 joy가 아니다', () => {
    // 야근 카드로 번 돈은 '투자 수익'이 아니다 — 보유 조건이 없으면 무매매 판이
    // 다시 영구 joy가 된다(브라우저 156턴 실측에서 실제로 그랬다).
    expect(moodOf(withRoi(100, 200, false))).toBe('normal')
    expect(moodOf(withRoi(100, 200, true))).toBe('joy')
  })
})

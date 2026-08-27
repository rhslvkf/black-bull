import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { AccountScreen } from './AccountScreen'
import { renderWithState, type GameStateOverride } from '../testUtils'
import { useGame } from '../store/store'

// sjc(윤슬반도체)·bnk(한들금융지주)는 packages/core/data/stocks.json에 고정된 실제 종목이다
// (합성 데이터가 아니다). newGame(1)이 만드는 첫 턴(turn 1)에는 core의
// initStockStates(market/stocks.ts)가 price를 stockDefs.initialPrice 그대로 심으므로,
// 어떤 시드를 넘겨도 1턴차 가격은 아래 리터럴과 항상 같다 — 이 값에 기대 테스트를 만들어도
// 시드가 바뀌면 깨지는 일이 없다.
const SJC_PRICE = 71_000 // sjc.initialPrice
const BNK_PRICE = 68_000 // bnk.initialPrice

describe('AccountScreen', () => {
  it('보유 종목마다 평단·수익률·비중을 보여준다', () => {
    renderWithState({ player: { holdings: [{ stockId: 'sjc', qty: 10, avgCost: 9000, heldTurns: 4 }] } }, <AccountScreen />)
    const row = screen.getByTestId('holding-sjc')
    // Ruling 18 — @testing-library/jest-dom 없이 순수 DOM으로 본다. 검사 내용은 브리프와 같다.
    expect(row.textContent).toContain('9,000원')
    expect(row.querySelector('[data-testid=roi]')).not.toBeNull()
    expect(row.querySelector('[data-testid=weight]')).not.toBeNull()
  })

  it('누적 수수료·세금을 보여준다', () => {
    renderWithState({ trackers: { feesPaid: 12000, taxPaid: 34000 } }, <AccountScreen />)
    expect(screen.getByTestId('cost-total').textContent).toContain('46,000원')
  })

  it('누적 수수료·세금 표기는 천 단위 구분자와 "원"을 함께 쓴다 (MU5)', () => {
    // 46,000처럼 콤마가 하나뿐인 값은 "그냥 자릿수가 맞았다"는 우연과 구별이 잘 안 된다 —
    // 백만 단위(콤마 두 개)로 한 번 더 못박는다.
    renderWithState({ trackers: { feesPaid: 1_234_567, taxPaid: 999 } }, <AccountScreen />)
    expect(screen.getByTestId('cost-total').textContent).toContain('1,235,566원')
  })

  it('누적 수수료·세금은 수수료와 세금 둘 다 더한 값이다 (MU4)', () => {
    // feesPaid만 반영하고 taxPaid를 빼먹으면 12,000원이 뜬다 — 46,000원과 뚜렷이 다르다.
    renderWithState({ trackers: { feesPaid: 12000, taxPaid: 34000 } }, <AccountScreen />)
    const text = screen.getByTestId('cost-total').textContent ?? ''
    expect(text).not.toContain('12,000원')
    expect(text).toContain('46,000원')
  })

  it('평단·수익률·비중이 실제 값을 정확히 반영한다 (MU1/MU2/MU3/MU9/MU10)', () => {
    // sjc: 9,000원에 사서 71,000원(1턴차 실제가)까지 오른 상태 — 큰 폭의 이익(상승/빨강).
    // bnk: 70,000원에 사서 68,000원까지 내린 상태 — 손실(하락/파랑).
    // cash를 1,000,000원으로 고정해 총자산(= core의 totalAssets)을 정확한 리터럴로 계산한다.
    renderWithState({
      player: {
        cash: 1_000_000,
        holdings: [
          { stockId: 'sjc', qty: 10, avgCost: 9000, heldTurns: 1 },
          { stockId: 'bnk', qty: 5, avgCost: 70000, heldTurns: 1 },
        ],
      },
    }, <AccountScreen />)

    const sjcValue = 10 * SJC_PRICE // 710,000
    const bnkValue = 5 * BNK_PRICE // 340,000
    const total = 1_000_000 + sjcValue + bnkValue // 2,050,000

    const sjcRow = screen.getByTestId('holding-sjc')
    const bnkRow = screen.getByTestId('holding-bnk')

    // MU1 — 평단을 현재가로 바꿔 표시하면 "9,000원"이 사라지고 "71,000원"이 뜬다.
    expect(sjcRow.textContent).toContain('9,000원')
    expect(sjcRow.textContent).not.toContain('71,000원')
    expect(bnkRow.textContent).toContain('70,000원')

    // MU2 — 수익률을 항상 0으로 바꾸면 이 리터럴들과 어긋난다.
    const sjcRoi = sjcRow.querySelector('[data-testid=roi]')!
    const bnkRoi = bnkRow.querySelector('[data-testid=roi]')!
    expect(sjcRoi.textContent).toBe('+688.9%') // (71,000-9,000)/9,000 × 100
    expect(bnkRoi.textContent).toBe('-2.9%') // (68,000-70,000)/70,000 × 100

    // MU9 — 상승/하락 색 클래스가 뒤집히면 이 두 단언이 서로 자리를 바꿔야 통과한다.
    expect(sjcRoi.className).toBe('up') // 상승 = 빨강(한국 관례, index.css --up)
    expect(bnkRoi.className).toBe('down') // 하락 = 파랑(한국 관례, index.css --down)

    // MU3 — 비중을 항상 100%로 바꾸면 이 리터럴들과 어긋난다.
    const sjcWeight = sjcRow.querySelector('[data-testid=weight]')!
    const bnkWeight = bnkRow.querySelector('[data-testid=weight]')!
    expect(sjcWeight.textContent).toContain('34.6%') // 710,000 / 2,050,000 × 100
    expect(bnkWeight.textContent).toContain('16.6%') // 340,000 / 2,050,000 × 100

    // MU10 — 정규화(분모를 총자산 하나로 고정)를 빼면 두 비중의 합이 100%를 넘거나
    // 이 기대값(≈51.2%, 현금 몫을 제외한 두 종목만의 합)에서 벗어난다.
    const sum = Number(sjcWeight.textContent!.replace('%', '').replace('비중 ', ''))
      + Number(bnkWeight.textContent!.replace('%', '').replace('비중 ', ''))
    expect(sum).toBeLessThanOrEqual(100)
    expect(sum).toBeCloseTo(((sjcValue + bnkValue) / total) * 100, 1)
  })

  it('보유가 하나도 없으면 안내 문구가 뜨고, 그래도 누적 수수료·세금은 보인다 (MU11)', () => {
    renderWithState({}, <AccountScreen />)
    const empty = screen.getByTestId('empty-holdings')
    expect(empty.textContent).toContain('아직 아무것도 없다')
    // 보유가 없어도 화면 전체가 비어버리지 않는다 — 수수료·세금 요약은 항상 뜬다
    // (이 헬퍼는 기본 새 판이라 trackers가 전부 0이다).
    expect(screen.getByTestId('cost-total').textContent).toContain('0원')
  })

  it('보유 행을 탭하면 시세 탭으로 이동하고 그 종목이 선택된다 (Ruling 25)', () => {
    renderWithState({ player: { holdings: [{ stockId: 'sjc', qty: 10, avgCost: 9000, heldTurns: 1 }] } }, <AccountScreen />)
    expect(useGame.getState().tab).toBe('home')
    expect(useGame.getState().selectedStock).toBeNull()

    fireEvent.click(screen.getByTestId('holding-sjc'))

    // 두 축을 각각 따로 본다 — setTab과 selectStock 중 하나만 호출하도록 바꿔도(예:
    // selectStock 호출을 통째로 지워도) tab 단언 하나만 있으면 통과해버린다. 두 단언이
    // 모두 있어야 "절반만 동작해도 통과하는가"를 각각 잡는다.
    expect(useGame.getState().tab).toBe('market')
    expect(useGame.getState().selectedStock).toBe('sjc')
  })

  it('보유 종목 행의 터치 타깃이 44px 이상이다 (MU12, Global Constraints)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    renderWithState({ player: { holdings: [{ stockId: 'sjc', qty: 10, avgCost: 9000, heldTurns: 1 }] } }, <AccountScreen />)
    const style = getComputedStyle(screen.getByTestId('holding-sjc'))
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })
})

// ── 신용 창구 (CreditSection) ────────────────────────────────────────────────
// 이 저장소가 반복해서 겪은 함정: "숫자가 상태를 따라 변하는가"를 단일 값 한 번으로만
// 확인하면 그 자리를 상수로 바꿔도 전부 초록이었다(CardTile 등급·TopBar 총자산).
// 그래서 아래 다섯 값(한도·빚·주 이자·담보비율·부족액)은 **각각 서로 다른 상태 2개
// 이상**으로 고정한다 — 어느 하나를 상수로 굳히면 두 기대값 중 최소 하나가 반드시 깨진다.
describe('AccountScreen — 신용 창구', () => {
  /** 계좌 화면을 신용이 열린 상태로 렌더한다. tier 기본값은 신용 최소 티어(3). */
  function renderCredit(player: NonNullable<GameStateOverride['player']> = {}) {
    return renderWithState({ player: { tier: 3, ...player } }, <AccountScreen />)
  }
  const text = (testId: string) => screen.getByTestId(testId).textContent ?? ''

  describe('티어 게이트', () => {
    it.each([0, 1, 2] as const)('티어 %i에서는 섹션이 아예 없다', tier => {
      renderWithState({ player: { tier, loan: 0 } }, <AccountScreen />)
      expect(screen.queryByTestId('credit-section')).toBeNull()
      // 게이트를 지우면 아래 셋이 전부 살아난다 — 존재 자체를 각각 못박는다.
      expect(screen.queryByTestId('credit-limit')).toBeNull()
      expect(screen.queryByTestId('take-loan')).toBeNull()
      expect(screen.queryByTestId('credit-amount')).toBeNull()
    })

    it.each([3, 4, 5] as const)('티어 %i에서는 섹션이 뜬다', tier => {
      renderWithState({ player: { tier, loan: 0 } }, <AccountScreen />)
      expect(screen.queryByTestId('credit-section')).not.toBeNull()
      expect(screen.queryByTestId('take-loan')).not.toBeNull()
    })

    it('빚이 남아 있으면 티어가 강등돼도 창구는 닫히지 않는다 (갚을 길·경고를 막지 않는다)', () => {
      renderWithState({ player: { tier: 2, loan: 5_000_000, cash: 6_000_000 } }, <AccountScreen />)
      expect(screen.queryByTestId('credit-section')).not.toBeNull()
      // 신규 대출은 여전히 막혀 있다 — maxLoan이 0이므로 한도 표시도 0원이다.
      expect(text('credit-limit')).toBe('0원')
      fireEvent.change(screen.getByTestId('credit-amount'), { target: { value: '1000000' } })
      expect((screen.getByTestId('take-loan') as HTMLButtonElement).disabled).toBe(true)
      // 그런데 상환은 된다(이게 이 예외의 이유다).
      expect((screen.getByTestId('repay-loan') as HTMLButtonElement).disabled).toBe(false)
    })
  })

  describe('표시값이 상태를 따라 움직인다', () => {
    // 한도 = floor(총자산 × 0.9) − 기존 대출. 총자산 = 현금 + 평가액 − 대출.
    it('한도: 빚 없는 계좌', () => {
      renderCredit({ cash: 100_000_000, holdings: [], loan: 0 })
      expect(text('credit-limit')).toBe('90,000,000원') // floor(100,000,000 × 0.9) − 0
    })
    it('한도: 이미 빌린 만큼 줄어든다', () => {
      renderCredit({ cash: 100_000_000, holdings: [], loan: 20_000_000 })
      // 총자산 = 100,000,000 − 20,000,000 = 80,000,000 → 72,000,000 − 20,000,000
      expect(text('credit-limit')).toBe('52,000,000원')
    })
    it('한도: 보유 평가액도 담보로 들어간다', () => {
      renderCredit({ cash: 50_000_000, holdings: [{ stockId: 'sjc', qty: 10, avgCost: 50_000, heldTurns: 2 }], loan: 0 })
      // 총자산 = 50,000,000 + 10 × 71,000 = 50,710,000 → floor(× 0.9)
      expect(text('credit-limit')).toBe('45,639,000원')
    })

    it('현재 빚: 0원과 실제 잔액을 각각 그대로 보여준다', () => {
      renderCredit({ cash: 100_000_000, loan: 0 })
      expect(text('credit-loan')).toBe('0원')
      screen.getByTestId('credit-section') // sanity — 같은 자리에서 읽었다
    })
    it('현재 빚: 빌린 금액이 그대로 뜬다', () => {
      renderCredit({ cash: 100_000_000, loan: 23_450_000 })
      expect(text('credit-loan')).toBe('23,450,000원')
    })

    // 주 이자 = round(빚 × BALANCE.loan.rate(0.25%)). 상수로 굳히면 두 값 중 하나는 깨진다.
    it('주 이자: 빚 2,000만원이면 5만원', () => {
      renderCredit({ cash: 100_000_000, loan: 20_000_000 })
      expect(text('credit-interest')).toBe('50,000원')
    })
    it('주 이자: 빚 400만원이면 1만원', () => {
      renderCredit({ cash: 100_000_000, loan: 4_000_000 })
      expect(text('credit-interest')).toBe('10,000원')
    })
    it('주 이자: 빚이 없으면 0원', () => {
      renderCredit({ cash: 100_000_000, loan: 0 })
      expect(text('credit-interest')).toBe('0원')
    })

    // 담보비율 = (현금 + 평가액) / 빚 × 100. **현금만** 세는 뮤테이션은 아래 첫 두
    // 케이스에서 각각 200.0% / 75.0%가 되어 기대값과 어긋난다.
    it('담보비율: 평가액이 분자에 들어간다 (여유 있는 계좌)', () => {
      renderCredit({
        cash: 10_000_000, loan: 5_000_000,
        holdings: [{ stockId: 'sjc', qty: 10, avgCost: 50_000, heldTurns: 2 }],
      })
      // (10,000,000 + 710,000) / 5,000,000 × 100 = 214.2%
      expect(text('credit-collateral')).toBe('214.2%')
      // 위험할 때만 색이 붙는다 — 여유 있는 계좌에는 하락색 클래스가 없다.
      expect(screen.getByTestId('credit-collateral').className).toBe('')
    })
    it('담보비율: 청산선(130%) 아래면 하락색으로 뜬다', () => {
      renderCredit({
        cash: 3_000_000, loan: 4_000_000,
        holdings: [{ stockId: 'sjc', qty: 10, avgCost: 50_000, heldTurns: 2 }],
      })
      // (3,000,000 + 710,000) / 4,000,000 × 100 = 92.75 → 92.8%
      expect(text('credit-collateral')).toBe('92.8%')
      expect(screen.getByTestId('credit-collateral').className).toBe('down')
    })
    it('담보비율: 빚이 없으면 비율 자체가 없다', () => {
      renderCredit({ cash: 10_000_000, loan: 0 })
      expect(text('credit-collateral')).toBe('—')
    })
  })

  describe('마진콜 경고 배너', () => {
    it('경고가 없으면 배너가 없다', () => {
      renderCredit({ cash: 1_000_000, loan: 10_000_000, marginCallDueTurn: null })
      expect(screen.queryByTestId('margin-banner')).toBeNull()
      expect(screen.queryByTestId('margin-shortfall')).toBeNull()
    })

    it('경고가 서 있으면 문구와 부족액이 함께 뜬다', () => {
      renderCredit({ cash: 1_000_000, loan: 10_000_000, holdings: [], marginCallDueTurn: 7 })
      expect(text('margin-banner')).toContain('다음 주까지 담보를 못 채우면 전량 청산됩니다')
      // 부족액 = ceil(10,000,000 × 1.3 − 1,000,000)
      expect(text('margin-shortfall')).toBe(' 부족액 12,000,000원')
    })

    it('부족액은 담보(현금 + 평가액)를 따라 바뀐다', () => {
      renderCredit({
        cash: 5_000_000, loan: 10_000_000, marginCallDueTurn: 7,
        holdings: [{ stockId: 'sjc', qty: 10, avgCost: 50_000, heldTurns: 2 }],
      })
      // 13,000,000 − (5,000,000 + 710,000) = 7,290,000 — 위 케이스(12,000,000원)와 다르다.
      expect(text('margin-shortfall')).toBe(' 부족액 7,290,000원')
    })

    it('`flags.marginCalled`(이미 청산됨)는 배너 조건이 아니다', () => {
      // 청산은 이미 끝났고(사후 기록) 예고는 없는 상태 — 배너 조건을 flags.marginCalled로
      // 바꿔 놓으면 여기서 "다음 주에 청산됩니다"라는 거짓말이 뜬다.
      renderCredit({ cash: 1_000_000, loan: 10_000_000, marginCallDueTurn: null })
      const s = useGame.getState().state!
      useGame.setState({ state: { ...s, flags: { ...s.flags, marginCalled: true } } })
      expect(screen.queryByTestId('margin-banner')).toBeNull()
    })

    it('예고가 서 있으면 이미 청산된 적이 있어도 배너는 뜬다', () => {
      renderCredit({ cash: 1_000_000, loan: 10_000_000, marginCallDueTurn: 12 })
      expect(screen.queryByTestId('margin-banner')).not.toBeNull()
    })
  })

  describe('대출·상환 버튼', () => {
    const setAmount = (v: number) =>
      fireEvent.change(screen.getByTestId('credit-amount'), { target: { value: String(v) } })
    const btn = (id: string) => screen.getByTestId(id) as HTMLButtonElement

    it('금액이 비어 있으면 둘 다 눌리지 않는다', () => {
      renderCredit({ cash: 100_000_000, loan: 10_000_000 })
      expect(btn('take-loan').disabled).toBe(true)
      expect(btn('repay-loan').disabled).toBe(true)
    })

    it('한도 초과는 버튼이 막는다 (core의 LOAN_LIMIT까지 가지 않는다)', () => {
      renderCredit({ cash: 100_000_000, holdings: [], loan: 0 })
      const limit = 90_000_000
      setAmount(limit)
      expect(btn('take-loan').disabled).toBe(false)
      expect(screen.queryByTestId('take-reason')).toBeNull()
      setAmount(limit + 1)
      expect(btn('take-loan').disabled).toBe(true)
      expect(text('take-reason')).toContain('한도(90,000,000원)를 넘었다')
    })

    it('현금 부족·빚 초과 상환은 버튼이 막는다', () => {
      renderCredit({ cash: 3_000_000, holdings: [], loan: 10_000_000 })
      setAmount(3_000_000)
      expect(btn('repay-loan').disabled).toBe(false)
      setAmount(3_000_001) // 현금 초과(빚보다는 적다)
      expect(btn('repay-loan').disabled).toBe(true)
      expect(text('repay-reason')).toContain('예수금(3,000,000원)이 모자란다')
      setAmount(10_000_001) // 빚 초과
      expect(btn('repay-loan').disabled).toBe(true)
      expect(text('repay-reason')).toContain('빚(10,000,000원)보다 많이 갚을 수 없다')
    })

    it('대출 버튼은 입력한 금액을 그대로 빌린다 (고정액 뮤테이션 대비 두 금액)', () => {
      renderCredit({ cash: 100_000_000, holdings: [], loan: 0 })
      setAmount(7_000_000)
      fireEvent.click(screen.getByTestId('take-loan'))
      let p = useGame.getState().state!.player
      expect(p.loan).toBe(7_000_000)
      expect(p.cash).toBe(107_000_000)
      // 화면 표시도 함께 따라간다(같은 상태를 다시 그린다).
      expect(text('credit-loan')).toBe('7,000,000원')

      setAmount(1_234_000)
      fireEvent.click(screen.getByTestId('take-loan'))
      p = useGame.getState().state!.player
      expect(p.loan).toBe(8_234_000)
      expect(p.cash).toBe(108_234_000)
    })

    it('대출은 신용 사용 기록(trackers.usedMargin)을 남긴다', () => {
      renderCredit({ cash: 100_000_000, holdings: [], loan: 0 })
      expect(useGame.getState().state!.trackers.usedMargin).toBe(false)
      setAmount(1_000_000)
      fireEvent.click(screen.getByTestId('take-loan'))
      expect(useGame.getState().state!.trackers.usedMargin).toBe(true)
    })

    it('상환 버튼은 입력한 금액만큼 빚과 현금을 함께 줄인다', () => {
      renderCredit({ cash: 50_000_000, holdings: [], loan: 20_000_000 })
      setAmount(6_000_000)
      fireEvent.click(screen.getByTestId('repay-loan'))
      const p = useGame.getState().state!.player
      expect(p.loan).toBe(14_000_000)
      expect(p.cash).toBe(44_000_000)
      expect(text('credit-loan')).toBe('14,000,000원')
      // 한도도 다시 계산된다: 총자산 = 44,000,000 − 14,000,000 = 30,000,000
      expect(text('credit-limit')).toBe('13,000,000원') // floor(27,000,000) − 14,000,000
    })

    it('"한도 전액"·"갚을 수 있는 만큼" 버튼이 금액 칸을 채운다', () => {
      renderCredit({ cash: 3_000_000, holdings: [], loan: 10_000_000 })
      fireEvent.click(screen.getByTestId('fill-repay'))
      expect((screen.getByTestId('credit-amount') as HTMLInputElement).value).toBe('3000000') // min(빚, 현금)
      expect(btn('repay-loan').disabled).toBe(false)

      renderCredit({ cash: 100_000_000, holdings: [], loan: 0 })
      fireEvent.click(screen.getAllByTestId('fill-limit')[0]!)
      expect((screen.getAllByTestId('credit-amount')[0] as HTMLInputElement).value).toBe('90000000')
    })

    it('금액 칸과 버튼의 터치 타깃이 44px 이상이다', () => {
      renderCredit({ cash: 100_000_000, loan: 0 })
      for (const id of ['credit-amount', 'fill-limit', 'fill-repay', 'take-loan', 'repay-loan']) {
        expect(parseFloat(getComputedStyle(screen.getByTestId(id)).minHeight), id).toBeGreaterThanOrEqual(44)
      }
    })
  })
})

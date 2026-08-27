import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { AccountScreen } from './AccountScreen'
import { renderWithState } from '../testUtils'
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

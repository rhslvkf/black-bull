import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MarketScreen } from './MarketScreen'
import { StockDetail } from './StockDetail'
import { AccountScreen } from './AccountScreen'
import { PriceChart } from '../components/PriceChart'
import { maxBuyQty } from '@bb/core'
import { useGame } from '../store/store'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('PriceChart', () => {
  it('폴리라인을 그린다', () => {
    const { container } = render(<PriceChart history={[100, 120, 90, 130]} />)
    expect(container.querySelector('polyline')).not.toBeNull()
  })
  it('데이터가 1개여도 깨지지 않는다', () => {
    expect(() => render(<PriceChart history={[100]} />)).not.toThrow()
  })
  it('데이터가 1개일 때 빈 상자가 아니라 시각적으로 보이는 선이 그려진다', () => {
    // 좌표쌍 1개짜리 <polyline points="0,60">은 선분을 그리지 않아 element는 존재해도
    // 화면엔 빈 상자로 보인다 — "element 존재"만 확인하면 이 결함을 못 잡는다(리뷰 M1/D6).
    // 그래서 <line> 플레이스홀더 존재 또는 polyline이 실제 좌표쌍 2개 이상(공백 포함)을
    // 갖는지까지 확인한다.
    const { container } = render(<PriceChart history={[100]} />)
    const line = container.querySelector('line')
    const poly = container.querySelector('polyline')
    const polyHasSegment = poly ? (poly.getAttribute('points') ?? '').trim().includes(' ') : false
    expect(!!line || polyHasSegment).toBe(true)
  })
  it('빈 배열이어도 깨지지 않는다', () => {
    expect(() => render(<PriceChart history={[]} />)).not.toThrow()
  })
  it('상승·하락·보합이 서로 다른 색으로 그려진다', () => {
    const up = render(<PriceChart history={[100, 130]} />)
    const upColor = up.container.querySelector('polyline')!.getAttribute('stroke')
    up.unmount()
    const down = render(<PriceChart history={[130, 100]} />)
    const downColor = down.container.querySelector('polyline')!.getAttribute('stroke')
    down.unmount()
    const flat = render(<PriceChart history={[100, 100]} />)
    const flatColor = flat.container.querySelector('polyline')!.getAttribute('stroke')
    flat.unmount()
    expect(upColor).not.toBe(downColor)
    expect(upColor).not.toBe(flatColor)
    expect(downColor).not.toBe(flatColor)
  })
})

describe('MarketScreen', () => {
  it('종목 10개가 보인다', () => {
    render(<MarketScreen />)
    expect(screen.getAllByTestId(/^stock-row-/)).toHaveLength(10)
  })
  it('티어 미달 종목은 잠겨 있다', () => {
    render(<MarketScreen />)
    expect(screen.getByTestId('stock-row-def').hasAttribute('disabled')).toBe(true)
  })
  it('티어 통과 종목은 잠겨 있지 않다', () => {
    render(<MarketScreen />)
    expect(screen.getByTestId('stock-row-sjc').hasAttribute('disabled')).toBe(false)
  })
  it('잠긴 종목을 클릭해도 선택되지 않는다', () => {
    render(<MarketScreen />)
    fireEvent.click(screen.getByTestId('stock-row-def'))
    expect(useGame.getState().selectedStock).toBe(null)
  })
  it('티어 통과 종목을 누르면 선택된다', () => {
    render(<MarketScreen />)
    fireEvent.click(screen.getByTestId('stock-row-sjc'))
    expect(useGame.getState().selectedStock).toBe('sjc')
  })
  it('섹터 필터가 목록을 줄인다', () => {
    render(<MarketScreen />)
    fireEvent.click(screen.getByTestId('filter-반도체'))
    expect(screen.getAllByTestId(/^stock-row-/)).toHaveLength(1)
  })
})

describe('StockDetail', () => {
  beforeEach(() => useGame.getState().selectStock('sjc'))

  it('적정가 밴드와 리스크가 보인다', () => {
    render(<StockDetail />)
    expect(screen.getByTestId('fair-band')).toBeDefined()
    expect(screen.getByTestId('risk-grade')).toBeDefined()
  })
  it('매수하면 보유가 생긴다', () => {
    render(<StockDetail />)
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '1' } })
    fireEvent.click(screen.getByTestId('buy'))
    expect(useGame.getState().state!.player.holdings).toHaveLength(1)
  })
  it('손절 봉인 상태면 매도 버튼이 잠기고 사유가 보인다', () => {
    useGame.getState().doBuy('sjc', 1)
    const s = useGame.getState().state!
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, mental: 5 },
      stocks: s.stocks.map(x => x.id === 'sjc' ? { ...x, price: Math.round(x.price * 0.5) } : x),
    } })
    render(<StockDetail />)
    expect(screen.getByTestId('sell').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/손이 안 나간다/)).toBeDefined()
  })
  it('손절 봉인이 아니면 보유 수량 내에서 매도 버튼이 열려 있다', () => {
    useGame.getState().doBuy('sjc', 1)
    render(<StockDetail />)
    expect(screen.getByTestId('sell').hasAttribute('disabled')).toBe(false)
  })
  it('손절 봉인 상태에서 매도를 눌러도 보유가 줄지 않는다', () => {
    useGame.getState().doBuy('sjc', 1)
    const s = useGame.getState().state!
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, mental: 5 },
      stocks: s.stocks.map(x => x.id === 'sjc' ? { ...x, price: Math.round(x.price * 0.5) } : x),
    } })
    render(<StockDetail />)
    fireEvent.click(screen.getByTestId('sell'))
    expect(useGame.getState().state!.player.holdings[0]!.qty).toBe(1)
  })
  it('현금보다 많이 사려 하면 매수가 잠긴다', () => {
    render(<StockDetail />)
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '99999' } })
    expect(screen.getByTestId('buy').hasAttribute('disabled')).toBe(true)
  })
  it('정확히 최대 매수 수량이면 매수 버튼이 열려 있다', () => {
    render(<StockDetail />)
    const max = maxBuyQty(useGame.getState().state!, 'sjc')
    fireEvent.change(screen.getByTestId('qty'), { target: { value: String(max) } })
    expect(screen.getByTestId('buy').hasAttribute('disabled')).toBe(false)
  })
  it('최대 매수 수량보다 1주 많으면 매수 버튼이 잠긴다', () => {
    render(<StockDetail />)
    const max = maxBuyQty(useGame.getState().state!, 'sjc')
    fireEvent.change(screen.getByTestId('qty'), { target: { value: String(max + 1) } })
    expect(screen.getByTestId('buy').hasAttribute('disabled')).toBe(true)
  })
})

describe('AccountScreen', () => {
  it('보유가 없으면 안내가 뜬다', () => {
    render(<AccountScreen />)
    expect(screen.getByTestId('empty-holdings')).toBeDefined()
  })
  it('보유 종목이 행으로 보인다', () => {
    useGame.getState().doBuy('sjc', 2)
    render(<AccountScreen />)
    expect(screen.getByTestId('holding-sjc')).toBeDefined()
  })
})

describe('터치 타깃', () => {
  // jsdom은 실제 레이아웃/CSS를 계산하지 않아(vitest 기본 설정에 css:true도 없음)
  // getBoundingClientRect로는 항상 0이 나온다. 그래서 index.css 소스에서 해당 규칙의
  // min-height 값을 직접 파싱해 44px 이상인지 고정한다(리뷰 M2/완료조건 요구사항).
  // 실측(Playwright, 실제 브라우저)은 이 라운드 보고서의 "브라우저 확인" 섹션에 별도 기록.
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
  const css = readFileSync(cssPath, 'utf-8')

  function dimOf(selector: string, prop: 'min-height' | 'min-width'): number {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const block = css.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`))?.[0] ?? ''
    const m = block.match(new RegExp(`${prop}:\\s*(\\d+)px`))
    if (!m) throw new Error(`${prop} not found for ${selector}`)
    return Number(m[1])
  }
  const minHeightOf = (selector: string) => dimOf(selector, 'min-height')

  it('섹터 필터 칩의 min-height가 44px 이상이다', () => {
    expect(minHeightOf('.filters button')).toBeGreaterThanOrEqual(44)
  })
  it('종목 행·매수/매도 버튼·수량 입력도 44px 기준을 지킨다', () => {
    expect(minHeightOf('.stock-row')).toBeGreaterThanOrEqual(44)
    expect(minHeightOf('.trade-buttons button')).toBeGreaterThanOrEqual(44)
    expect(minHeightOf('.trade-row input')).toBeGreaterThanOrEqual(44)
  })
  it('종목 상세의 뒤로가기(← 목록) 버튼은 높이·너비 둘 다 44px 기준을 지킨다', () => {
    // 재리뷰 라운드 2: 종목을 볼 때마다 누르는 버튼이라 별도로 고정한다.
    // Task 24: 실측(Playwright)에서 41x44px로 너비만 3px 모자랐다 — min-width도 함께 못박는다.
    expect(minHeightOf('.screen.detail .back')).toBeGreaterThanOrEqual(44)
    expect(dimOf('.screen.detail .back', 'min-width')).toBeGreaterThanOrEqual(44)
  })
})

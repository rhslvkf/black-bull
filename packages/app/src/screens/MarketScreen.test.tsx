import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect, beforeEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { MarketScreen } from './MarketScreen'
import { StockDetail } from './StockDetail'
import { AccountScreen } from './AccountScreen'
import { PriceChart } from '../components/PriceChart'
import { maxBuyQty } from '@bb/core'
import { useGame } from '../store/store'
import { renderDetail, currentState } from '../testUtils'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

// design/tokens.test.ts(Task 9)·CardTile.test.tsx(Fix Round 1 Minor 2)가 세운 전례를 그대로
// 따른다 — tokens.css를 직접 읽어 `--name: 값;` 형태의 실제 선언이 있는지 정규식으로 본다.
// PriceChart(Task 15 Fix Round 1 Major 2)가 var(--up)/var(--down)/var(--neutral)로 색을
// 간접 참조하므로, "그 이름이 tokens.css에 실제로 정의돼 있는가"를 여기서도 같은 방식으로 닫는다.
const tokensCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../design/tokens.css'),
  'utf-8',
)
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}
function definesCustomProperty(css: string, name: string): boolean {
  const re = new RegExp(`--${name}\\s*:\\s*[^;]+;`)
  return re.test(stripCssComments(css))
}
/** jsdom은 var()를 해석하지 않으므로 getComputedStyle(el).stroke가 'var(--up)' 같은
 *  원문 문자열을 그대로 돌려준다(CardTile.test.tsx의 backgroundColor와 같은 원리). */
function strokeOf(el: Element): string {
  return getComputedStyle(el).stroke
}

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
    const upColor = strokeOf(up.container.querySelector('polyline')!)
    up.unmount()
    const down = render(<PriceChart history={[130, 100]} />)
    const downColor = strokeOf(down.container.querySelector('polyline')!)
    down.unmount()
    const flat = render(<PriceChart history={[100, 100]} />)
    const flatColor = strokeOf(flat.container.querySelector('polyline')!)
    flat.unmount()
    expect(upColor).not.toBe(downColor)
    expect(upColor).not.toBe(flatColor)
    expect(downColor).not.toBe(flatColor)
  })

  // Task 15 Fix Round 1 Major 2 — 예전엔 stroke가 리터럴 hex라 tokens.css와 값이 중복됐다.
  // 이제는 var(--up)/var(--down)/var(--neutral)를 참조만 한다. "서로 다르다"만 보는 위
  // 테스트는 오타(var(--upp) 등)로 세 값이 여전히 서로 다른 채로 남아도 못 잡으므로,
  // CardTile.test.tsx의 등급색 패턴과 동일하게 "참조하는 이름이 tokens.css에 실제로
  // 정의돼 있는가"를 직접 검사한다.
  describe('스파크라인이 참조하는 CSS 변수가 tokens.css에 실제로 존재한다', () => {
    it('상승·하락·보합·1개데이터 네 경우 전부 var(--x) 형태이고 그 x가 tokens.css에 정의돼 있다', () => {
      const cases: { history: number[]; label: string }[] = [
        { history: [100, 130], label: '상승' },
        { history: [130, 100], label: '하락' },
        { history: [100, 100], label: '보합' },
        { history: [100], label: '1개데이터' },
      ]
      for (const { history, label } of cases) {
        const { container, unmount } = render(<PriceChart history={history} />)
        const el = container.querySelector('polyline') ?? container.querySelector('line')
        expect(el, `${label}: polyline도 line도 없다`).not.toBeNull()
        const stroke = strokeOf(el!)
        const m = stroke.match(/^var\(--([a-zA-Z0-9-]+)\)$/)
        expect(m, `${label}: stroke가 var(--x) 형태가 아니다: "${stroke}"`).not.toBeNull()
        expect(
          definesCustomProperty(tokensCss, m![1]!),
          `${label}: --${m ? m[1] : '?'}가 tokens.css에 정의돼 있지 않다`,
        ).toBe(true)
        unmount()
      }
    })

    // 한국 관례(상승 빨강/하락 파랑)는 design/tokens.test.ts의 "--up은 빨강 계열이다"가
    // 이미 고정한다. 여기서는 그 사슬의 나머지 절반 — "상승일 때 실제로 --up을,
    // 하락일 때 실제로 --down을 가리키는가" — 을 리터럴 var() 문자열로 못박는다.
    // 두 테스트를 합치면 "상승은 실제로 빨강이다"가 전이적으로 성립한다.
    it('상승은 정확히 var(--up), 하락은 정확히 var(--down)을 가리킨다', () => {
      const up = render(<PriceChart history={[100, 130]} />)
      expect(strokeOf(up.container.querySelector('polyline')!)).toBe('var(--up)')
      up.unmount()
      const down = render(<PriceChart history={[130, 100]} />)
      expect(strokeOf(down.container.querySelector('polyline')!)).toBe('var(--down)')
      down.unmount()
    })
  })

  // Minor 1 — 색·데이터 반영 테스트는 방향(상승이 위로 그려지는가) 자체는 안 본다.
  // SVG는 y가 아래로 갈수록 커진다 — 가격이 오르면 화면 위쪽(작은 y)으로 가야 한다.
  it('단조 증가하는 이력은 y좌표가 단조 감소한다 (SVG는 위가 작은 y, Minor 1)', () => {
    const { container } = render(<PriceChart history={[100, 150, 200]} width={100} height={50} />)
    const raw = container.querySelector('polyline')!.getAttribute('points')!.trim()
    const ys = raw.split(' ').map(pair => Number(pair.split(',')[1]))
    expect(ys).toHaveLength(3)
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!, `y[${i}]=${ys[i]}가 y[${i - 1}]=${ys[i - 1]}보다 작아야(위로 그려져야) 한다`)
        .toBeLessThan(ys[i - 1]!)
    }
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

  describe('시세 카드 스파크라인', () => {
    it('종목마다 스파크라인 svg가 렌더된다', () => {
      render(<MarketScreen />)
      expect(screen.getByTestId('spark-sjc').querySelector('svg')).not.toBeNull()
    })

    it('1턴차(히스토리 1개)에도 빈 상자가 아니라 기준선이 보인다', () => {
      // 1차 개발 사고 재발 방지(MU8) — history.length===1 처리가 빠지면 <polyline
      // points="x,y">(좌표쌍 1개) 하나만 남아 화면엔 빈 상자로 보인다. element 존재만
      // 보면 이 결함을 못 잡으므로 <line> 플레이스홀더 또는 실제 좌표쌍 2개 이상을 요구한다.
      expect(currentState().turn).toBe(1)
      render(<MarketScreen />)
      const spark = screen.getByTestId('spark-sjc')
      const line = spark.querySelector('line')
      const poly = spark.querySelector('polyline')
      const polyHasSegment = poly ? (poly.getAttribute('points') ?? '').trim().includes(' ') : false
      expect(!!line || polyHasSegment).toBe(true)
    })

    it('종목마다 실제 history를 반영한다 — 상수 배열로 바꾸면(MU7) 전부 같아져 실패한다', () => {
      const s = currentState()
      useGame.setState({ state: {
        ...s,
        stocks: s.stocks.map(x => {
          if (x.id === 'sjc') return { ...x, history: [100, 200, 150] }
          if (x.id === 'def') return { ...x, history: [50, 60] }
          return x
        }),
      } })
      render(<MarketScreen />)
      const sjcPoints = screen.getByTestId('spark-sjc').querySelector('polyline')!.getAttribute('points')
      const defPoints = screen.getByTestId('spark-def').querySelector('polyline')!.getAttribute('points')
      expect(sjcPoints).not.toBe(defPoints)
    })

    it('턴이 지나 history가 늘어나면 같은 종목의 스파크라인도 바뀐다', () => {
      const s = currentState()
      useGame.setState({ state: {
        ...s, stocks: s.stocks.map(x => x.id === 'sjc' ? { ...x, history: [100, 200, 150] } : x),
      } })
      render(<MarketScreen />)
      const before = screen.getByTestId('spark-sjc').querySelector('polyline')!.getAttribute('points')

      act(() => {
        const s2 = currentState()
        useGame.setState({ state: {
          ...s2, stocks: s2.stocks.map(x => x.id === 'sjc' ? { ...x, history: [...x.history, 400] } : x),
        } })
      })
      const after = screen.getByTestId('spark-sjc').querySelector('polyline')!.getAttribute('points')
      expect(after).not.toBe(before)
    })

    it('상승은 var(--up)(빨강), 하락은 var(--down)(파랑)으로 그려진다 (한국 관례, MU9)', () => {
      // 제약값(색 관례)은 리터럴로 적는다 — PriceChart는 이제 var(--up)/var(--down)로
      // 토큰을 간접 참조하므로(Fix Round 1 Major 2), 여기서 확인하는 건 "실제 hex 빨강"이
      // 아니라 "시세 카드가 올바른 토큰 이름을 참조하는가"다. --up이 실제로 빨강 계열임은
      // design/tokens.test.ts의 "한국 관례 색" describe가 별도로 고정한다 — 두 테스트를
      // 합치면 "상승은 실제로 빨강이다"가 전이적으로 성립한다.
      const UP = 'var(--up)'
      const DOWN = 'var(--down)'
      const s = currentState()
      useGame.setState({ state: {
        ...s, stocks: s.stocks.map(x => x.id === 'sjc' ? { ...x, history: [100, 200] } : x),
      } })
      render(<MarketScreen />)
      const upStroke = strokeOf(screen.getByTestId('spark-sjc').querySelector('polyline')!)
      expect(upStroke).toBe(UP)

      act(() => {
        const s2 = currentState()
        useGame.setState({ state: {
          ...s2, stocks: s2.stocks.map(x => x.id === 'sjc' ? { ...x, history: [200, 100] } : x),
        } })
      })
      const downStroke = strokeOf(screen.getByTestId('spark-sjc').querySelector('polyline')!)
      expect(downStroke).toBe(DOWN)
    })
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
  // Task 22(§6 "타격감") — 손절 봉인은 더 이상 진짜 HTML disabled가 아니다. disabled
  // 버튼은 클릭 이벤트 자체를 받지 못해(실측 확인) 흔들림 피드백(animation.test.tsx의
  // "막힌 동작은 흔들림 클래스를 받는다")을 낼 방법이 없기 때문이다 — 그래서 이 상태는
  // `aria-disabled="true"` + `.locked` 클래스로 "잠겼다"는 사실을 알리면서도 클릭은
  // 계속 받는다. "잠긴다"는 사용자 관점 사실은 그대로 고정하되(약화가 아니다), 그
  // 사실을 표현하는 속성만 바뀐 것을 반영한다.
  it('손절 봉인 상태면 매도 버튼이 잠기고(aria-disabled) 사유가 보이며, 눌러도 매도되지 않는다', () => {
    useGame.getState().doBuy('sjc', 1)
    const s = useGame.getState().state!
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, mental: 5 },
      stocks: s.stocks.map(x => x.id === 'sjc' ? { ...x, price: Math.round(x.price * 0.5) } : x),
    } })
    render(<StockDetail />)
    const sellBtn = screen.getByTestId('sell')
    expect(sellBtn.hasAttribute('disabled')).toBe(false) // 네이티브 disabled는 아니다 — 클릭은 받는다
    expect(sellBtn.getAttribute('aria-disabled')).toBe('true')
    expect(sellBtn.classList.contains('locked')).toBe(true)
    expect(screen.getByText(/손이 안 나간다/)).toBeDefined()

    const before = useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty
    fireEvent.click(sellBtn)
    expect(useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(before)
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

  // Fix Round 2 #1 — 리뷰가 발견: 입력 클램프(onChange의 Math.max(0, ...))를 지우는
  // 뮤테이션이 전체 스위트(438개)를 그대로 통과했다. 클램프가 뚫리면 canSellQty가
  // (당시엔 held.qty >= qty만 봤다) 음수 qty에서 항상 참이 되어 매도 버튼이 거짓으로
  // 활성 상태를 유지했다. 화면에 음수로 안 남는지(클램프)와 매수·매도 버튼이 여전히
  // 비활성인지(조건 자체) 둘 다 이 테스트로 고정한다.
  it('수량에 음수를 입력해도 화면에 음수로 남지 않고 매수·매도 버튼이 거짓으로 활성화되지 않는다', () => {
    useGame.getState().doBuy('sjc', 3) // 보유를 만들어 매도 경로도 함께 확인
    render(<StockDetail />)
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '-5' } })
    const qtyInput = screen.getByTestId('qty') as HTMLInputElement
    expect(Number(qtyInput.value)).toBeGreaterThanOrEqual(0) // 클램프 — 화면에 음수로 안 남는다
    expect(screen.getByTestId('buy').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('sell').hasAttribute('disabled')).toBe(true)
    // 눌러도(만에 하나 활성이었더라도) 보유가 안 바뀐다 — core의 BAD_QTY가 이중 방어선이다.
    fireEvent.click(screen.getByTestId('sell'))
    expect(useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(3)
  })
})

describe('물타기 버튼', () => {
  it('보유하지 않은 종목에는 버튼이 없다 (MU1)', () => {
    renderDetail({ stockId: 'sjc', holdings: [] })
    expect(screen.queryByTestId('average-down')).toBeNull()
  })

  // Fix Round 2 #2(리뷰) — canAverageDown이 status를 안 봐서, 게임이 끝난 상태에서
  // 물타기 조건(보유·평단 이하·현금 충분)을 다 만족하는 손실 포지션이 있으면
  // GameError(NOT_PLAYING)가 클릭 시 사용자에게 그대로 전파됐다(guard() 안 거치던
  // 시절과 달리 이제는 store가 guard 없이 직접 commit하므로 core 자체가 막아야 한다).
  it('게임이 끝난 상태면 물타기 버튼이 비활성이고 사유가 보인다', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
      override: { status: 'ended' },
    })
    const btn = screen.getByTestId('average-down')
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('average-down-reason').textContent).toContain('게임이 끝났다')
    // 던지지 않는다 — 클릭해도 조용히 무반응이어야 한다(비활성 버튼은 클릭이 안 먹지만
    // 이중 방어로 core 레벨까지 확인한다).
    expect(() => fireEvent.click(btn)).not.toThrow()
    expect(useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(10)
  })

  it('평단보다 비싸면 비활성이고 core가 주는 사유가 그대로 보인다 (MU2·MU3)', () => {
    renderDetail({
      stockId: 'sjc', price: 12000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    const btn = screen.getByTestId('average-down')
    expect(btn.hasAttribute('disabled')).toBe(true)
    // core의 canAverageDown이 실제로 주는 문구다 — app에서 다시 쓰지 않고 그대로 보인다.
    expect(screen.getByTestId('average-down-reason').textContent).toContain('평단보다 싸야')
  })

  it('평단보다 싸면 활성이다', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    expect(screen.getByTestId('average-down').hasAttribute('disabled')).toBe(false)
    expect(screen.queryByTestId('average-down-reason')).toBeNull()
  })

  it('물타기 후 평단이 실제로 내려간다', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    const before = Number(screen.getByTestId('avg-cost').getAttribute('data-value'))
    fireEvent.click(screen.getByTestId('average-down'))
    expect(Number(screen.getByTestId('avg-cost').getAttribute('data-value'))).toBeLessThan(before)
  })

  // Fix Round 1 Major 1 — 예전엔 클릭 한 번으로 항상 현금 전액이 들어갔다. 화면에 이미
  // 있는 "수량" 입력을 재사용해 budget = price*qty(+수수료)로 넘기도록 바꿨다. 아래
  // 세 테스트가 그 배선을 고정한다.
  it('qty를 바꾸면 실제로 사들이는 수량도 그만큼 바뀐다 (budget이 화면 입력을 따라간다)', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('average-down'))
    expect(useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(12) // 10 + 2

    // 같은 판을 이어서 — qty를 5로 바꿔 다시 누르면 5주가 더 들어가야 한다(현금은
    // 넉넉하므로 이 델타가 곧 budget이 실제로 qty를 따라간다는 증거다).
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId('average-down'))
    expect(useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(17) // 12 + 5
  })

  it('qty가 살 수 있는 수량을 넘으면 core가 잘라낸다 — 요청한 수량이 아니라 감당 가능한 수량만 산다', () => {
    // price=5000일 때 3주를 사는 데 정확히 필요한 현금(원금+수수료)만 쥐여준다.
    // 수수료율(BALANCE.feeRate=0.00015)과 최소수수료(1원) 규칙은 core 값이라 여기서
    // 다시 계산하지 않고, "3주째까지는 사지고 4주째는 못 산다"는 경계를 직접 만든다.
    const price = 5000
    const grossFor3 = price * 3
    const feeFor3 = Math.max(1, Math.floor((grossFor3 * 150) / 1_000_000)) // BALANCE.feeRate=0.00015
    const cashFor3 = grossFor3 + feeFor3
    renderDetail({
      stockId: 'sjc', price, cash: cashFor3,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    // 10주를 물타려 하지만 현금은 정확히 3주치뿐이다.
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '10' } })
    fireEvent.click(screen.getByTestId('average-down'))
    const held = useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!
    expect(held.qty).toBe(13) // 10 + 3 — core가 요청한 10이 아니라 감당 가능한 3만 산다
    expect(useGame.getState().state!.player.cash).toBe(0) // 정확히 3주치 현금을 다 썼다
  })

  it('qty가 0(빈 칸)이면 물타기 버튼이 비활성화된다', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    expect(screen.getByTestId('average-down').hasAttribute('disabled')).toBe(false) // 기본 qty=1이면 활성
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '' } })
    const btn = screen.getByTestId('average-down')
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('average-down-reason')).not.toBeNull()
    // 비활성 상태에서 눌러도(disabled 버튼은 클릭이 발화하지 않지만, 이중 방어로) 보유가
    // 늘지 않는다는 것까지 확인한다.
    fireEvent.click(btn)
    expect(useGame.getState().state!.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(10)
  })

  // Fix Round 2 #1 — 세 경로(매수·매도·물타기) 중 물타기 쪽. averageDownDisabled는
  // 이미 qty < 1을 보므로(0도 음수도 함께 막힌다) 이 경로는 원래도 안전했지만,
  // "세 경로 모두 확인" 지시에 맞춰 여기서도 직접 고정한다.
  it('수량에 음수를 입력해도 물타기 버튼이 거짓으로 활성화되지 않는다', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    fireEvent.change(screen.getByTestId('qty'), { target: { value: '-3' } })
    const qtyInput = screen.getByTestId('qty') as HTMLInputElement
    expect(Number(qtyInput.value)).toBeGreaterThanOrEqual(0)
    expect(screen.getByTestId('average-down').hasAttribute('disabled')).toBe(true)
  })

  it('물타기는 주간 행동이 아니다 — 턴·행동력·리롤을 소모하지 않는다 (MU5)', () => {
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    const beforeRerolls = currentState().rerollsLeft
    const beforeSlots = currentState().slots
    const beforePicked = useGame.getState().picked
    fireEvent.click(screen.getByTestId('average-down'))
    expect(currentState().turn).toBe(1) // 턴이 넘어가지 않는다
    expect(currentState().rerollsLeft).toBe(beforeRerolls)
    // 행동력 관련 상태 — slots는 advanceTurn/doReroll만 새로 뽑는다. 참조가 그대로면
    // 행동 슬롯이 소모되거나 다시 뽑히지 않았다는 뜻이다.
    expect(currentState().slots).toBe(beforeSlots)
    expect(useGame.getState().picked).toEqual(beforePicked)
  })

  it('물타기 버튼의 터치 타깃이 44px 이상이다 (MU11, Global Constraints)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    renderDetail({
      stockId: 'sjc', price: 5000, cash: 1_000_000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 1 }],
    })
    const style = getComputedStyle(screen.getByTestId('average-down'))
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
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

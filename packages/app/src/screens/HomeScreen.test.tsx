import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HomeScreen } from './HomeScreen'
import { Hud } from '../components/Hud'
import { useGame } from '../store/store'
import { won, pct, yearWeek } from '../format'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('format', () => {
  it('won은 천단위 구분과 원을 붙인다', () => expect(won(84_320_000)).toBe('84,320,000원'))
  it('pct는 부호를 붙인다', () => { expect(pct(18.44)).toBe('+18.4%'); expect(pct(-3.2)).toBe('-3.2%') })
  it('yearWeek는 연차·주차로 바꾼다', () => {
    expect(yearWeek(1)).toBe('1년차 1주')
    expect(yearWeek(53)).toBe('2년차 1주')
    expect(yearWeek(156)).toBe('3년차 52주')
  })
})

describe('Hud', () => {
  it('자산과 게이지를 보여준다', () => {
    render(<Hud />)
    expect(screen.getByText('3,000,000원')).toBeDefined()
    expect(screen.getByTestId('gauge-mental')).toBeDefined()
    expect(screen.getByTestId('gauge-condition')).toBeDefined()
    expect(screen.getByText('주린이')).toBeDefined()
  })
})

describe('HomeScreen', () => {
  it('행동 카드가 렌더된다', () => {
    render(<HomeScreen />)
    expect(screen.getAllByTestId(/^card-/).length).toBeGreaterThan(5)
  })
  it('카드를 고르기 전에는 턴 넘기기가 비활성이다', () => {
    render(<HomeScreen />)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
  })
  it('카드를 고르면 활성화되고 턴이 넘어간다', () => {
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('card-hodl'))
    const btn = screen.getByTestId('next-turn')
    expect(btn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(btn)
    expect(useGame.getState().state!.turn).toBe(2)
  })
  it('흔들림 상태에서 이성 카드가 잠긴다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 10 } } })
    render(<HomeScreen />)
    expect(screen.getByTestId('card-analyze').hasAttribute('disabled')).toBe(true)
  })
  it('흔들림에서도 회복 카드는 열려 있고 최상단에 온다 (스펙 §3.3)', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 5 } } })
    render(<HomeScreen />)
    for (const id of ['rest', 'exercise', 'drink']) {
      expect(screen.getByTestId(`card-${id}`).hasAttribute('disabled')).toBe(false)
    }
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^card-/)[0]!
    expect(['card-rest', 'card-exercise', 'card-drink']).toContain(first.getAttribute('data-testid'))
  })
  it('퇴사 상태면 카드 2장을 고를 수 있다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, employed: false } } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('card-hodl'))
    fireEvent.click(screen.getByTestId('card-news'))
    fireEvent.click(screen.getByTestId('next-turn'))
    expect(useGame.getState().state!.turn).toBe(2)
    expect(useGame.getState().state!.player.stats.info).toBeGreaterThan(0)
  })
  it('잠긴 카드를 클릭해도 선택 상태가 바뀌지 않고 턴 넘기기는 계속 비활성이다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 10 } } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('card-analyze')) // 잠긴 카드
    expect(screen.getByTestId('card-analyze').className).not.toMatch(/picked/)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
  })
})

describe('CardGrid 정렬 — 흔들림 여부에 따라 실제로 순서가 달라지는가', () => {
  it('흔들리지 않을 때는 카드 원본 순서를 유지한다 (첫 카드는 회복 카드가 아니다)', () => {
    render(<HomeScreen />)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^card-/)[0]!
    expect(first.getAttribute('data-testid')).toBe('card-overtime')
  })
  it('멘탈 30(경계 바로 위, 비흔들림)에서는 회복 카드가 최상단이 아니다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 30 } } })
    render(<HomeScreen />)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^card-/)[0]!
    expect(['card-rest', 'card-exercise', 'card-drink']).not.toContain(first.getAttribute('data-testid'))
  })
  it('멘탈 29(경계, 흔들림)에서는 회복 카드가 최상단으로 온다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 29 } } })
    render(<HomeScreen />)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^card-/)[0]!
    expect(['card-rest', 'card-exercise', 'card-drink']).toContain(first.getAttribute('data-testid'))
  })
})

describe('무드 전환 임계값 — shaken/joy/normal 경계', () => {
  const SHAKEN_MARK = 'M70 34 q6 10 2 18' // 캐릭터 SVG의 눈물 경로: shaken 전용
  const JOY_MARK = 'M38 54 q12 12 24 0'   // 캐릭터 SVG의 활짝 웃는 입 경로: joy 전용

  it('멘탈 29(경계)에서는 shaken 캐릭터를 그린다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 29 } } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).toContain(SHAKEN_MARK)
    expect(container.innerHTML).not.toContain(JOY_MARK)
  })
  it('멘탈 30(경계 바로 위)에서는 shaken이 아니라 normal(또는 joy) 캐릭터를 그린다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 30 } } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).not.toContain(SHAKEN_MARK)
  })
  it('수익률 +20.0%(경계)에서는 joy 캐릭터를 그린다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: 3_600_000 } } }) // (3.6M-3M)/3M = 20%
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).toContain(JOY_MARK)
  })
  it('수익률 +19.9%(경계 바로 아래)에서는 joy가 아니라 normal 캐릭터를 그린다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: 3_599_999 } } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).not.toContain(JOY_MARK)
    expect(container.innerHTML).not.toContain(SHAKEN_MARK)
  })
})

describe('format 경계값', () => {
  it('pct(0)은 +부호를 붙인다', () => expect(pct(0)).toBe('+0.0%'))
  it('won(0)은 0원이다', () => expect(won(0)).toBe('0원'))
  it('yearWeek(52)는 1년차 마지막 주다', () => expect(yearWeek(52)).toBe('1년차 52주'))
})

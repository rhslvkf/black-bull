import { describe, it, expect } from 'vitest'
import { initGame, advanceTurn, cardsPerTurn } from './advance'
import { buy } from './trade'
import { totalAssets } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'

const run = (s = initGame(1), cards: string[] = ['hodl']) => advanceTurn(s, cards)

describe('initGame', () => {
  it('초기 상태가 스펙대로다', () => {
    const s = initGame(42)
    expect(s.turn).toBe(1)
    expect(s.player.cash).toBe(BALANCE.seedMoney)
    expect(s.player.mental).toBe(100)
    expect(s.player.condition).toBe(100)
    expect(s.player.tier).toBe(0)
    expect(s.player.employed).toBe(true)
    expect(s.stocks).toHaveLength(10)
    expect(s.regimes).toHaveLength(156)
    expect(s.status).toBe('playing')
  })
  it('같은 시드는 같은 초기 상태', () => {
    expect(initGame(7)).toEqual(initGame(7))
  })
  it('다른 시드는 다른 국면', () => {
    expect(initGame(1).regimes).not.toEqual(initGame(2).regimes)
  })
})

describe('advanceTurn', () => {
  it('턴이 1 증가한다', () => expect(run().turn).toBe(2))
  it('가격 히스토리가 늘어난다', () => {
    expect(run().stocks[0]!.history.length).toBe(2)
  })
  it('카드 효과가 반영된다', () => {
    expect(run(initGame(1), ['news']).player.stats.info).toBeGreaterThan(0)
  })
  it('재직 중엔 카드 1장, 2장은 거부된다', () => {
    expect(cardsPerTurn(initGame(1))).toBe(1)
    expect(() => advanceTurn(initGame(1), ['hodl', 'news'])).toThrow(/TOO_MANY_CARDS/)
  })
  it('퇴사 후엔 2장까지 쓸 수 있다', () => {
    const s = initGame(1)
    s.player.employed = false
    expect(cardsPerTurn(s)).toBe(2)
    expect(() => advanceTurn(s, ['hodl', 'news'])).not.toThrow()
  })
  it('선택지가 남아 있으면 진행이 막힌다', () => {
    const s = { ...initGame(1), pendingChoices: [{ eventId: 'x' }] }
    expect(() => advanceTurn(s, ['hodl'])).toThrow(GameError)
  })
  it('cutscene은 매 턴 초기화된다', () => {
    const s = { ...initGame(1), cutscene: 'cutscene.promote.1' }
    expect(advanceTurn(s, ['hodl']).cutscene === 'cutscene.promote.1').toBe(false)
  })
  it('보유 종목의 heldTurns가 증가한다', () => {
    const s = advanceTurn(buy(initGame(1), 'sjc', 1), ['hodl'])
    expect(s.player.holdings[0]!.heldTurns).toBe(1)
  })
  it('4턴째에 월급이 들어온다', () => {
    let s = initGame(1)
    const cash0 = s.player.cash
    // 실제 이벤트 콘텐츠에서 seed=1은 3턴째에 선택지 이벤트(p_salary_day)를 뽑는다.
    // 이 테스트는 급여 타이밍만 검증하므로, 형제 루프 테스트들과 같은 패턴으로
    // 매 턴 pendingChoices를 비워 무관한 CHOICE_PENDING을 피한다.
    for (let i = 0; i < 4; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(s.player.cash).toBe(cash0 + BALANCE.employedNet)
  })
  it('멘탈·컨디션이 0~100을 벗어나지 않는다', () => {
    let s = initGame(5)
    for (let i = 0; i < 100; i++) {
      s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
      expect(s.player.mental).toBeGreaterThanOrEqual(0)
      expect(s.player.mental).toBeLessThanOrEqual(100)
      expect(s.player.condition).toBeGreaterThanOrEqual(0)
      expect(s.player.condition).toBeLessThanOrEqual(100)
    }
  })
  it('156턴에 도달하면 종료된다', () => {
    let s = initGame(3)
    for (let i = 0; i < 156; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(s.status).toBe('ended')
    expect(s.ending).not.toBeNull()
    expect(s.turn).toBe(156)
  })
  it('종료 후 추가 진행은 거부된다', () => {
    let s = initGame(3)
    for (let i = 0; i < 156; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(() => advanceTurn(s, ['hodl'])).toThrow(/NOT_PLAYING/)
  })
  it('자산이 0 이하면 즉시 파산 종료된다', () => {
    const s = initGame(9)
    s.player.cash = 0
    s.player.loan = 1_000_000
    const r = advanceTurn(s, ['hodl'])
    expect(r.status).toBe('ended')
    expect(r.ending!.endingId).toBe('legend')
  })
  it('같은 시드·같은 입력이면 결과가 동일하다 (결정론)', () => {
    const play = (seed: number) => {
      let s = initGame(seed)
      for (let i = 0; i < 60; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
      return s
    }
    expect(play(11)).toEqual(play(11))
  })
  it('입력 상태를 변경하지 않는다', () => {
    const s = initGame(1)
    const snapshot = structuredClone(s)
    advanceTurn(s, ['news'])
    expect(s).toEqual(snapshot)
  })
  it('아무 것도 안 사면 자산이 완만하게만 움직인다', () => {
    let s = initGame(4)
    for (let i = 0; i < 20; i++) s = advanceTurn({ ...s, pendingChoices: [] }, ['hodl'])
    expect(totalAssets(s)).toBeGreaterThan(BALANCE.seedMoney * 0.9)
  })
})

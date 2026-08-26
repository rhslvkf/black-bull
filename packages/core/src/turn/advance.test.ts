import { describe, it, expect } from 'vitest'
import { initGame, advanceTurn } from './advance'
import { actionPoints, cardApCost } from './cards'
import { gradeAp } from './grade'
import { buy } from './trade'
import { totalAssets } from './accounting'
import { BALANCE } from '../balance'
import { GameError } from '../error'
import { resolveChoice } from '../events/engine'
import { loadEvents } from '../events/content'
import { stepPrices } from '../market/price'
import { makeState, slotsWith } from '../testkit'
import type { Regime } from '../types'

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

describe('행동력', () => {
  it('체력 0이면 기본값이다', () => {
    expect(actionPoints(makeState({ player: { stats: { stamina: 0 } } }))).toBe(BALANCE.action.base)
  })
  it('체력이 오르면 행동력이 늘어난다', () => {
    const lo = actionPoints(makeState({ player: { stats: { stamina: 0 } } }))
    const hi = actionPoints(makeState({ player: { stats: { stamina: 9 } } }))
    expect(hi).toBeGreaterThan(lo)
  })
  it('퇴사하면 보너스를 받는다', () => {
    const emp = actionPoints(makeState({ player: { employed: true, stats: { stamina: 3 } } }))
    const un  = actionPoints(makeState({ player: { employed: false, stats: { stamina: 3 } } }))
    expect(un - emp).toBe(BALANCE.action.unemployedBonus)
  })
  it('상한을 넘지 않는다', () => {
    expect(actionPoints(makeState({ player: { employed: false, stats: { stamina: 99 } } })))
      .toBeLessThanOrEqual(BALANCE.action.max)
  })
  it('회복 카드는 행동력을 쓰지 않는다', () => {
    for (const id of ['rest', 'exercise', 'drink', 'hodl']) expect(cardApCost(id, 'S')).toBe(0)
  })
  it('행동 카드는 등급을 따라 행동력을 쓴다', () => {
    expect(cardApCost('analyze', 'E')).toBe(gradeAp('E'))
    expect(cardApCost('analyze', 'S')).toBe(gradeAp('S'))
  })
})

describe('advanceTurn 행동력 예산', () => {
  it('예산을 넘는 조합은 거부된다', () => {
    const s = makeState({ player: { stats: { stamina: 0 } } })
    // base=2인 상태에서 ⚡3짜리를 넣으면 초과
    expect(() => advanceTurn({ ...s, slots: slotsWith('analyze', 'S') }, ['analyze'])).toThrow(/NO_AP/)
  })
  it('회복 카드는 예산과 무관하게 항상 쓸 수 있다', () => {
    const s = makeState({ player: { stats: { stamina: 0 }, mental: 5 } })
    expect(() => advanceTurn({ ...s, slots: slotsWith('rest', 'C') }, ['rest'])).not.toThrow()
  })
  it('행동력이 매우 낮아도(체력 0·재직·컨디션 0) 회복 카드만으로 턴을 넘길 수 있다 (교착 방지)', () => {
    const s = makeState({ player: { employed: true, condition: 0, stats: { stamina: 0 } } })
    expect(() => advanceTurn({ ...s, slots: slotsWith('rest', 'S') }, ['rest'])).not.toThrow()
  })
  it('정확히 예산만큼 쓰는 조합은 허용된다 (경계값)', () => {
    // base=2 상태에서 등급 C(⚡2)는 예산과 정확히 같다 — 경계에서 거부되면 안 된다.
    const s = makeState({ player: { stats: { stamina: 0 } } })
    expect(actionPoints(s)).toBe(2)
    expect(() => advanceTurn({ ...s, slots: slotsWith('analyze', 'C') }, ['analyze'])).not.toThrow()
  })
  it('슬롯의 실제 등급이 예산 계산에 쓰인다', () => {
    // 같은 카드라도 슬롯에 박힌 등급에 따라 통과/거부가 갈려야 한다 — 등급을 무시하고
    // 항상 중립값으로 계산하면 이 두 기대값이 같아져 버린다.
    const s = makeState({ player: { stats: { stamina: 0 } } }) // budget = 2
    expect(() => advanceTurn({ ...s, slots: slotsWith('analyze', 'E') }, ['analyze'])).not.toThrow() // ⚡1
    expect(() => advanceTurn({ ...s, slots: slotsWith('analyze', 'S') }, ['analyze'])).toThrow(/NO_AP/) // ⚡3
  })
  it('두 장 이상을 쓰면 각 장의 비용이 합산돼 예산 검사에 반영된다', () => {
    const s = makeState({ player: { employed: false, stats: { stamina: 0 } } })
    expect(actionPoints(s)).toBe(4)
    // analyze는 슬롯에서 S(⚡3), report는 슬롯에 없어 기본 등급 C(⚡2)로 계산된다.
    // 합산하면 3+2=5로 예산 4를 넘어 거부돼야 한다 — 첫 장(analyze, ⚡3)만 보면
    // 4 이내라 통과해버린다.
    expect(() => advanceTurn({ ...s, slots: slotsWith('analyze', 'S') }, ['analyze', 'report']))
      .toThrow(/NO_AP/)
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
  it('회복 카드 + 예산 안의 행동 카드 조합은 허용된다', () => {
    // base=2인 상태에서 hodl(회복, 0) + news(⚡2)는 기본 예산 2 안에 들어간다.
    expect(() => advanceTurn(initGame(1), ['hodl', 'news'])).not.toThrow()
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

// Fix Round 1 of 5 — 리뷰가 지목한 공백(B: 6/8단계·강제스킵·국면 인덱싱이 무탐지,
// C: 156턴 루프 전부가 pendingChoices를 버리는 인공 경로만 탐)을 메우는 테스트.
// 각 테스트는 대응 뮤테이션을 실제로 넣고 실패를 확인한 뒤 원복했다 — 보고서 참고.
describe('advanceTurn — 조립 단계별 실제 반영 확인 (fix round 1)', () => {
  it('T-B1: 게이지 정산이 실제 값으로 반영된다', () => {
    const s = initGame(1)
    // news: condition -4(pending) + drainEmployed -4(resist=1, stamina=0) = 100 -> 92
    const r = advanceTurn(s, ['news'])
    expect(r.player.condition).toBe(92)
  })

  it('T-B2: 트래커가 실제로 누적된다', () => {
    const pool = loadEvents()
    let s = initGame(2)
    for (let i = 0; i < 5; i++) {
      while (s.pendingChoices.length > 0) s = resolveChoice(s, s.pendingChoices[0]!.eventId, 0, pool)
      s = advanceTurn(s, ['hodl'])
    }
    expect(s.trackers.turnsCounted).toBe(5)
    expect(s.trackers.cashRatioSum).toBeGreaterThan(0)
  })

  it('T-B3: 번아웃 강제 스킵이면 카드가 무시된다', () => {
    const base = initGame(1)
    const s = { ...base, player: { ...base.player, burnoutTurns: 2 } }
    const r = advanceTurn(s, ['news']) // news: info +0.45 — 스킵되면 반영 안 돼야 함
    expect(r.player.stats.info).toBe(0)
    expect(r.player.burnoutTurns).toBe(1)
  })

  it('T-B4: 가격 계산이 turn-1 국면을 쓴다', () => {
    const base = initGame(1)
    const regimes: Regime[] = ['crash', 'boom', ...base.regimes.slice(2)]
    const forced = { ...base, regimes }
    const r = advanceTurn(forced, [])
    const [expectedStocks] = stepPrices(forced.stocks, forced.stockDefs, 'crash', new Map(), forced.rng)
    expect(r.stocks.map(x => x.price)).toEqual(expectedStocks.map(x => x.price))
  })

  it('T-M1: 정산 후 pending 플래그 키가 남지 않는다', () => {
    const s = initGame(1)
    const r = advanceTurn(s, ['hodl'])
    expect(Object.prototype.hasOwnProperty.call(r.flags, '__mentalPending')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(r.flags, '__conditionPending')).toBe(false)
  })

  it('T-C2: 실제 선택지 해결을 포함한 156턴 결정론', () => {
    const play = (seed: number) => {
      const pool = loadEvents()
      let s = initGame(seed)
      for (let i = 0; i < 156; i++) {
        while (s.pendingChoices.length > 0) s = resolveChoice(s, s.pendingChoices[0]!.eventId, 0, pool)
        s = advanceTurn(s, ['hodl'])
      }
      return s
    }
    expect(play(11)).toEqual(play(11))
  })
})

// Ruling 49 — regimes[turn-1] 폴백 제거, 범위를 벗어나면 명시적으로 던진다.
describe('advanceTurn — 국면 인덱스 폴백 제거 (Ruling 49)', () => {
  it('정상 범위를 벗어난 turn에서는 조용히 넘어가지 않고 BAD_TURN을 던진다', () => {
    const s = { ...initGame(1), turn: 200 } // regimes 길이(156)를 넘는 turn을 직접 주입
    expect(() => advanceTurn(s, ['hodl'])).toThrow(/BAD_TURN/)
  })
})

// Ruling 50 — 종료 시 남은 선택지를 비워, judgeEnding 확정 후 사후 변경을 막는다.
describe('advanceTurn — 종료 시 선택지 정리 (Ruling 50)', () => {
  it('156턴째에 새로 뽑힌 선택지가 있어도 종료 시 pendingChoices가 비워진다', () => {
    // 브리프 자신의 시드(seed=1) — 실제로 156턴째에 p_salary_day 선택지가 새로 뽑힌다.
    const pool = loadEvents()
    let s = initGame(1)
    for (let i = 0; i < 156; i++) {
      while (s.pendingChoices.length > 0) s = resolveChoice(s, s.pendingChoices[0]!.eventId, 0, pool)
      s = advanceTurn(s, ['hodl'])
    }
    expect(s.status).toBe('ended')
    expect(s.pendingChoices).toEqual([])
  })
})

/**
 * 최종 리뷰 M1 — 턴 루프 8단계 중 3단계(신용·티어·라이벌)는 통째로 지워도 545개가
 * 전부 그린이었다. Task 15가 게이지·트래커에 대해 세운 T-B1/T-B2 처방("루프에 실제로
 * 연결돼 있다"를 값으로 단언한다)을 나머지 단계에도 적용한다.
 *
 * settleTier 제거의 파급이 가장 크다: 티어가 영원히 0이라 tierGate 종목 7종이 영구
 * 잠기고 승급·강등 컷신 10종이 한 번도 뜨지 않는다.
 */
describe('advanceTurn — 턴 루프 조립 확인 T-B5~T-B9 (최종 리뷰 M1)', () => {
  it('T-B5: 티어 문턱을 넘은 자산으로 1턴 진행하면 티어가 오르고 컷신이 세팅된다', () => {
    const base = initGame(1)
    // 티어 2 문턱(5천만) 위로 올려둔다. 이벤트 현금 효과가 끼어도 티어가 바뀌지 않을 만큼 여유를 둔다.
    const s = { ...base, player: { ...base.player, cash: 60_000_000 } }
    const r = advanceTurn(s, ['hodl'])
    expect(r.player.tier).toBe(2)
    expect(r.cutscene).toBe('cutscene.promote.2')
  })

  it('T-B6: 티어 문턱 아래로 떨어지면 1턴 진행에 강등되고 강등 컷신이 뜬다', () => {
    const base = initGame(1)
    const s = { ...base, player: { ...base.player, tier: 2 as const, cash: 1_000_000 } }
    const r = advanceTurn(s, ['hodl'])
    expect(r.player.tier).toBe(0)
    expect(r.cutscene).toBe('cutscene.demote.0')
  })

  it('T-B7: 1턴 진행하면 라이벌 자산이 그 턴의 국면대로 움직인다', () => {
    const base = initGame(1)
    const regime = base.regimes[0]!
    const expected = Math.round(BALANCE.rival.start * Math.exp(BALANCE.regime[regime].drift * BALANCE.rival.driftMul))
    const r = advanceTurn(base, ['hodl'])
    expect(r.rivalAssets).toBe(expected)
    expect(r.rivalAssets).not.toBe(BALANCE.rival.start)  // 정지해 있지 않다
  })

  it('T-B8: 대출을 안고 1턴 진행하면 이자가 실제로 붙는다', () => {
    const base = initGame(1)
    const loan = 1_000_000
    const s = { ...base, player: { ...base.player, loan } }   // 담보 300만 ≥ 대출×1.3 이라 반대매매는 없다
    const r = advanceTurn(s, ['hodl'])
    expect(r.player.loan).toBe(loan + Math.round(loan * BALANCE.loan.rate))
  })

  it('T-B9: 담보가 모자라면 1턴 진행에 반대매매가 실행된다', () => {
    const base = initGame(1)
    const s = {
      ...base,
      player: { ...base.player, cash: 100_000, loan: 5_000_000 },  // 담보 10만 << 대출×1.3
    }
    const r = advanceTurn(s, ['hodl'])
    expect(r.flags['marginCalled']).toBe(true)
    expect(r.player.holdings).toEqual([])
  })
})

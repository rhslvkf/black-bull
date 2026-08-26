import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { HomeScreen } from './HomeScreen'
import { Hud } from '../components/Hud'
import { CharacterStage } from '../components/CharacterStage'
import { useGame } from '../store/store'
import { BALANCE, loadCards } from '@bb/core'
import { pinSlots } from '../testkit'
import { won, pct, yearWeek } from '../format'

// 회복 카드 목록을 하드코딩하면 카드 풀이 바뀔 때마다 손으로 맞춰야 한다(재발 이력 있음 —
// hodl이 회복 카드로 편입되면서 3개짜리 리터럴이 낡았다). loadCards()에서 유도해 이 파일의
// 세 테스트가 항상 실제 데이터를 따라가게 한다.
const RECOVERY_TESTIDS = loadCards().filter(c => c.isRecovery).map(c => `slot-card-${c.id}`)

// Task 6부터 카드 목록은 이번 턴 슬롯 4장(행동 3 + 회복 1)에서 나온다. 어떤 카드가
// 뽑히는지는 시드가 정하므로, 테스트가 클릭할 카드를 매 판 슬롯에 꽂아 둔다.
// (첫 칸을 overtime으로 두는 것은 아래 '흔들리지 않을 때 첫 카드' 테스트가 기댄다.)
beforeEach(() => {
  localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1)
  pinSlots(['overtime', 'analyze', 'news'])
})

describe('format', () => {
  it('won은 천단위 구분과 원을 붙인다', () => expect(won(84_320_000)).toBe('84,320,000원'))
  it('pct는 부호를 붙인다', () => { expect(pct(18.44)).toBe('+18.4%'); expect(pct(-3.2)).toBe('-3.2%') })
  it('yearWeek는 연차·주차로 바꾼다', () => {
    expect(yearWeek(1)).toBe('1년차 1주')
    expect(yearWeek(53)).toBe('2년차 1주')
    expect(yearWeek(156)).toBe('3년차 52주')
  })
})

// Task 12 — Hud는 게이지(+위험 배지)만 남기고 연차·주차/티어명/총자산/투자수익률
// 네 항목을 걷어냈다(중복이었다 — TopBar.test.tsx가 연차·주차·총자산을,
// CharacterStage.test.tsx가 티어명·투자수익률을 이미 고정한다). 이 테스트는 그
// 트리밍 뒤에도 게이지 자체는 남아 있는지만 본다.
describe('Hud', () => {
  it('게이지를 보여준다', () => {
    render(<Hud />)
    expect(screen.getByTestId('gauge-mental')).toBeDefined()
    expect(screen.getByTestId('gauge-condition')).toBeDefined()
  })
})

describe('HomeScreen', () => {
  it('이번 턴 슬롯 카드만 렌더된다 (행동 3 + 회복 1)', () => {
    // Ruling 12 — 예전에는 loadCards() 11장을 전부 그려서, 슬롯 밖 8장이 눌러도 아무
    // 일이 없는 죽은 버튼이었다(core가 NOT_IN_SLOTS로 거부하고 스토어가 삼킨다).
    render(<HomeScreen />)
    // Ruling 21(Task 12) 이후 카드 버튼 testid는 `slot-card-*`라 컨테이너(`card-list`)와
    // 더 이상 접두사가 겹치지 않는다. within은 이제 필수는 아니지만, "이 목록 안의
    // 카드만 센다"는 의도를 명시적으로 남기기 위해 그대로 둔다.
    const buttons = within(screen.getByTestId('card-list')).getAllByTestId(/^slot-card-/)
    expect(buttons).toHaveLength(BALANCE.slots.action + BALANCE.slots.recovery)
    expect(screen.queryByTestId('slot-card-forum')).toBeNull()   // 슬롯 밖 카드는 아예 없다
  })
  it('카드를 고르기 전에는 턴 넘기기가 비활성이다', () => {
    render(<HomeScreen />)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
  })
  it('카드를 고르면 활성화되고 턴이 넘어간다', () => {
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    const btn = screen.getByTestId('next-turn')
    expect(btn.hasAttribute('disabled')).toBe(false)
    fireEvent.click(btn)
    expect(useGame.getState().state!.turn).toBe(2)
  })
  it('흔들림 상태에서 이성 카드가 잠긴다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 10 } } })
    render(<HomeScreen />)
    expect(screen.getByTestId('slot-card-analyze').hasAttribute('disabled')).toBe(true)
  })
  it('회복 카드 유도 목록이 비어있지 않다 (loadCards() 기준 4개)', () => {
    // 아래 세 테스트가 RECOVERY_TESTIDS로 toContain/not.toContain을 검사하므로, 이 목록이
    // 비면 toContain은 항상 실패하고 not.toContain은 항상 통과해 전부 무의미해진다.
    expect(RECOVERY_TESTIDS.length).toBe(4)
  })
  it('흔들림에서도 회복 슬롯 카드는 열려 있고 최상단에 온다 (스펙 §3.3)', () => {
    // 화면에 뜨는 회복 카드는 이번 턴 회복 슬롯 한 장뿐이다 — 4종 전부를 찾던 예전
    // 단언은 슬롯 기반 렌더에서 성립하지 않는다. 그 한 장이 열려 있는지를 본다.
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 5 } } })
    render(<HomeScreen />)
    const recoveryId = `slot-card-${useGame.getState().state!.slots.recovery.cardId}`
    expect(RECOVERY_TESTIDS).toContain(recoveryId)
    expect(screen.getByTestId(recoveryId).hasAttribute('disabled')).toBe(false)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^slot-card-/)[0]!
    expect(first.getAttribute('data-testid')).toBe(recoveryId)
  })
  it('퇴사 상태면 카드 2장을 고를 수 있다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, employed: false } } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    fireEvent.click(screen.getByTestId('slot-card-news'))
    fireEvent.click(screen.getByTestId('next-turn'))
    expect(useGame.getState().state!.turn).toBe(2)
    expect(useGame.getState().state!.player.stats.info).toBeGreaterThan(0)
  })
  it('잠긴 카드를 클릭해도 선택 상태가 바뀌지 않고 턴 넘기기는 계속 비활성이다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 10 } } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('slot-card-analyze')) // 잠긴 카드
    // 부분 문자열 단언은 'unpicked' 같은 클래스도 통과시키므로 classList로 정확히 본다.
    // (이쪽은 disabled가 실제 방어선이 맞다 — CardGrid에서 disabled={!ok}를 지우면
    //  이 단언이 'card picked'로 실패한다. 보고서 §7 뮤테이션 2 참고.)
    expect(screen.getByTestId('slot-card-analyze').classList.contains('picked')).toBe(false)
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
  })
})

describe('CardGrid 정렬 — 흔들림 여부에 따라 실제로 순서가 달라지는가', () => {
  it('흔들리지 않을 때는 카드 원본 순서를 유지한다 (첫 카드는 회복 카드가 아니다)', () => {
    render(<HomeScreen />)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^slot-card-/)[0]!
    expect(first.getAttribute('data-testid')).toBe('slot-card-overtime')
  })
  it('멘탈 30(경계 바로 위, 비흔들림)에서는 회복 카드가 최상단이 아니다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 30 } } })
    render(<HomeScreen />)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^slot-card-/)[0]!
    expect(RECOVERY_TESTIDS).not.toContain(first.getAttribute('data-testid'))
  })
  it('멘탈 29(경계, 흔들림)에서는 회복 카드가 최상단으로 온다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 29 } } })
    render(<HomeScreen />)
    const first = within(screen.getByTestId('card-list')).getAllByTestId(/^slot-card-/)[0]!
    expect(RECOVERY_TESTIDS).toContain(first.getAttribute('data-testid'))
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
  // 최종 리뷰 C1: 경계의 기준선이 '시드머니'에서 '무매매 기준선'으로 바뀌었다.
  // 턴 1에는 아직 월급이 없으므로 기준선 = 시드머니 300만이다.
  it(`시장에 들어가 있고 투자 수익률이 +${BALANCE.mood.joyRoiPct}%(경계)면 joy 캐릭터를 그린다`, () => {
    const s = useGame.getState().state!
    const total = Math.round(BALANCE.seedMoney * (1 + BALANCE.mood.joyRoiPct / 100))
    const price = s.stocks[0]!.price
    const qty = Math.floor(1_000_000 / price)
    useGame.setState({ state: { ...s, player: {
      ...s.player, cash: total - qty * price,
      holdings: [{ stockId: s.stocks[0]!.id, qty, avgCost: price, heldTurns: 1 }],
    } } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).toContain(JOY_MARK)
  })
  it('주식을 한 주도 안 샀으면 현금이 늘어도 joy가 아니다 (야근 수입은 투자 수익이 아니다)', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: BALANCE.seedMoney * 3, holdings: [] } } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).not.toContain(JOY_MARK)
    expect(container.innerHTML).not.toContain(SHAKEN_MARK)
  })
  it('투자 수익률이 경계 바로 아래면 joy가 아니라 normal 캐릭터를 그린다', () => {
    const s = useGame.getState().state!
    const cash = Math.round(BALANCE.seedMoney * (1 + BALANCE.mood.joyRoiPct / 100)) - 1_000
    useGame.setState({ state: { ...s, player: { ...s.player, cash } } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).not.toContain(JOY_MARK)
    expect(container.innerHTML).not.toContain(SHAKEN_MARK)
  })
  it('월급만 3년 받고 매매를 안 한 판은 joy가 아니라 normal이다 (C1 회귀)', () => {
    // 옛 식(시드머니 대비 ROI ≥ 20%)에서는 이 상태가 +1,000%라 영구 joy였다.
    const s = useGame.getState().state!
    const netPayroll = BALANCE.employedNet * 39
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, cash: BALANCE.seedMoney + netPayroll, holdings: [] },
      trackers: { ...s.trackers, netPayroll },
    } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).not.toContain(JOY_MARK)
    expect(container.innerHTML).not.toContain(SHAKEN_MARK)
  })
  it('멘탈이 joyMental 아래면 수익률이 좋아도 joy가 아니다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, mental: BALANCE.mood.joyMental - 1, cash: BALANCE.seedMoney * 3 },
    } })
    const { container } = render(<HomeScreen />)
    expect(container.innerHTML).not.toContain(JOY_MARK)
  })
})

describe('format 경계값', () => {
  it('pct(0)은 +부호를 붙인다', () => expect(pct(0)).toBe('+0.0%'))
  it('won(0)은 0원이다', () => expect(won(0)).toBe('0원'))
  it('yearWeek(52)는 1년차 마지막 주다', () => expect(yearWeek(52)).toBe('1년차 52주'))
})

describe('Hud 흔들림 시각 신호 (Major #1)', () => {
  it('멘탈 29(흔들림 경계)에서 hud-shaken 클래스·경고 배지·게이지 위험색이 뜬다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 29 } } })
    const { container } = render(<Hud />)
    expect(container.querySelector('.hud')!.className).toMatch(/hud-shaken/)
    expect(screen.getByText('멘탈이 흔들리고 있다')).toBeDefined()
    expect(container.querySelector('.gauge-critical')).not.toBeNull()
  })
  it('멘탈 30(경계 바로 위)에서는 흔들림 표시가 전혀 없다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, mental: 30 } } })
    const { container } = render(<Hud />)
    expect(container.querySelector('.hud')!.className).not.toMatch(/hud-shaken/)
    expect(screen.queryByText('멘탈이 흔들리고 있다')).toBeNull()
    expect(container.querySelector('.gauge-critical')).toBeNull()
  })
})

describe('선택지 대기 시 턴 넘기기 차단 (Major #2)', () => {
  it('pendingChoices가 있으면 카드를 골라도 턴 넘기기가 비활성이고 안내 문구가 뜬다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: 'dummy' }] } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('먼저 마주한 상황부터 정리해야 한다.')).toBeDefined()
  })
  it('pendingChoices가 없으면 안내 문구가 뜨지 않는다', () => {
    render(<HomeScreen />)
    expect(screen.queryByText('먼저 마주한 상황부터 정리해야 한다.')).toBeNull()
  })
  // 이름 정정(Task 24). 이전 이름은 "비활성이라 클릭 자체가 무시돼 턴이 안 넘어간다"였는데,
  // 그건 이 테스트가 검증하는 내용이 아니다. HomeScreen에서 `blocked`를 disabled 조건에서
  // 빼는 뮤테이션을 넣으면(버튼이 활성이 되어 클릭이 실제로 go()를 부름) 이 테스트는 그대로
  // 통과한다 — 턴을 막는 진짜 방어선은 버튼의 disabled가 아니라 코어 advanceTurn의
  // CHOICE_PENDING 가드(+ 스토어 guard가 GameError만 삼키는 것)이기 때문이다.
  // (뮤테이션 명령·출력은 보고서 §7 참고. 같은 뮤테이션을 위 두 테스트가 잡는다.)
  // 그래서 여기서는 '클릭이 무시된다'가 아니라 'UI를 우회해 next()를 직접 불러도 턴은
  // 안 넘어간다'를 못박는다.
  it('선택지가 남아 있으면 next()를 직접 불러도 턴이 넘어가지 않는다 (코어 CHOICE_PENDING 가드)', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, pendingChoices: [{ eventId: 'dummy' }] } })
    render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    fireEvent.click(screen.getByTestId('next-turn'))
    expect(useGame.getState().state!.turn).toBe(1)

    // 버튼을 완전히 우회한다. resolveChoice/advanceTurn은 GameError를 던지고 스토어가
    // 그것만 삼키므로, "던지지 않았다"가 아니라 "state가 안 바뀌었다"를 봐야 한다.
    useGame.getState().next(['hodl'])
    expect(useGame.getState().state!.turn).toBe(1)
    expect(useGame.getState().state!.pendingChoices).toHaveLength(1)
  })
  it('선택지를 비우면 같은 next() 호출이 실제로 턴을 넘긴다 (위 테스트가 공회전이 아님을 보증)', () => {
    render(<HomeScreen />)
    useGame.getState().next(['hodl'])
    expect(useGame.getState().state!.turn).toBe(2)
  })
})

// Task 12 — ROI 표시가 Hud(hud-roi)에서 CharacterStage(char-roi)로 옮겨갔다(중복 제거,
// Hud 트리밍 근거는 위 'Hud' describe 주석 참고). 계산 자체(investmentRoi)는 그대로이므로
// 같은 경계값 검증을 char-roi에 대해 다시 못박는다 — CharacterStage.test.tsx의
// '수익률 배지 색(MU9)' 스위트는 일반적인 up/down/neutral만 보므로, 여기 있던 ±0.01%
// 정밀 경계값 검증까지 흡수하지는 않는다(그 스위트를 대체하지 않고 보완한다).
describe('수익률 0%는 중립 (Ruling 58, Minor #1)', () => {
  it('roi가 정확히 0일 때 char-roi는 up도 down도 아닌 neutral이다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: 3_000_000 } } }) // (3M-3M)/3M = 0
    render(<CharacterStage />)
    expect(screen.getByTestId('char-roi').className).toContain('neutral')
  })
  it('roi가 +0.01%(경계 바로 위)면 up이다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: 3_000_300 } } }) // +0.01%
    render(<CharacterStage />)
    expect(screen.getByTestId('char-roi').className).toContain('up')
  })
  it('roi가 -0.01%(경계 바로 아래)면 down이다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: 2_999_700 } } }) // -0.01%
    render(<CharacterStage />)
    expect(screen.getByTestId('char-roi').className).toContain('down')
  })
})

// 최종 리뷰 C1 — 수익률의 기준선이 무매매 기준선인지, 화면 문자열로 고정한다.
// (Task 12: 이 계산을 보여주는 화면이 Hud에서 CharacterStage로 옮겨갔다. "기준선을
// 화면에 밝히는" 별도 텍스트(구 hud-baseline)는 새 레이아웃(스펙 §3.1 다이어그램에
// 없다)에서 표시할 자리가 없어 함께 걷어냈다 — 대신 이 계산이 실제로 옳은 퍼센트를
// 내는지(핵심 회귀: 옛 식이면 +1049.2%가 찍혔다)는 아래에서 계속 고정한다.)
describe('수익률 기준선 (최종 리뷰 C1)', () => {
  it('월급만 3년 받은 무매매 판의 수익률은 세 자릿수가 아니다', () => {
    const s = useGame.getState().state!
    const netPayroll = BALANCE.employedNet * 39
    useGame.setState({ state: {
      ...s,
      player: { ...s.player, cash: BALANCE.seedMoney + netPayroll, holdings: [] },
      trackers: { ...s.trackers, netPayroll },
    } })
    render(<CharacterStage />)
    // 옛 식이라면 여기가 '+1049.2%'였다.
    expect(screen.getByTestId('char-roi').textContent).toContain('+0.0%')
    expect(screen.getByTestId('char-roi').className).toContain('neutral')
  })
})

// 최종 리뷰 M4 — 강제 스킵·번아웃이 화면에 남는다.
describe('강제 스킵·번아웃 표시 (최종 리뷰 M4)', () => {
  it('야근으로 스킵된 다음 화면에 그 사실이 남는다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, lastTurnSkip: 'exhausted' } })
    render(<HomeScreen />)
    expect(screen.getByTestId('turn-skipped').textContent).toContain('야근')
  })
  it('번아웃으로 스킵된 다음 화면에는 번아웃이라고 쓴다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, lastTurnSkip: 'burnout' } })
    render(<HomeScreen />)
    expect(screen.getByTestId('turn-skipped').textContent).toContain('번아웃')
  })
  it('스킵이 없던 턴에는 아무 문구도 뜨지 않는다', () => {
    render(<HomeScreen />)
    expect(screen.queryByTestId('turn-skipped')).toBeNull()
  })
  it('번아웃 중에는 카드가 실행되지 않는다고 미리 알린다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, burnoutTurns: 2 } } })
    render(<HomeScreen />)
    expect(screen.getByTestId('burnout-ahead').textContent).toContain('2주')
  })
  it('컨디션이 강제 스킵 구간이면 HUD가 경고하고 게이지가 위험색이 된다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, condition: BALANCE.condition.forcedSkipBelow - 1 } } })
    render(<Hud />)
    expect(screen.getByTestId('hud-tired-badge').textContent).toContain('야근')
    expect(screen.getByTestId('gauge-condition').className).toContain('gauge-critical')
  })
  it('컨디션이 경계 위면 경고가 없다', () => {
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, condition: BALANCE.condition.forcedSkipBelow } } })
    render(<Hud />)
    expect(screen.queryByTestId('hud-tired-badge')).toBeNull()
    expect(screen.getByTestId('gauge-condition').className).not.toContain('gauge-critical')
  })
  it('실제로 스킵된 턴을 넘기면 카드 효과가 사라지고 화면에 이유가 뜬다', () => {
    // 번아웃 상태에서 기업분석(analysis +0.5)을 고르고 턴을 넘긴다.
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, burnoutTurns: 2 } } })
    const { rerender } = render(<HomeScreen />)
    fireEvent.click(screen.getByTestId('slot-card-analyze'))
    fireEvent.click(screen.getByTestId('next-turn'))
    const after = useGame.getState().state!
    expect(after.player.stats.analysis).toBe(0)     // 효과는 실제로 증발한다
    expect(after.lastTurnSkip).toBe('burnout')      // 그러나 흔적이 남는다
    rerender(<HomeScreen />)
    expect(screen.getByTestId('turn-skipped')).toBeDefined()
  })
})

// 최종 리뷰 Minor 12 — 잠긴 카드에 자물쇠 아이콘만 붙어 이유를 알 수 없었다.
describe('잠긴 카드는 이유를 말한다 (최종 리뷰 Minor 12)', () => {
  it('티어 부족은 티어 때문이라고 쓴다', () => {
    pinSlots(['report', 'study', 'analyze'])
    render(<HomeScreen />)   // 새 판 = 티어 0, `리포트 정독`은 티어 2 필요
    expect(screen.getByTestId('slot-card-report').hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('card-lock-report').textContent).toContain('티어')
  })
  it('돈 부족과 흔들림은 서로 다른 문구다', () => {
    pinSlots(['report', 'study', 'analyze'])
    const s = useGame.getState().state!
    useGame.setState({ state: { ...s, player: { ...s.player, cash: 0, mental: BALANCE.mental.shakenMax } } })
    render(<HomeScreen />)
    const money = screen.getByTestId('card-lock-study').textContent!
    const shaken = screen.getByTestId('card-lock-analyze').textContent!
    expect(money).toContain('돈')
    expect(shaken).toContain('흔들')
    expect(money).not.toBe(shaken)
  })
  it('열려 있는 카드에는 이유가 붙지 않는다', () => {
    render(<HomeScreen />)
    expect(screen.queryByTestId('card-lock-hodl')).toBeNull()
  })
})

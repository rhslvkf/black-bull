import { describe, it, expect, beforeEach } from 'vitest'
import { useGame, SAVE_KEY } from './store/store'
import {
  loadEvents, loadCards, cardLockReason, actionPoints, cardApCost, gradeOfSlot,
  BALANCE, ENDING_IDS, type GameState,
} from '@bb/core'
import { nextTurnWith } from './testkit'

const events = loadEvents()
const CARDS = loadCards()

/**
 * 이번 턴 슬롯에서 **화면이 실제로 누를 수 있게 그리는** 카드만 남긴다.
 * CardGrid가 타일을 비활성화하는 조건과 같은 식이다(`cardLockReason` + 행동력).
 * 행동력 초과는 여기서 거르지 않는다 — 그건 스토어의 `togglePick`이 판단하고,
 * 이 테스트는 그 게이팅 자체를 지나가야 한다.
 */
function pickableSlots(s: GameState) {
  return [...s.slots.action, s.slots.recovery].flatMap(slot => {
    const def = CARDS.find(c => c.id === slot.cardId)
    return def && cardLockReason(s, def) === null ? [{ def, slot }] : []
  })
}

/** 156턴을 도는 동안 이 테스트가 실제로 무엇을 지나갔는지. */
interface PlayLog {
  state: GameState
  /** 행동 카드(회복 아님)를 한 장이라도 낸 턴 수. */
  actionCardTurns: number
  /** 실제로 소비한 리롤 횟수 — `rerollsLeft`가 줄어드는 것을 매번 확인한 값이다. */
  rerollsUsed: number
  /** 행동 슬롯이 매 턴 BALANCE.slots.action칸으로 뽑힌 턴 수. */
  slotDrawTurns: number
}

/**
 * **UI 스토어만으로** 156턴을 완주한다 — 행동력·슬롯·리롤이 들어간 새 루프다.
 *
 * `cards: false`면 카드를 한 장도 내지 않고 턴만 넘긴다. 이건 비교군이다(MU3):
 * 아래 '카드를 쓴 판과 안 쓴 판은 다른 판이다' 테스트가 두 판의 결과를 맞대,
 * 이 루프가 슬롯에서 카드를 고르는 경로를 잃어버리면(= 빈 배열을 넘기게 되면)
 * 두 판이 같아지면서 red가 된다. Task 11 리뷰가 지적한 함정 — "헬퍼가 슬롯을 비워
 * 통합 테스트가 슬롯을 한 번도 안 보고 완주한다" — 을 다시 파지 않기 위한 장치다.
 */
function playToEnd(seed: number, opts: { cards: boolean } = { cards: true }): PlayLog {
  useGame.getState().newGame(seed)
  const log: PlayLog = { state: useGame.getState().state!, actionCardTurns: 0, rerollsUsed: 0, slotDrawTurns: 0 }

  for (let i = 0; i < BALANCE.totalTurns + 5; i++) {
    if (useGame.getState().state!.status === 'ended') break

    // 1. 선택지부터 해결한다 — 남아 있으면 core가 CHOICE_PENDING으로 턴을 거부한다.
    while (useGame.getState().state!.pendingChoices.length > 0) {
      const c = useGame.getState().state!.pendingChoices[0]!
      const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
      if (n === 0) break
      useGame.getState().choose(c.eventId, 0)
    }

    const before = useGame.getState().state!
    const at = `seed ${seed} turn ${before.turn}`
    // 2. 매 턴 새 슬롯이 실제로 뽑혔는지 본다.
    expect(before.slots.action, at).toHaveLength(BALANCE.slots.action)
    if (before.slots.action.length === BALANCE.slots.action) log.slotDrawTurns++

    if (opts.cards) {
      // 3. 5턴마다 리롤을 실제로 써 본다 — 행동 슬롯이 다시 굴려지고 횟수가 준다.
      if (before.turn % 5 === 0 && before.rerollsLeft > 0) {
        const left = before.rerollsLeft
        useGame.getState().doReroll()
        expect(useGame.getState().state!.rerollsLeft, `${at} 리롤 후`).toBe(left - 1)
        log.rerollsUsed++
      }

      // 4. 슬롯에서 고른다. 비싼 카드부터 눌러 예산을 채우고, 회복 카드는 마지막에
      //    누른다(행동력 0이라 언제 눌러도 들어간다) — 화면에서 사람이 하는 순서다.
      //    고르는 통로는 스토어의 togglePick이다: 행동력 예산 게이팅을 실제로 지난다.
      const s = useGame.getState().state!
      const candidates = pickableSlots(s)
        .map(x => ({ ...x, ap: cardApCost(x.def.id, gradeOfSlot(s, x.def.id)) }))
        .sort((a, b) => (a.def.isRecovery ? 1 : 0) - (b.def.isRecovery ? 1 : 0) || b.ap - a.ap)
      for (const c of candidates) useGame.getState().togglePick(c.def.id)

      const picked = useGame.getState().picked
      // 회복 슬롯은 절대 잠기지 않고 행동력을 쓰지 않으므로 언제나 최소 한 장은 고를 수 있다.
      expect(picked.length, `${at} 고른 카드`).toBeGreaterThan(0)
      // 고른 카드가 예산을 넘지 않는다 — togglePick의 게이팅이 실제로 동작한다는 뜻이다.
      const spent = picked.reduce((sum, id) => sum + cardApCost(id, gradeOfSlot(s, id)), 0)
      expect(spent, `${at} 소모 행동력`).toBeLessThanOrEqual(actionPoints(s))
      if (picked.some(id => !CARDS.find(c => c.id === id)?.isRecovery)) log.actionCardTurns++

      useGame.getState().next(picked)
    } else {
      useGame.getState().next([])
    }

    // 5. 턴이 실제로 넘어갔는지 본다. 스토어의 guard는 GameError를 **삼키므로**,
    //    잘못된 카드를 넘기면 화면이 무반응인 채로 루프만 도는 일이 생길 수 있다.
    const after = useGame.getState().state!
    expect(after.status === 'ended' || after.turn === before.turn + 1, `${at} 턴이 넘어가지 않았다`).toBe(true)
  }
  log.state = useGame.getState().state!
  return log
}

/** GameState 전체를 한 문자열로 접는다(FNV-1a). 두 판이 바이트 단위로 같은지 비교하는 데 쓴다. */
function fingerprint(s: GameState): string {
  const json = JSON.stringify(s)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${h.toString(16)}:${json.length}`
}

const statSum = (s: GameState): number =>
  Object.values(s.player.stats).reduce((a, b) => a + b, 0)

beforeEach(() => { localStorage.clear(); useGame.getState().reset() })

describe('통합: 스토어로 완주 (행동력·슬롯·리롤)', () => {
  it('여러 시드에서 끝까지 가고 알려진 엔딩이 나온다', () => {
    for (const seed of [1, 2, 3, 7, 13]) {
      const log = playToEnd(seed)
      const s = log.state
      expect(s.status, `seed ${seed}`).toBe('ended')
      // endingId.length > 0만 보면 'unknown' 같은 값도 통과한다 — 실제 엔딩 id인지 본다.
      // 전역 제약대로 `as` 없이 쓴다 — 전개하면 string[]이 되어 그대로 비교된다.
      expect([...ENDING_IDS], `seed ${seed}`).toContain(s.ending!.endingId)
      // 도중에 멈춰서 끝난 게 아니라 마지막 턴까지 갔는지도 본다(MU1: 루프를 1턴으로
      // 줄이면 여기서 잡힌다 — status 단언을 지워도 아래 turn 단언이 남는다).
      expect(s.turn, `seed ${seed}`).toBe(BALANCE.totalTurns)
      // 매 턴 슬롯이 뽑혔다 — 156턴 전부.
      expect(log.slotDrawTurns, `seed ${seed} 슬롯 뽑힌 턴`).toBe(BALANCE.totalTurns)
      // 행동 카드를 실제로 낸 턴이 대부분이다(잠김·행동력 부족으로 회복만 낸 턴은 있다).
      expect(log.actionCardTurns, `seed ${seed} 행동 카드를 낸 턴`).toBeGreaterThan(BALANCE.totalTurns / 2)
      // 리롤도 실제로 썼다 — 5턴마다 시도하므로 30번 안팎이다.
      expect(log.rerollsUsed, `seed ${seed} 쓴 리롤`).toBeGreaterThan(10)
      // 카드가 **게임 상태에 남긴 흔적**도 본다. 위 actionCardTurns는 이 테스트가 스스로
      // 적은 장부라 next()에 빈 배열을 넘겨도 그대로 올라간다(MU3에서 실제로 그랬다) —
      // 스탯 합은 카드를 실제로 내지 않으면 이벤트 선택지가 주는 몇 점에 머문다.
      expect(statSum(s), `seed ${seed} 스탯 합`).toBeGreaterThan(20)
    }
  })

  it('카드를 쓴 판과 한 장도 안 쓴 판은 서로 다른 판이 된다 (슬롯 소비 경로가 살아 있다)', () => {
    // MU3 대비. 위 완주 루프가 슬롯에서 카드를 고르는 대신 빈 배열을 넘기게 되면
    // 두 판이 같아지고 이 테스트가 red가 된다 — "카드를 몇 장 골랐다"는 자기 장부가
    // 아니라, 카드가 **게임 상태에 남긴 흔적**으로 확인하는 방식이다.
    const withCards = playToEnd(41, { cards: true })
    const without = playToEnd(41, { cards: false })

    expect(fingerprint(withCards.state)).not.toBe(fingerprint(without.state))
    // 카드는 스탯의 거의 유일한 공급원이다(이벤트 선택지가 주는 몫은 소수점 몇 개뿐).
    expect(statSum(withCards.state)).toBeGreaterThan(statSum(without.state) + 10)
    // 카드를 안 낸 판은 그 자체로 성립해야 한다 — 완주는 카드 없이도 가능하다.
    expect(without.state.status).toBe('ended')
    expect(without.actionCardTurns).toBe(0)
  })

  it('같은 시드는 같은 156턴을 만든다 (결정론)', () => {
    // MU4 대비 — "두 판을 비교한다"가 아니라 **두 판을 실제로 돌렸다**를 센다.
    // 배열 길이만 보면 `const one = play(); const runs = [one, one]`처럼 한쪽만
    // 돌리는 뮤테이션이 길이 2를 유지한 채 통과한다(자기 자신과 비교하는 공허한
    // 단언). 호출 횟수를 세면 그 형태가 바로 잡힌다.
    let plays = 0
    const play = (seed: number) => { plays++; return fingerprint(playToEnd(seed).state) }

    const runs = [play(5), play(5)]
    expect(plays, '결정론 비교는 두 판을 실제로 돌려야 한다').toBe(2)
    expect(runs[1]).toBe(runs[0])
    // 지문이 상수가 아니라는 것도 함께 본다 — 시드가 다르면 결과도 달라야 한다.
    expect(play(6)).not.toBe(runs[0])
    expect(plays).toBe(3)
  })

  it('완주 후 도감과 세이브가 남는다', () => {
    const s = playToEnd(4).state
    expect(useGame.getState().codex.runs).toBe(1)
    expect(useGame.getState().codex.endings).toContain(s.ending!.endingId)
    expect(localStorage.getItem(SAVE_KEY)).not.toBeNull()
  })

  it('새로고침(reset)해도 진행이 복원된다', () => {
    useGame.getState().newGame(9)
    nextTurnWith()
    nextTurnWith()
    const turn = useGame.getState().state!.turn
    expect(turn).toBeGreaterThan(1)          // 애초에 진행이 안 됐으면 복원도 무의미하다
    useGame.setState({ state: null })
    useGame.getState().reset()
    expect(useGame.getState().state!.turn).toBe(turn)
  })

  it('완주 중 멘탈·컨디션이 범위를 벗어나지 않는다', () => {
    const s = playToEnd(21).state
    expect(s.player.mental).toBeGreaterThanOrEqual(0)
    expect(s.player.mental).toBeLessThanOrEqual(100)
    expect(s.player.condition).toBeGreaterThanOrEqual(0)
    expect(s.player.condition).toBeLessThanOrEqual(100)
  })

  it('매매를 섞어 완주해도 끝까지 가고 보유가 유지된다 (스토어의 거래 경로 포함)', () => {
    // 위 완주 테스트들은 카드와 턴만 지나므로 doBuy/doSell을 한 번도 밟지 않는다.
    const g = useGame.getState()
    g.newGame(11)
    nextTurnWith()
    g.doBuy('sjc', 20)
    expect(useGame.getState().state!.player.holdings).toHaveLength(1)
    for (let i = 0; i < BALANCE.totalTurns + 5; i++) {
      const s = useGame.getState().state!
      if (s.status === 'ended') break
      while (useGame.getState().state!.pendingChoices.length > 0) {
        const c = useGame.getState().state!.pendingChoices[0]!
        const n = events.find(e => e.id === c.eventId)?.choices?.length ?? 0
        if (n > 0) useGame.getState().choose(c.eventId, 0)
        else break
      }
      // 80턴차에 절반을 판다 — 매도 경로도 통합 수준에서 한 번은 지난다.
      const cur = useGame.getState().state!
      if (cur.turn === 80 && cur.player.holdings.length > 0) useGame.getState().doSell('sjc', 10)
      nextTurnWith()
    }
    const end = useGame.getState().state!
    expect(end.status).toBe('ended')
    expect(end.turn).toBe(BALANCE.totalTurns)
    expect(end.player.holdings.find(h => h.stockId === 'sjc')!.qty).toBe(10)
  })

  it('여러 판을 이어서 돌리면 도감 회차가 누적된다', () => {
    playToEnd(31)
    playToEnd(32)
    expect(useGame.getState().codex.runs).toBe(2)
  })
})

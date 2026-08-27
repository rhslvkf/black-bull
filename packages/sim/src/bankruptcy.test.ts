import { describe, it, expect, vi, beforeEach } from 'vitest'
import { initGame, judgeEnding, totalAssets, type GameState } from '@bb/core'
import { isBankrupt } from './bankruptcy'
import { playOne } from './runner'

/**
 * **자기충족 수정의 지킴이** (리뷰 Major 2).
 *
 * 이 브랜치는 sim의 `bankrupt`를 `ending === 'legend'`에서 `totalAssets(s) <= 0`으로
 * 바꿨다. 그래야 "`legend` 판수와 파산 판수가 일치한다"는 게이트가 두 경로의 교차검증이
 * 된다. 그런데 그 한 줄을 옛 정의로 되돌려도 **sim 42건이 전부 green**이었다 — 완주한
 * 판에서는 두 정의가 절대 어긋나지 않기 때문이다(`advanceTurn`이 `judgeEnding(s,
 * totalAssets(s) <= 0)`을 부르고 `pickEnding`이 그 인자로 `legend`를 준다).
 *
 * 그래서 여기서는 **결과**가 아니라 **경로**를 잡는다:
 * ① 측정 함수 자체가 엔딩 이름을 보지 않는다(반대로 붙여 확인),
 * ② `playOne`이 그 함수를 실제로 통과해서 `bankrupt`를 만든다(바꿔치기해 확인).
 * 둘 중 하나만으로는 되돌림이 지나간다 — ①만 있으면 `playOne`이 그 함수를 안 써도
 * green이고, ②만 있으면 함수 속이 엔딩 이름을 읽어도 green이다.
 */
vi.mock('./bankruptcy', () => ({ isBankrupt: vi.fn() }))
const measure = vi.mocked(isBankrupt)

/** 바꿔치기되지 않은 **진짜** 구현. 위 `vi.mock`은 파일 전체에 걸리므로 이렇게 꺼낸다. */
const real = (await vi.importActual<typeof import('./bankruptcy')>('./bankruptcy')).isBankrupt

describe('isBankrupt — 파산은 엔딩 이름이 아니라 자산 상태다', () => {
  const base = initGame(1)
  const withMoney = (cash: number, loan: number): GameState =>
    ({ ...base, player: { ...base.player, cash, loan, holdings: [] } })

  const broke = withMoney(0, 5_000_000)        // 총자산 −5,000,000
  const rich = withMoney(5_000_000, 0)         // 총자산 +5,000,000

  it('전제 확인: 두 계좌의 총자산이 실제로 부호가 다르다', () => {
    expect(totalAssets(broke)).toBeLessThan(0)
    expect(totalAssets(rich)).toBeGreaterThan(0)
  })

  it('전제 확인: core는 이 두 계좌에 각각 legend / 비-legend 엔딩을 준다', () => {
    expect(judgeEnding(broke, true).endingId).toBe('legend')
    expect(judgeEnding(rich, false).endingId).not.toBe('legend')
  })

  it('엔딩 이름을 반대로 붙여도 자산 상태를 따른다', () => {
    // 이름과 상태를 일부러 어긋나게 붙인다. 측정이 `state.ending`을 읽으면 두 단언이
    // 정확히 뒤집힌다 — 실제 판에서는 이 어긋남이 생기지 않으므로, 그 되돌림을
    // 잡을 수 있는 자리는 이렇게 손으로 만든 상태뿐이다.
    expect(real({ ...broke, ending: judgeEnding(rich, false) })).toBe(true)
    expect(real({ ...rich, ending: judgeEnding(broke, true) })).toBe(false)
  })

  it('빚이 없으면 파산이 아니다 — 총자산이 0 미만으로 못 내려간다', () => {
    // 대조군 일곱 전략의 파산율 0이 '성질'이 아니라 '정의'인 이유(README 게이트표).
    expect(real(withMoney(0, 0))).toBe(true)      // 정확히 0은 파산 쪽이다(경계)
    expect(real(withMoney(1, 0))).toBe(false)
  })
})

describe('playOne의 bankrupt가 그 측정을 통과해서 나온다', () => {
  beforeEach(() => { measure.mockReset() })

  it('측정이 true라고 하면 파산이 아닌 판도 bankrupt다', () => {
    measure.mockReturnValue(true)
    const r = playOne(1, 'cash')
    expect(r.ending, '전제: 실제로는 파산이 아닌 판이어야 한다').not.toBe('legend')
    expect(r.bankrupt, 'bankrupt가 엔딩 이름에서 유도되고 있다').toBe(true)
    expect(measure).toHaveBeenCalled()
  })

  it('측정이 false라고 하면 legend로 끝난 판도 bankrupt가 아니다', () => {
    measure.mockReturnValue(false)
    const r = playOne(7, 'leverage')
    expect(r.ending, '전제: 이 시드는 실제로 파산으로 끝나는 판이다').toBe('legend')
    expect(r.bankrupt, 'bankrupt가 엔딩 이름에서 유도되고 있다').toBe(false)
  })
})

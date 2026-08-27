import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import App from './App'
import { renderWithState, renderDetail, setState } from './testUtils'
import { matchMediaMock } from './design/testUtils'

/**
 * Task 22 — §6(애니메이션) 검증. 브리프(task-22-brief.md)가 준 4개 테스트를 그대로
 * 옮기되, 컨트롤러 판정 두 가지를 반영한다:
 *
 * - Ruling 18: `@testing-library/jest-dom`을 추가하지 않는다 — `toHaveClass`/
 *   `toHaveAttribute`를 `classList.contains`/`getAttribute` 순수 DOM 비교로 옮긴다.
 *   검사 내용은 그대로다.
 * - Ruling 2: `renderDetail({ blocked: true })`의 `blocked`는 실제 상태 필드가 아니다.
 *   전역 제약이 정의하는 손절 봉인 조건(흔들림 = 멘탈 ≤ 29, 손실 20% 이상)을
 *   `override.player.mental` + `holdings`/`price`로 직접 구성한다.
 *
 * "흔들림 진입 시 화면 가장자리가 맥동한다" 테스트는 `app-root`(App.tsx의 최상위
 * `<main>`)를 봐야 하므로, 브리프 원문과 달리 렌더 대상을 `<HomeScreen/>`(기본값)이
 * 아니라 `<App/>`으로 명시한다 — `app-root`는 App 자신이 그리는 요소이지 HomeScreen이
 * 그리는 요소가 아니다.
 */
describe('애니메이션 (Task 22 브리프)', () => {
  it('자산 숫자가 롤업된다', () => {
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_000_000 } })
    expect(Number(screen.getByTestId('topbar-assets').getAttribute('data-value'))).toBeLessThan(2_000_000)
  })

  it('reduced-motion이면 즉시 반영된다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_000_000 } })
    expect(Number(screen.getByTestId('topbar-assets').getAttribute('data-value'))).toBe(2_000_000)
  })

  // 전역 제약이 정의하는 손절 봉인: 흔들림(멘탈 ≤ 29) + 20% 이상 손실 포지션.
  // core trade.test.ts의 실측값(avgCost 10000·price 8000 → 손실 20%, mental 10)을
  // 그대로 재사용해 core가 실제로 SELL_BLOCKED로 판정하는 조합임을 보장한다.
  it('막힌 동작(손절 봉인)은 흔들림 클래스를 받는다', () => {
    renderDetail({
      stockId: 'sjc',
      price: 8000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }],
      override: { player: { mental: 10 } },
    })
    fireEvent.click(screen.getByTestId('sell'))
    expect(screen.getByTestId('sell').classList.contains('shake')).toBe(true)
  })

  it('흔들림 진입 시 화면 가장자리가 맥동한다', () => {
    const { unmount } = renderWithState({ player: { mental: 40 } }, <App />)
    fireEvent.click(screen.getByTestId('prologue-skip')) // 첫 판은 프롤로그가 먼저 뜬다
    setState({ player: { mental: 12 } })
    expect(screen.getByTestId('app-root').getAttribute('data-pulse')).toBe('shaken')
    unmount()
  })
})

// MU4 — 반대 방향. 막히지 않은(정상) 매도 클릭에는 흔들림 클래스가 붙으면 안 된다.
// "막힌 동작에 클래스를 안 붙인다"만 보면, "항상 클래스를 붙인다"는 정반대 뮤테이션도
// 위 브리프 테스트 하나만으로는 못 잡는다(둘 다 그 테스트를 통과시킨다).
describe('막히지 않은 동작에는 흔들림 클래스가 붙지 않는다 (MU4 — 반대 방향)', () => {
  it('정상적으로 팔 수 있는 상태에서 매도를 눌러도 shake 클래스가 없다', () => {
    renderDetail({
      stockId: 'sjc',
      price: 12000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }],
      override: { player: { mental: 80 } }, // 흔들림이 아니다 — 손실도 없다(오히려 이익)
    })
    fireEvent.click(screen.getByTestId('sell'))
    expect(screen.getByTestId('sell').classList.contains('shake')).toBe(false)
  })

  it('클릭 전에는 애초에 shake 클래스가 없다(손절 봉인 상태라도)', () => {
    renderDetail({
      stockId: 'sjc',
      price: 8000,
      holdings: [{ stockId: 'sjc', qty: 10, avgCost: 10000, heldTurns: 3 }],
      override: { player: { mental: 10 } },
    })
    expect(screen.getByTestId('sell').classList.contains('shake')).toBe(false)
  })
})

// MU6 — 흔들림에서 벗어나면 맥동이 즉시 사라져야 한다(§6 "한 번" 맥동 — 영원히 돌면 안
// 된다). 브리프 테스트(진입 시 켜진다)만으로는 "한 번 켜지면 계속 켜져 있다" 뮤테이션을
// 못 잡는다.
describe('흔들림에서 벗어나면 맥동이 사라진다 (MU6)', () => {
  it('멘탈이 흔들림 문턱 위로 회복되면 data-pulse가 즉시 없어진다', () => {
    const { unmount } = renderWithState({ player: { mental: 40 } }, <App />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    setState({ player: { mental: 12 } }) // 진입 — 펄스 on
    expect(screen.getByTestId('app-root').getAttribute('data-pulse')).toBe('shaken')

    setState({ player: { mental: 60 } }) // 회복 — 흔들림에서 벗어남
    expect(screen.getByTestId('app-root').getAttribute('data-pulse')).toBeNull()
    unmount()
  })

  it('애초에 흔들리지 않는 판에서는 data-pulse 자체가 없다', () => {
    const { unmount } = renderWithState({ player: { mental: 80 } }, <App />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    expect(screen.getByTestId('app-root').getAttribute('data-pulse')).toBeNull()
    unmount()
  })
})

// Fix Round 1 Minor 3(리뷰) — 이전엔 어떤 테스트도 edge-pulse가 `infinite`가 되는
// 뮤테이션을 잡지 못했다. "960ms 1회성"이라고 보고했지만 실제로 고정돼 있지 않았다.
// 정확 일치(리터럴 960 — motion.ts의 계산식을 다시 베끼지 않는다)로 애니메이션
// shorthand 문자열 전체를 본다 — `infinite`가 뒤에 붙으면 이 비교가 반드시 깨진다.
describe('가장자리 맥동은 정확히 한 번만 재생된다 (Fix Round 1 Minor 3)', () => {
  it('애니메이션 문자열에 iteration count(예: infinite)가 붙지 않는다', () => {
    const { unmount } = renderWithState({ player: { mental: 40 } }, <App />)
    fireEvent.click(screen.getByTestId('prologue-skip'))
    setState({ player: { mental: 12 } })
    const anim = screen.getByTestId('app-root').style.animation
    // 리터럴 960ms — App.tsx의 PULSE_DURATION_MS(DUR_SLOW*2)와 값은 같지만, 여기서
    // 그 계산식을 다시 쓰지 않는다(자기충족 기대값 금지, 이 저장소의 반복 결함).
    expect(anim).toBe('edge-pulse 960ms var(--ease-standard)')
    expect(anim).not.toContain('infinite')
    unmount()
  })
})

// Fix Round 2(리뷰) — ChoiceSheet.test.tsx에서 실측된 함정과 같은 클래스다: 위
// 런타임 테스트는 최종 문자열이 '960ms'인지만 보므로, App.tsx가 그 숫자를
// `DUR_SLOW * 2`로 계산하는 대신 리터럴 `960`을 직접 써도(하드코딩) 똑같이
// 통과한다. 소스가 실제로 `DUR_SLOW` 식별자를 참조하는지 직접 본다.
describe('가장자리 맥동 duration이 소스에서 실제로 DUR_SLOW를 참조한다 (Fix Round 2)', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'App.tsx'), 'utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  it('PULSE_DURATION_MS 선언 줄이 DUR_SLOW를 참조한다(하드코딩 회귀 방지)', () => {
    const line = src.split('\n').find(l => l.includes('PULSE_DURATION_MS') && l.includes('=')) ?? ''
    expect(line, 'PULSE_DURATION_MS 선언 줄을 못 찾았다').not.toBe('')
    expect(line).toMatch(/DUR_SLOW/)
    expect(line).not.toMatch(/\b\d{2,}\b/) // 960 같은 두 자리 이상 리터럴이 섞이면 안 된다(곱셈 계수 '2'는 허용)
  })

  it('edge-pulse 애니메이션 문자열 자체에는 숫자 리터럴이 하드코딩돼 있지 않다', () => {
    const line = src.split('\n').find(l => l.includes('edge-pulse')) ?? ''
    expect(line, 'edge-pulse를 포함하는 줄을 못 찾았다').not.toBe('')
    expect(line).not.toMatch(/\d+ms/)
  })
})

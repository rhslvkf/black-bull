import { describe, it, expect } from 'vitest'
import { act, screen } from '@testing-library/react'
import { BALANCE } from '@bb/core'
import { renderWithState, setState } from '../testUtils'
import { won } from '../format'
import { matchMediaMock } from '../design/testUtils'

// Ruling 18 — 브리프는 @testing-library/jest-dom의 toHaveTextContent/toHaveAttribute를
// 쓰지만 packages/app에는 그 의존성이 없다. 새 의존성을 추가하지 않고 순수 DOM으로
// 옮긴다: textContent 부분 문자열 포함, getAttribute 직접 비교로 검사 내용은 그대로 둔다.

describe('TopBar', () => {
  it('연차·주차와 남은 주를 보여준다', () => {
    renderWithState({ turn: 66 })
    const date = screen.getByTestId('topbar-date').textContent!
    expect(date).toContain('2년차 14주')
    expect(date).toContain('D-90') // 남은 주 = 156(totalTurns) - 66
  })

  // Task 22 — 총자산 표시가 이제 useCountUp으로 롤업된다(§6 "상태 전이"). 그 훅은
  // reduced-motion이 아니면 마운트 직후 0에서 시작해 rAF로 목표값까지 올라간다
  // (motion.test.ts '애니메이션 중에는 목표값보다 작다'가 그 설계를 고정한다) — 그래서
  // "즉시 최종 값이어야 한다"는 이 테스트의 관심사(포맷)와 무관한 타이밍 문제를
  // 피하려 reduced-motion으로 렌더한다(overlays.test.tsx가 EventModal 타이핑에 쓰는
  // 것과 같은 기법). 검증하는 값·문구는 바뀌지 않는다 — 약화가 아니라 관심사 분리다.
  it('총자산을 원 단위로 보여준다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ player: { cash: 35_450_000 } })
    expect(screen.getByTestId('topbar-assets').textContent).toContain('35,450,000원')
  })

  // MU1 대비 — yearWeek()로 변환하지 않고 턴 원시값을 그대로 찍으면 여기서 실패해야 한다.
  it('원시 턴 번호(66)를 그대로 노출하지 않는다', () => {
    renderWithState({ turn: 66 })
    expect(screen.getByTestId('topbar-date').textContent).not.toContain('66주')
  })

  // MU2 대비 — D-day가 (156 - turn)이 아니라 turn 자체라면 D-66이 찍혀야 하는데,
  // 위 테스트가 D-90을 요구하므로 그 자체로 잡히지만, 여기서 한 번 더 대비를 명시한다.
  it('D-day는 총 턴(156) 대비 남은 주다', () => {
    renderWithState({ turn: 1 })
    expect(screen.getByTestId('topbar-date').textContent).toContain(`D-${BALANCE.totalTurns - 1}`)
  })

  // MU3 대비 — won()을 거치지 않고 숫자만 찍거나 '원'을 떼면 실패해야 한다.
  // reduced-motion으로 렌더하는 이유는 위 '원 단위로 보여준다' 테스트와 같다.
  it('총자산 표기에 천 단위 구분자와 "원"이 붙는다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ player: { cash: 12_345_678 } })
    expect(screen.getByTestId('topbar-assets').textContent).toBe(won(12_345_678))
  })

  // 리뷰 Fix Round 1 (Major) — 이전 버전은 TopBar.tsx가 export하는 TOUCH_TARGET_PX를
  // 그대로 import해 "그 상수가 그 상수와 같다"를 확인하는 자기참조 테스트였다. 구현이
  // 32px를 export하든 48px를 export하든 항상 통과해 아무것도 잠그지 못했다(1차 개발의
  // "패딩 포함 ≥40px인데 실측 33px"과 같은 종류의 사고).
  //
  // 44는 계획서 Global Constraints("터치 타깃 44px 이상")의 요구값이지 이 구현의
  // 상수가 아니다 — 그래서 여기서는 TopBar.tsx의 어떤 export도 가져오지 않고 리터럴
  // 44를 직접 적는다. ">="로 비교하는 이유도 같다: 제약은 "44px 이상"이므로, 나중에
  // 48px로 더 넉넉하게 키우는 정당한 변경까지 이 테스트가 막아서는 안 된다.
  it('메뉴·정보 버튼의 터치 타깃이 44px 이상이다 (Global Constraints)', () => {
    const MIN_TOUCH_TARGET_PX = 44 // 계획서 요구값. TopBar.tsx의 상수를 import하지 않는다.
    renderWithState({})
    for (const id of ['topbar-menu', 'topbar-info']) {
      const style = getComputedStyle(screen.getByTestId(id))
      expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
      expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    }
  })

  it('메뉴·정보 버튼은 스크린리더가 읽을 수 있는 이름을 가진다', () => {
    renderWithState({})
    expect(screen.getByTestId('topbar-menu').getAttribute('aria-label')).toBe('메뉴')
    expect(screen.getByTestId('topbar-info').getAttribute('aria-label')).toBe('정보')
  })

  // 리뷰 Fix Round 1 (Minor 1) — §3 레이아웃 예산: 상단바 56px. CharacterStage의
  // 260px와 같은 이유로 jsdom이 실측할 수 있게 인라인 스타일로 내린다. 값은
  // TopBar.tsx의 TOPBAR_HEIGHT_PX 상수 한 곳에서만 정의한다.
  it('상단바 높이가 56px로 고정된다 (§3 레이아웃 예산)', () => {
    renderWithState({})
    expect(getComputedStyle(screen.getByTestId('topbar')).height).toBe('56px')
  })
})

// Task 22 §6 "상태 전이 — 자산 숫자 롤업". Ruling 18(jest-dom 없음)에 맞춰 브리프의
// toBeLessThan을 그대로 순수 Number 비교로 옮긴다 — 검사 내용은 그대로다.
describe('총자산 롤업 (§6 상태 전이, Task 22 브리프)', () => {
  it('자산 숫자가 롤업된다 (MU1 — 롤업 없이 즉시 반영하면 이 테스트가 잡는다)', () => {
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_000_000 } })
    expect(Number(screen.getByTestId('topbar-assets').getAttribute('data-value'))).toBeLessThan(2_000_000)
  })

  it('reduced-motion이면 즉시 반영된다 (MU2 — §6의 제1 제약)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_000_000 } })
    expect(Number(screen.getByTestId('topbar-assets').getAttribute('data-value'))).toBe(2_000_000)
  })

  it('data-value와 화면에 보이는 원화 표기가 같은 숫자를 가리킨다', () => {
    // data-value가 화면과 동떨어진 "숨은" 값이 아니라 실제로 보이는 텍스트와 같은
    // 숫자여야 한다 — 그렇지 않으면 롤업이 화면에는 안 보이면서 테스트만 통과하는
    // "가짜 구현"이 가능해진다(보고서의 반복 결함 계열: 아무것도 고정 못 하는 테스트).
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    renderWithState({ player: { cash: 7_000_000 } })
    const el = screen.getByTestId('topbar-assets')
    expect(el.textContent).toBe(won(Number(el.getAttribute('data-value'))))
  })
})

// Fix Round 1 Major 2(리뷰) — 위 두 테스트는 "롤업 도중엔 목표보다 작다"만 본다.
// 목표값 자체가 틀리는 뮤테이션(최종적으로 실제 자산과 다른 수로 수렴)은 못 잡는다.
// 실제 모션 경로(reduced-motion 아님)로 rAF를 충분히 흘려보내(실시간 대기 —
// motion.test.ts의 '시간이 지나면 한 글자씩 늘어난다'와 같은 기법, 실제 브라우저와
// 같은 jsdom 내장 requestAnimationFrame을 그대로 쓴다) 애니메이션이 완료된 뒤
// **정확히** 목표값인지 정확 일치로 본다(부분 문자열이 아니다 — 이 저장소에서
// 부분 문자열이 오염된 값을 통과시킨 전례가 두 번 있다).
describe('롤업이 정확한 목표값에 수렴한다 (Fix Round 1 Major 2)', () => {
  it('애니메이션이 완료되면 정확히 실제 자산과 같은 값을 보여준다', async () => {
    renderWithState({ player: { cash: 1_000_000 } })
    setState({ player: { cash: 2_345_678 } })
    const el = screen.getByTestId('topbar-assets')
    // COUNT_UP_DURATION(motion.ts, --dur-slow=480ms)이 끝날 때까지 실시간으로 기다린다
    // (motion.test.ts의 '시간이 지나면 한 글자씩 늘어난다'와 같은 기법 — 실제 jsdom
    // 내장 requestAnimationFrame을 그대로 굴린다). 환경마다 프레임 타이밍이 들쭉날쭉할
    // 수 있어 한 번에 크게 기다리지 않고, 목표값에 도달할 때까지 짧게 반복 대기한다
    // (최대 3초 — 480ms의 6배 이상 여유).
    for (let i = 0; i < 60; i++) {
      if (el.getAttribute('data-value') === '2345678') break
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    }
    expect(el.getAttribute('data-value')).toBe('2345678') // 정확 일치
    expect(el.textContent).toBe(won(2_345_678))
  })
})

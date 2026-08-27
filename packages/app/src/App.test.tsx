import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import App from './App'
import { useGame } from './store/store'
import { loadEvents } from '@bb/core'
import { pinSlots } from './testkit'
import { DUR_BASE } from './design/motion'
import { matchMediaMock } from './design/testUtils'

// 카드 목록이 슬롯에서 나오므로(Task 6) 테스트가 클릭할 카드를 매 판 꽂아 둔다.
beforeEach(() => {
  localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1)
  pinSlots(['overtime', 'analyze', 'news'])
})

// 리뷰 M-3: advance.ts의 5단계(이벤트/pendingChoices)가 7단계(settleTier/cutscene)보다
// 먼저 실행되므로, 한 번의 advanceTurn 안에서 승급/강등과 이벤트가 동시에 뽑히면
// cutscene !== null && pendingChoices.length > 0가 실제로 동시에 성립할 수 있다(도달
// 가능한 상태). App.tsx는 <EventModal/><CutsceneView/><EndingView/> 순서로 DOM에 렌더해
// 같은 z-index(20)에서 나중에 그려지는 형제가 위에 뜨는 방식으로 "엔딩 > 컷신 > 이벤트"
// 우선순위를 만든다. 이 순서를 실제로 렌더해 고정한다 — 렌더 순서가 바뀌면(예: 실수로
// EventModal을 맨 뒤로 옮기면) 이 테스트가 잡아야 한다.
function goHome() {
  // 최초 플레이는 프롤로그가 뜨므로 건너뛰기로 통과한다.
  fireEvent.click(screen.getByTestId('prologue-skip'))
}

describe('오버레이 우선순위 (리뷰 M-3)', () => {
  it('컷신과 대기 선택지가 동시에 있으면 컷신이 위(마지막 .overlay)에 그려진다', () => {
    render(<App />)
    goHome()
    const ev = loadEvents().find(e => (e.choices?.length ?? 0) >= 2)!
    const s = useGame.getState().state!
    act(() => { useGame.setState({ state: {
      ...s, cutscene: 'cutscene.promote.1', pendingChoices: [{ eventId: ev.id }],
    } }) })

    // 이벤트 모달과 컷신 둘 다 DOM에 존재해야 한다(동시 성립 확인).
    expect(screen.getByTestId('event-modal')).toBeDefined()
    expect(screen.getByTestId('cutscene')).toBeDefined()

    // 마지막 .overlay가 위에 그려진다(같은 z-index에서 나중 형제가 위). App.tsx의 렌더
    // 순서(EventModal → CutsceneView → EndingView)가 지켜지는 한 컷신이 마지막이어야 한다.
    const overlays = document.querySelectorAll('.overlay')
    expect(overlays[overlays.length - 1]!.getAttribute('data-testid')).toBe('cutscene')
  })

  it('엔딩 상태에서 컷신이 남아 있어도 엔딩이 위(마지막 .overlay)에 그려진다', () => {
    render(<App />)
    goHome()
    const s = useGame.getState().state!
    // advance.ts 9단계는 pendingChoices만 강제로 비우고 cutscene은 그대로 둔다(Ruling 50) —
    // 그래서 status==='ended'와 cutscene!==null이 동시에 성립할 수 있다.
    act(() => { useGame.setState({ state: {
      ...s, status: 'ended', cutscene: 'cutscene.promote.1',
      ending: { endingId: 'super', endingName: '슈퍼개미', titles: [], finalAssets: 700_000_000 },
    } }) })

    expect(screen.getByTestId('cutscene')).toBeDefined()
    expect(screen.getByTestId('ending')).toBeDefined()

    const overlays = document.querySelectorAll('.overlay')
    expect(overlays[overlays.length - 1]!.getAttribute('data-testid')).toBe('ending')
  })
})

// 최종 리뷰 Minor 9 — prologueDone이 React state라 1턴에 새로고침하면 프롤로그가 다시 떴다.
describe('프롤로그는 새로고침해도 다시 뜨지 않는다 (최종 리뷰 Minor 9)', () => {
  it('건너뛴 뒤 새로고침(reset)해도 홈 화면으로 돌아온다', () => {
    const first = render(<App />)
    expect(screen.getByTestId('prologue-skip')).toBeDefined()
    fireEvent.click(screen.getByTestId('prologue-skip'))
    expect(screen.queryByTestId('prologue-skip')).toBeNull()

    first.unmount()
    act(() => { useGame.getState().reset() })   // 새로고침 = 스토어를 저장에서 다시 읽는다
    render(<App />)
    expect(screen.queryByTestId('prologue-skip')).toBeNull()
    expect(screen.getByTestId('next-turn')).toBeDefined()
  })
  it('저장을 지운 새 플레이어에게는 여전히 뜬다 (위 테스트가 공회전이 아님)', () => {
    localStorage.clear()
    act(() => { useGame.getState().reset(); useGame.getState().newGame(1) })
    render(<App />)
    expect(screen.getByTestId('prologue-skip')).toBeDefined()
  })
})

// 최종 리뷰 Minor 8 — 탭을 옮기면 HomeScreen이 언마운트되면서 고른 카드가 사라졌다.
describe('고른 카드는 탭을 옮겨도 남는다 (최종 리뷰 Minor 8)', () => {
  it('시세 탭에 다녀와도 선택이 유지된다', () => {
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    expect(screen.getByTestId('slot-card-hodl').className).toContain('picked')

    act(() => { useGame.getState().setTab('market') })
    expect(screen.queryByTestId('slot-card-hodl')).toBeNull()   // 정말로 언마운트됐다
    act(() => { useGame.getState().setTab('home') })

    expect(screen.getByTestId('slot-card-hodl').className).toContain('picked')
    expect(screen.getByTestId('next-turn').hasAttribute('disabled')).toBe(false)
  })
  it('턴을 넘기면 선택이 비워진다', () => {
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('slot-card-hodl'))
    fireEvent.click(screen.getByTestId('next-turn'))
    expect(useGame.getState().picked).toEqual([])
  })
})

// Task 22 §6 "화면 전환 — 탭 전환 슬라이드". jsdom은 외부 CSS를 안 읽으므로(Ruling 20)
// App.tsx가 인라인 style(animation)로 재생/생략을 결정한 값을 직접 본다.
describe('탭 전환 슬라이드 (§6 화면 전환, MU11)', () => {
  it('다른 탭으로 옮기면 본문 컨테이너에 슬라이드 애니메이션이 걸린다', () => {
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(screen.getByTestId('tab-body').style.animation).toContain('tab-slide')
  })

  it('reduced-motion이면 탭을 옮겨도 애니메이션이 없다', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(screen.getByTestId('tab-body').style.animation).toBe('')
  })

  // MU12 — duration이 motion.ts의 DUR_BASE(따라서 tokens.css --dur-base)에서
  // 유도되는지 직접 본다. 하드코딩된 리터럴로 바뀌어도(우연히 같은 숫자가 아닌 한) 잡는다.
  it('슬라이드 길이가 motion.ts의 DUR_BASE에서 유도된다', () => {
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(screen.getByTestId('tab-body').style.animation).toContain(`${DUR_BASE}ms`)
  })

  // Fix Round 2(리뷰) — ChoiceSheet.test.tsx에서 실측된 함정과 동일하다: DUR_BASE가
  // 마침 240이라 위 런타임 테스트는 '240ms' 하드코딩으로 되돌려도 통과한다. 소스가
  // 실제로 DUR_BASE 식별자를 참조하는지 직접 본다.
  it('슬라이드 duration이 소스에서 실제로 DUR_BASE를 참조한다(하드코딩 회귀 방지, Fix Round 2)', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'App.tsx'), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
    const line = src.split('\n').find(l => l.includes('tab-slide')) ?? ''
    expect(line, 'tab-slide를 포함하는 줄을 못 찾았다').not.toBe('')
    expect(line).toMatch(/\$\{DUR_BASE\}ms/)
    expect(line).not.toMatch(/\d+ms/)
  })

  it('탭 전환 슬라이드가 실제 탭 전환(다른 화면 렌더)과 함께 일어난다', () => {
    // "애니메이션은 걸리지만 실제로는 탭이 안 바뀐다" 종류의 죽은 연출을 막는다.
    render(<App />)
    goHome()
    expect(screen.queryByTestId('filter-all')).toBeNull()
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(screen.getByTestId('tab-body').style.animation).toContain('tab-slide')
    expect(screen.getByTestId('filter-all')).toBeDefined()
  })

  // Fix Round 1 Minor 2(리뷰) — 방향이 전혀 검증되지 않아 좌우를 뒤집어도 안 잡혔다.
  // TAB_ORDER(홈=0·시세=1·계좌=2·도감=3) 기준으로 오른쪽 탭(인덱스 증가)으로 가면
  // 오른쪽에서(+12px), 왼쪽 탭(인덱스 감소)으로 가면 왼쪽에서(-12px) 슬라이드가
  // 시작돼야 한다 — index.css의 `--tab-slide-x` 커스텀 프로퍼티로 실측한다.
  it('오른쪽 탭(시세, 인덱스 증가)으로 가면 오른쪽에서 슬라이드가 시작된다(+12px)', () => {
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(screen.getByTestId('tab-body').style.getPropertyValue('--tab-slide-x')).toBe('12px')
  })

  it('왼쪽 탭(홈, 인덱스 감소)으로 돌아가면 왼쪽에서 슬라이드가 시작된다(-12px)', () => {
    render(<App />)
    goHome()
    fireEvent.click(screen.getByTestId('tab-market')) // 0 → 1
    fireEvent.click(screen.getByTestId('tab-home'))   // 1 → 0 (역방향)
    expect(screen.getByTestId('tab-body').style.getPropertyValue('--tab-slide-x')).toBe('-12px')
  })
})

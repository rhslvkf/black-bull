import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { loadEvents, type EventChoice } from '@bb/core'
import { ChoiceSheet } from './ChoiceSheet'
import { renderEventWithChoices, currentState } from '../testUtils'
import { matchMediaMock } from '../design/testUtils'

// Ruling 18 — packages/app에는 @testing-library/jest-dom이 없다. 브리프의
// toBeInTheDocument는 getByTestId가 못 찾으면 이미 던지므로 그 사실 자체로 대체하고
// (queryByTestId(...).toBeNull()과 짝을 맞춘다), toHaveLength는 vitest 기본이라 그대로
// 쓴다 — 검사 내용은 브리프와 동일하다.
//
// Ruling 19 — renderEventWithChoices·currentState는 testUtils.tsx에 추가했다(브리프의
// text·pending·choiceCashDelta 옵션 지원, renderEvent/renderWithState 재사용).

describe('ChoiceSheet — 브리프 Step 1', () => {
  it('대사를 다 읽기 전에는 시트가 열리지 않는다', () => {
    renderEventWithChoices({ text: '긴 대사가 아직 타이핑 중이다' })
    expect(screen.queryByTestId('choice-sheet')).toBeNull()
  })

  it('대사가 끝나면 시트가 올라온다', () => {
    renderEventWithChoices({ text: '짧다' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(screen.getByTestId('choice-sheet')).toBeDefined()
  })

  it('선택하면 pendingChoices가 실제로 빈다', () => {
    renderEventWithChoices({ text: '짧다' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(currentState().pendingChoices).toHaveLength(0)
  })

  it('선택 효과가 실제로 적용된다', () => {
    renderEventWithChoices({ text: '짧다', choiceCashDelta: -500_000 })
    const before = currentState().player.cash
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(currentState().player.cash).toBe(before - 500_000)
  })

  it('같은 선택지를 두 번 눌러도 효과가 한 번만 적용된다', () => {
    renderEventWithChoices({ text: '짧다', choiceCashDelta: -500_000 })
    const before = currentState().player.cash
    fireEvent.click(screen.getByTestId('dialogue-box'))
    const btn = screen.getByTestId('choice-0')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(currentState().player.cash).toBe(before - 500_000)
  })

  it('여러 선택지가 대기 중이면 순서대로 해소된다', () => {
    renderEventWithChoices({ pending: 2, text: '짧다' })
    fireEvent.click(screen.getByTestId('dialogue-box'))
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(currentState().pendingChoices).toHaveLength(1)
  })
})

// Task 19 뮤테이션 대비 — 브리프 테스트만으로는 안 잡히는 함정들을 컴포넌트 단위로
// 직접 겨눈다. ChoiceSheet를 EventModal 없이 단독으로 렌더해 onChoose를 스파이로
// 받으므로, 스토어·core를 거치지 않고도 인덱스·라벨·중복클릭·터치타깃·모션을
// 각각 독립적으로 고정할 수 있다.
describe('ChoiceSheet — 컴포넌트 단위 방어 (Task 19 뮤테이션 대비)', () => {
  // 두 선택지의 효과를 서로 다르게 둔다 — MU7(인덱스 뒤집힘)을 라벨/인덱스만으로도
  // 잡을 수 있게 하기 위해서다.
  const choices: EventChoice[] = [
    { label: '커피 한 잔 산다', effects: [{ type: 'cash', delta: -4500 }] },
    { label: '안 산다', effects: [] },
  ]

  it('open=false면 아무 것도 그리지 않는다 (MU1·MU2 방어)', () => {
    const { container } = render(<ChoiceSheet eventId="e1" choices={choices} open={false} onChoose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('open=true면 선택지 개수만큼 버튼을 그린다', () => {
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={() => {}} />)
    expect(screen.getAllByTestId(/^choice-\d+$/)).toHaveLength(2)
  })

  // MU8 — 선택지 라벨이 인덱스와 어긋나게 렌더되는 버그(라벨은 그대로, 순서만 섞임).
  // choice-i의 표시 텍스트가 choices[i].label과 정확히 같은지를 각 인덱스마다 고정한다.
  it('choice-i 버튼의 라벨이 choices[i]의 라벨과 정확히 일치한다 (MU8)', () => {
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={() => {}} />)
    expect(screen.getByTestId('choice-0').textContent).toBe('커피 한 잔 산다')
    expect(screen.getByTestId('choice-1').textContent).toBe('안 산다')
  })

  // MU7 — 선택지 인덱스가 뒤집혀 넘어가는 버그(choice-0을 눌렀는데 1번 효과가 적용).
  // 두 인덱스를 각각 따로 눌러 onChoose가 정확히 그 인덱스로 불리는지 확인한다.
  it('choice-0을 누르면 onChoose(0), choice-1을 누르면 onChoose(1)이 정확히 불린다 (MU7)', () => {
    const onChoose0 = vi.fn()
    const { unmount } = render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={onChoose0} />)
    fireEvent.click(screen.getByTestId('choice-0'))
    expect(onChoose0).toHaveBeenCalledTimes(1)
    expect(onChoose0).toHaveBeenCalledWith(0)
    unmount()

    const onChoose1 = vi.fn()
    render(<ChoiceSheet eventId="e2" choices={choices} open onChoose={onChoose1} />)
    fireEvent.click(screen.getByTestId('choice-1'))
    expect(onChoose1).toHaveBeenCalledTimes(1)
    expect(onChoose1).toHaveBeenCalledWith(1)
  })

  // MU5(브리프) 방어 — 브리프의 통합 테스트는 첫 클릭 뒤 이벤트가 통째로 닫혀 버튼이
  // DOM에서 사라지므로(자연스러운 방어), 시트가 계속 마운트돼 있는 상황에서의 방어는
  // 여기서 컴포넌트 차원으로 직접 고정한다 — "어디서 막을지" 결정(ChoiceSheet.tsx
  // 최상단 주석)의 핵심 테스트다.
  it('같은 시트가 계속 열려 있어도(부모가 아직 닫지 않아도) 같은 버튼을 두 번 누르면 onChoose는 한 번만 불린다', () => {
    const onChoose = vi.fn()
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={onChoose} />)
    const btn = screen.getByTestId('choice-0')
    fireEvent.click(btn)
    fireEvent.click(btn)
    expect(onChoose).toHaveBeenCalledTimes(1)
  })

  it('고른 뒤에는 두 버튼 모두 잠긴다(disabled)', () => {
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={() => {}} />)
    fireEvent.click(screen.getByTestId('choice-0'))
    expect((screen.getByTestId('choice-0') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByTestId('choice-1') as HTMLButtonElement).disabled).toBe(true)
  })

  it('eventId가 바뀌면(다음 이벤트로 넘어가면) 잠금이 새로 풀린다', () => {
    const onChoose = vi.fn()
    const { rerender } = render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={onChoose} />)
    fireEvent.click(screen.getByTestId('choice-0'))
    expect((screen.getByTestId('choice-0') as HTMLButtonElement).disabled).toBe(true)

    rerender(<ChoiceSheet eventId="e2" choices={choices} open onChoose={onChoose} />)
    expect((screen.getByTestId('choice-0') as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(screen.getByTestId('choice-1'))
    expect(onChoose).toHaveBeenCalledTimes(2)
    expect(onChoose).toHaveBeenNthCalledWith(2, 1)
  })

  // MU10 — 전역 제약 "터치 타깃 44px 이상". 44는 계획서 요구값이지 구현 상수가 아니므로
  // (DialogueBox.test.tsx 로그 토글 검증과 같은 방식) 테스트 안에 리터럴로 못박는다.
  it('선택지 버튼의 터치 타깃이 44px 이상이다 (MU10)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={() => {}} />)
    const style = (screen.getByTestId('choice-0') as HTMLElement).style
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  // MU9 — prefers-reduced-motion 존중. jsdom은 외부 CSS(@media 포함)를 읽지 않으므로
  // (Ruling 20과 같은 이유) 인라인 style.animation을 직접 실측한다.
  it('prefers-reduced-motion이면 애니메이션 없이 뜬다 (MU9)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={() => {}} />)
    expect((screen.getByTestId('choice-sheet') as HTMLElement).style.animation).toBe('none')
  })

  it('reduced-motion이 아니면 슬라이드업 애니메이션이 걸린다 (MU9)', () => {
    render(<ChoiceSheet eventId="e1" choices={choices} open onChoose={() => {}} />)
    const anim = (screen.getByTestId('choice-sheet') as HTMLElement).style.animation
    expect(anim).not.toBe('')
    expect(anim).not.toBe('none')
  })

  // 직접 확인 요청 — 실제 콘텐츠에서 가장 긴 선택지 텍스트로도 시트가 깨지지 않는지.
  // 하드코딩한 문자열이 아니라 loadEvents()에서 실제로 가장 긴 라벨을 유도한다.
  it('실제 콘텐츠에서 가장 긴 선택지 라벨도 잘리거나 던지지 않고 그대로 렌더된다', () => {
    const labels = loadEvents().flatMap(e => (e.choices ?? []).map(c => c.label))
    const longest = labels.reduce((a, b) => (b.length > a.length ? b : a), '')
    expect(longest.length).toBeGreaterThan(0)
    const twoChoices: EventChoice[] = [{ label: longest, effects: [] }, { label: '짧음', effects: [] }]
    expect(() =>
      render(<ChoiceSheet eventId="e1" choices={twoChoices} open onChoose={() => {}} />),
    ).not.toThrow()
    expect(screen.getByTestId('choice-0').textContent).toBe(longest)
  })
})

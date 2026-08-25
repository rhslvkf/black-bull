import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from './TabBar'
import { useGame } from '../store/store'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('TabBar', () => {
  it('처음에는 홈 탭이 활성이다', () => {
    render(<TabBar />)
    // 부분 문자열 단언(toMatch(/active/))은 'xactive' 같은 오타 클래스도 통과시킨다 —
    // classList로 정확히 일치시킨다.
    expect(screen.getByTestId('tab-home').classList.contains('active')).toBe(true)
    expect(screen.getByTestId('tab-market').classList.contains('active')).toBe(false)
  })
  it('다른 탭을 클릭하면 스토어의 tab이 바뀌고 활성 클래스가 옮겨간다', () => {
    render(<TabBar />)
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(useGame.getState().tab).toBe('market')
    expect(screen.getByTestId('tab-market').classList.contains('active')).toBe(true)
    expect(screen.getByTestId('tab-home').classList.contains('active')).toBe(false)
  })
  it('4개 탭 전부 클릭하면 각각의 tab 값으로 바뀐다', () => {
    render(<TabBar />)
    for (const t of ['market', 'account', 'codex', 'home'] as const) {
      fireEvent.click(screen.getByTestId(`tab-${t}`))
      expect(useGame.getState().tab).toBe(t)
    }
  })
})

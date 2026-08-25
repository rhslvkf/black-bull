import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from './TabBar'
import { useGame } from '../store/store'

beforeEach(() => { localStorage.clear(); useGame.getState().reset(); useGame.getState().newGame(1) })

describe('TabBar', () => {
  it('처음에는 홈 탭이 활성이다', () => {
    render(<TabBar />)
    expect(screen.getByTestId('tab-home').className).toMatch(/active/)
    expect(screen.getByTestId('tab-market').className).not.toMatch(/active/)
  })
  it('다른 탭을 클릭하면 스토어의 tab이 바뀌고 활성 클래스가 옮겨간다', () => {
    render(<TabBar />)
    fireEvent.click(screen.getByTestId('tab-market'))
    expect(useGame.getState().tab).toBe('market')
    expect(screen.getByTestId('tab-market').className).toMatch(/active/)
    expect(screen.getByTestId('tab-home').className).not.toMatch(/active/)
  })
  it('4개 탭 전부 클릭하면 각각의 tab 값으로 바뀐다', () => {
    render(<TabBar />)
    for (const t of ['market', 'account', 'codex', 'home'] as const) {
      fireEvent.click(screen.getByTestId(`tab-${t}`))
      expect(useGame.getState().tab).toBe(t)
    }
  })
})

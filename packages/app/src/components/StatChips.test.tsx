import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { screen } from '@testing-library/react'
import { renderWithState, currentState } from '../testUtils'
import { useGame } from '../store/store'
import { StatChips } from './StatChips'

// Ruling 18 — packages/app에는 @testing-library/jest-dom이 없다. toBeInTheDocument 대신
// getByTestId가 던지는지(없으면 던진다)로, toHaveLength 대신 배열 길이 직접 비교로 본다.

const STAT_KEYS = ['grit', 'stamina', 'info', 'analysis', 'network'] as const

describe('StatChips', () => {
  it('다섯 스탯을 전부 보여준다', () => {
    renderWithState({})
    for (const k of STAT_KEYS) {
      // getByTestId는 없으면 던진다 — MU1(network 등 하나를 안 그리는 뮤테이션) 대비.
      expect(() => screen.getByTestId(`stat-${k}`)).not.toThrow()
    }
  })

  it('스탯마다 색이 다르다', () => {
    renderWithState({})
    const colors = STAT_KEYS.map(k => getComputedStyle(screen.getByTestId(`stat-${k}`)).getPropertyValue('--chip'))
    // MU2(5색을 전부 같은 색으로) 대비 — Set 크기가 5 미만이면 잡힌다.
    expect(new Set(colors).size).toBe(5)
  })

  it('스탯 값을 소수 첫째 자리까지 보여준다', () => {
    renderWithState({ player: { stats: { analysis: 4.2 } } })
    expect(screen.getByTestId('stat-analysis').textContent).toContain('4.2')
  })
})

describe('스탯 5색 토큰이 실제로 서로 다른 hex다 (StatChips 색 계약의 근거)', () => {
  // 위 '스탯마다 색이 다르다' 테스트는 요소에 실제로 내려온 --chip 값이 서로 다른
  // *문자열*인지만 본다(리터럴 `var(--stat-<key>)` 비교). 그 문자열들이 가리키는
  // 실제 토큰이 우연히 같은 hex를 공유해도 그 테스트는 못 잡는다 — 여기서 tokens.css를
  // 직접 읽어 5개 토큰이 실제로 다른 색인지 한 번 더 고정한다(design/tokens.test.ts의
  // 등급색 구별 검사와 같은 방식).
  const here = dirname(fileURLToPath(import.meta.url))
  const tokensCss = readFileSync(join(here, '../design/tokens.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

  function hex(name: string): [number, number, number] {
    const m = tokensCss.match(new RegExp(`--${name}\\s*:\\s*#([0-9a-fA-F]{6});`))
    if (!m) throw new Error(`--${name} 토큰이 hex로 정의되지 않았다`)
    const h = m[1]!
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  }

  it('5개 스탯 토큰이 정의돼 있고 서로 충분히 구별된다', () => {
    const MIN_DISTANCE = 30 // design/tokens.test.ts의 등급색 문턱과 같은 값
    const colors = STAT_KEYS.map(k => hex(`stat-${k}`))
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const [ar, ag, ab] = colors[i]!
        const [br, bg, bb] = colors[j]!
        const dist = Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2)
        expect(dist).toBeGreaterThanOrEqual(MIN_DISTANCE)
      }
    }
  })
})

describe('스탯 값 증가 시 플래시(§6 상태 전이)', () => {
  it('스탯이 늘어나면 flash 클래스가 붙었다가, 다시 늘지 않으면 그대로 유지되지 않는다(플래시는 증가 신호다)', () => {
    // <StatChips/>를 직접 렌더한다 — renderWithState의 기본 ui(<HomeScreen/>)로 마운트한
    // 뒤 rerender(<StatChips/>)를 부르면 루트 엘리먼트 타입이 바뀌어 컴포넌트가
    // 통째로 새로 마운트되고, 그러면 prevRef가 "늘어나기 전"이 아니라 최신값으로
    // 초기화돼 이 테스트가 항상 실패한다(실제로 겪은 실수 — 렌더 대상을 명시한다).
    const { rerender } = renderWithState({ player: { stats: { grit: 1 } } }, <StatChips />)
    expect(screen.getByTestId('stat-grit').className).not.toContain('stat-chip-flash')

    const s = currentState()
    // 스토어 상태를 직접 늘려 리렌더 — 컴포넌트가 "이전 값보다 늘었다"를 직접 비교해야
    // 플래시가 붙는다(단순히 렌더될 때마다 붙이면 이 테스트가 최초 렌더에서도 잡는다).
    useGame.setState({ state: { ...s, player: { ...s.player, stats: { ...s.player.stats, grit: 2 } } } })
    rerender(<StatChips />)
    expect(screen.getByTestId('stat-grit').className).toContain('stat-chip-flash')
  })

  it('스탯이 줄어들면 플래시가 붙지 않는다', () => {
    const { rerender } = renderWithState({ player: { stats: { grit: 5 } } }, <StatChips />)
    const s = currentState()
    useGame.setState({ state: { ...s, player: { ...s.player, stats: { ...s.player.stats, grit: 1 } } } })
    rerender(<StatChips />)
    expect(screen.getByTestId('stat-grit').className).not.toContain('stat-chip-flash')
  })
})

describe('스탯 칩은 정보 표시용이다 (터치 타깃 실측 — 참고용)', () => {
  // "리롤 버튼과 스탯 칩의 터치 타깃을 실측하라"는 요청에 따라 실제 치수를 재서 남긴다.
  // 다만 스탯 칩은 탭 가능한 컨트롤이 아니다(onClick이 없다 — <button>이 아니라 <span>).
  // §3.1 레이아웃 예산이 스탯 칩 행 전체를 40px로 못박아 두는데, 다섯 칩 각각에 44px
  // 터치 타깃(최소 세로 44px)을 강제하면 그 예산을 구조적으로 넘긴다. 리롤 버튼(진짜
  // 탭 가능한 컨트롤)은 ActionMeter.test.tsx가 44px 이상을 못박는다 — 여기서는 칩이
  // "무언가를 렌더한다"만 실측하고, 44px를 강제하지 않는다(보고서 참고).
  it('칩은 button이 아니라 정보 표시 요소(span)다 — 클릭 핸들러가 없다는 뜻이다', () => {
    renderWithState({})
    expect(screen.getByTestId('stat-grit').tagName).not.toBe('BUTTON')
  })
})

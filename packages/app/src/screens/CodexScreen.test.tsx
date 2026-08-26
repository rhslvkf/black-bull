import { describe, it, expect } from 'vitest'
import { screen, within } from '@testing-library/react'
import { ENDINGS, TITLES } from '@bb/core'
import { renderWithCodex } from '../testUtils'

describe('CodexScreen', () => {
  it('미수집 엔딩은 ???로 가려진다', () => {
    renderWithCodex({ endings: ['bank'] })
    // Ruling(Task 16 지시) — 칭호 목록도 같은 문자열('???')로 가려지므로(아래 별도 테스트가
    // 고정한다), 화면 전체에서 세면 엔딩(7)+칭호(7)=14가 나와 브리프가 기대하는 7과
    // 어긋난다. 브리프의 검사 내용(미수집 엔딩 수만큼 ???가 뜬다)은 그대로 두고, 선택자만
    // 엔딩 영역(`codex-endings`)으로 좁힌다.
    const endingsSection = screen.getByTestId('codex-endings')
    expect(within(endingsSection).getAllByText('???').length).toBe(7)
  })

  it('수집한 엔딩은 이름이 보인다', () => {
    renderWithCodex({ endings: ['bank'] })
    // Ruling 18 — jest-dom 없이 순수 DOM(textContent)으로 본다. 검사 내용은 브리프와 같다.
    expect(screen.getByTestId('codex-ending-bank').textContent).toContain('은행 이자보단 낫지')
  })

  it('미수집 엔딩은 실제 이름이 어디에도 노출되지 않는다 (MU6)', () => {
    renderWithCodex({ endings: ['bank'] })
    for (const e of ENDINGS) {
      if (e.id === 'bank') continue
      expect(screen.queryByText(e.name)).toBeNull()
    }
  })

  it('수집한 엔딩은 ???로 가려지지 않는다 (MU7 — 반대 방향 뮤테이션)', () => {
    renderWithCodex({ endings: ['bank'] })
    const row = screen.getByTestId('codex-ending-bank')
    expect(row.textContent).not.toContain('???')
  })

  it('칭호도 엔딩과 같은 방식으로 가려진다 — 미수집 7종 전부 ???', () => {
    // codex override 없음(기본값) → endings·titles 둘 다 빈 배열, 칭호 7종 전부 미수집.
    renderWithCodex({})
    const titlesSection = screen.getByTestId('codex-titles')
    expect(within(titlesSection).getAllByText('???').length).toBe(7)
    for (const t of TITLES) expect(screen.queryByText(t.name)).toBeNull()
  })

  it('화면 전체 기준 가려진 항목 수는 엔딩 미수집분 + 칭호 미수집분의 합이다', () => {
    // 엔딩 1종(bank) 수집, 칭호는 0종 수집 → 엔딩 7 + 칭호 7 = 14.
    // 이 합산 검사 하나만 보면(칭호를 따로 나누지 않으면) 엔딩 쪽이 실명을 그대로
    // 노출해도 칭호의 ???가 그 결함을 가려 조용히 통과할 수 있다 — 그래서 위 두 테스트가
    // 엔딩·칭호 각각을 별도로도 고정해 둔다(이 테스트는 둘을 합친 총량만 못박는다).
    renderWithCodex({ endings: ['bank'] })
    expect(screen.getAllByText('???').length).toBe(14)
  })

  it('수집한 칭호는 이름이, 미수집 칭호는 ???가 보인다', () => {
    const beatRival = TITLES.find(t => t.id === 'beatRival')!
    renderWithCodex({ titles: [beatRival.name] })
    expect(screen.getByTestId(`codex-title-${beatRival.id}`).textContent).toBe(beatRival.name)
    const other = TITLES.find(t => t.id !== 'beatRival')!
    expect(screen.getByTestId(`codex-title-${other.id}`).textContent).toBe('???')
  })

  it('renderWithCodex가 codex override(endings·titles·runs·bestAssets)를 실제로 스토어에 주입한다', () => {
    const beatRival = TITLES.find(t => t.id === 'beatRival')!
    renderWithCodex({ endings: ['bank'], titles: [beatRival.name], bestAssets: 700_000_000, runs: 3 })
    // 이 override를 무시해도 renderWithCodex가 통과한다면(codex 기본값이 전부 0/빈 배열)
    // 이 네 단언이 전부 실패한다 — 헬퍼가 실제로 스토어에 값을 심는지 그 자체를 고정한다.
    expect(screen.getByText(/3회 플레이/)).toBeDefined()
    expect(screen.getByText(/700,000,000원/)).toBeDefined()
    expect(screen.getByTestId('codex-ending-bank').textContent).toContain('은행 이자보단 낫지')
    expect(screen.getByTestId(`codex-title-${beatRival.id}`).textContent).toBe(beatRival.name)
  })
})

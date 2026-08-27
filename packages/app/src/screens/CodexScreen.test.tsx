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

  it('수집한 엔딩의 도장은 실제로 <Art>/registry를 거친다 (Fix Round 1 Minor 1)', () => {
    // 텍스트 검사(위 테스트들)는 <span className="codex-stamp"> 안에 아무 대체 요소를
    // 넣어도(예: 빈 <div>) 통과한다 — 도장 자리가 실제로 art/registry.tsx의 ending.* svg를
    // 그리는지는 그 svg 고유의 표식(role="img", aria-label에 실제 엔딩 이름)으로 확인해야
    // 한다. 잠긴 엔딩의 도장(ui.lock)은 다른 아이콘이라는 것도 함께 못박는다.
    renderWithCodex({ endings: ['bank'] })

    const gotStamp = screen.getByTestId('codex-ending-bank').querySelector('.codex-stamp')!
    const gotSvg = gotStamp.querySelector('svg')
    expect(gotSvg).not.toBeNull()
    expect(gotSvg!.getAttribute('role')).toBe('img')
    expect(gotSvg!.getAttribute('aria-label')).toBe('은행 이자보단 낫지')

    const lockedId = ENDINGS.find(e => e.id !== 'bank')!.id
    const lockedStamp = screen.getByTestId(`codex-ending-${lockedId}`).querySelector('.codex-stamp')!
    const lockedSvg = lockedStamp.querySelector('svg')
    expect(lockedSvg).not.toBeNull()
    // 잠긴 자리는 자물쇠 아이콘이지 엔딩 이름이 아니다 — 스포일러가 없다.
    expect(lockedSvg!.getAttribute('aria-label')).not.toBe(ENDINGS.find(e => e.id === lockedId)!.name)
  })
})

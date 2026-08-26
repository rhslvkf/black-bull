import { describe, it, expect } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import type { NewsItem } from '@bb/core'
import { renderWithState } from '../testUtils'

// core의 실제 뉴스 타입은 문자열 배열이 아니라 `NewsItem[]`
// (`{ turn: number; kind: 'news' | 'rumor'; title: string }`, packages/core/src/types.ts) —
// 브리프 예시(`news: ['첫 소식', ...]`)는 이 타입과 맞지 않아 그대로 옮기면 tsc가 막는다.
// 아래 헬퍼가 브리프가 의도한 순서·내용은 그대로 유지하면서 실제 타입에 맞춰 만든다.
const item = (turn: number, title: string, kind: NewsItem['kind'] = 'news'): NewsItem =>
  ({ turn, kind, title })

describe('NewsTicker', () => {
  it('가장 최근 뉴스 한 건만 한 줄로 보여준다', () => {
    renderWithState({ news: [item(1, '첫 소식'), item(2, '둘째 소식'), item(3, '셋째 소식')] })
    const line = screen.getByTestId('ticker-line')
    expect(line.textContent).toContain('셋째 소식')
    expect(screen.queryByText('첫 소식')).toBeNull()
    expect(screen.queryByText('둘째 소식')).toBeNull()
  })

  // MU2 대비 — queryByText는 노드 전체 텍스트가 정확히 일치할 때만 찾으므로, 티커가
  // 세 건을 이어붙여 한 노드에 렌더해도(예: '첫 소식 / 둘째 소식 / 셋째 소식') 위
  // queryByText 단언은 속일 수 있다(어느 노드도 '첫 소식'과 정확히 같지 않으니
  // null을 반환해 통과해 버린다). textContent를 부분 문자열로 직접 검사해 막는다.
  it('티커 한 줄에는 최신 한 건 외의 다른 뉴스 문구가 섞이지 않는다', () => {
    renderWithState({ news: [item(1, '첫 소식'), item(2, '둘째 소식'), item(3, '셋째 소식')] })
    const text = screen.getByTestId('ticker-line').textContent ?? ''
    expect(text).toContain('셋째 소식')
    expect(text).not.toContain('첫 소식')
    expect(text).not.toContain('둘째 소식')
  })

  it('뉴스가 없으면 안내 문구가 나온다', () => {
    renderWithState({ news: [] })
    expect(screen.getByTestId('ticker-line').textContent).toContain('아직 아무 소식도 없다')
  })

  it('탭하면 최근 8건이 시트로 열린다', () => {
    renderWithState({ news: Array.from({ length: 20 }, (_, i) => item(i, `소식 ${i}`)) })
    fireEvent.click(screen.getByTestId('ticker-line'))
    expect(screen.getAllByTestId(/^news-item-/)).toHaveLength(8)
  })

  it('루머는 티커에서 data-rumor="true"로 표시된다', () => {
    renderWithState({ news: [item(1, '[루머] 뭔가 돈다', 'rumor')] })
    expect(screen.getByTestId('ticker-line').getAttribute('data-rumor')).toBe('true')
  })

  it('루머가 아닌 뉴스는 data-rumor="false"다 (MU6 대비 — false 하드코딩이면 이 값도 우연히 맞을 수 있어 위 true 테스트와 짝을 이룬다)', () => {
    renderWithState({ news: [item(1, '평범한 소식')] })
    expect(screen.getByTestId('ticker-line').getAttribute('data-rumor')).toBe('false')
  })

  it('뉴스가 없을 때도 티커는 data-rumor="false"다', () => {
    renderWithState({ news: [] })
    expect(screen.getByTestId('ticker-line').getAttribute('data-rumor')).toBe('false')
  })

  // MU5 대비 — 브리프는 시트 항목 개수(8)만 검사한다. 최신 8건이 아니라 가장 오래된
  // 8건을 보여줘도 개수 검사는 통과한다. 20건 중 어느 8건인지를 순서까지 못박는다.
  it('시트는 가장 오래된 8건이 아니라 가장 최근 8건을 최신순으로 보여준다', () => {
    renderWithState({ news: Array.from({ length: 20 }, (_, i) => item(i, `소식 ${i}`)) })
    fireEvent.click(screen.getByTestId('ticker-line'))
    const items = screen.getAllByTestId(/^news-item-/)
    expect(items).toHaveLength(8)
    // 최신 8건은 '소식 19' ~ '소식 12'(내림차순 = 최신 우선). '소식 0'~'소식 7'(오래된
    // 8건)이 뜨면 아래 두 단언이 모두 실패한다.
    expect(items[0]!.textContent).toContain('소식 19')
    expect(items[7]!.textContent).toContain('소식 12')
    expect(items.map(el => el.textContent).join('|')).not.toContain('소식 0|')
  })

  // MU7 대비 — 뉴스/루머 두 종류가 섞여 있을 때 "서로 다르다"만 보면 판별이 통째로
  // 뒤집혀도(일반 뉴스가 루머로, 루머가 일반 뉴스로) 잡히지 않는다. 각 항목의 값을
  // 리터럴로 못박는다.
  it('시트에서 일반 뉴스와 루머가 각각 올바른 data-rumor 값을 갖는다', () => {
    renderWithState({ news: [item(1, '일반 소식'), item(2, '[루머] 뭔가 돈다', 'rumor')] })
    fireEvent.click(screen.getByTestId('ticker-line'))
    // 최신순이므로 news-item-0이 루머(turn 2), news-item-1이 일반 뉴스(turn 1)다.
    const rumorItem = screen.getByTestId('news-item-0')
    const newsItem = screen.getByTestId('news-item-1')
    expect(rumorItem.textContent).toContain('[루머] 뭔가 돈다')
    expect(rumorItem.getAttribute('data-rumor')).toBe('true')
    expect(newsItem.textContent).toContain('일반 소식')
    expect(newsItem.getAttribute('data-rumor')).toBe('false')
  })

  it('닫기 버튼을 누르면 시트가 사라진다 (MU8 — 못 닫으면 게임이 멈춘다)', () => {
    renderWithState({ news: [item(1, '소식')] })
    fireEvent.click(screen.getByTestId('ticker-line'))
    expect(screen.getByTestId('news-sheet')).toBeDefined()
    fireEvent.click(screen.getByTestId('news-sheet-close'))
    expect(screen.queryByTestId('news-sheet')).toBeNull()
  })

  it('바깥(백드롭)을 누르면 시트가 사라진다', () => {
    renderWithState({ news: [item(1, '소식')] })
    fireEvent.click(screen.getByTestId('ticker-line'))
    expect(screen.getByTestId('news-sheet')).toBeDefined()
    fireEvent.click(screen.getByTestId('news-sheet-backdrop'))
    expect(screen.queryByTestId('news-sheet')).toBeNull()
  })

  it('시트 안쪽을 눌러도 닫히지 않는다 (백드롭 클릭만 닫는다)', () => {
    renderWithState({ news: [item(1, '소식')] })
    fireEvent.click(screen.getByTestId('ticker-line'))
    fireEvent.click(screen.getByTestId('news-sheet'))
    expect(screen.getByTestId('news-sheet')).toBeDefined()
  })

  // MU9 — 제약값 44는 이 테스트 안의 리터럴이다(design/layout.ts의 TOUCH_TARGET_PX를
  // import해 자기 자신과 비교하면 그 값이 무엇이든 항상 통과한다).
  it('티커 한 줄의 터치 타깃은 44px 이상이다', () => {
    renderWithState({ news: [item(1, '소식')] })
    const line = screen.getByTestId('ticker-line')
    expect(parseInt(getComputedStyle(line).minHeight, 10)).toBeGreaterThanOrEqual(44)
  })

  it('닫기 버튼의 터치 타깃도 44px 이상이다', () => {
    renderWithState({ news: [item(1, '소식')] })
    fireEvent.click(screen.getByTestId('ticker-line'))
    const close = screen.getByTestId('news-sheet-close')
    expect(parseInt(getComputedStyle(close).minHeight, 10)).toBeGreaterThanOrEqual(44)
    expect(parseInt(getComputedStyle(close).minWidth, 10)).toBeGreaterThanOrEqual(44)
  })

  // 매우 긴 뉴스 문자열이 한 줄을 깨지 않는지. jsdom은 외부 CSS(index.css)를 적용하지
  // 않으므로(Ruling 20) 줄바꿈을 막는 세 속성이 인라인으로 내려와 있는지 실측한다 —
  // 실제 시각적 말줄임은 브라우저 레이아웃 엔진의 몫이지만, 그 전제 조건(한 줄 강제)이
  // 깨지지 않았는지는 이렇게 고정할 수 있다. 텍스트 자체는 잘리지 않고 DOM에 그대로
  // 남아 있어야 한다(말줄임은 시각적 클리핑이지 문자열 절단이 아니다).
  it('아주 긴 뉴스 문자열도 한 줄 레이아웃이 깨지지 않는다', () => {
    const longTitle = '코스피가 요동치는 가운데 '.repeat(20) + '마감했다'
    renderWithState({ news: [item(1, longTitle)] })
    const text = screen.getByTestId('ticker-line').querySelector('.ticker-text') as HTMLElement
    expect(text.textContent).toBe(longTitle)
    const style = getComputedStyle(text)
    expect(style.whiteSpace).toBe('nowrap')
    expect(style.overflow).toBe('hidden')
    expect(style.textOverflow).toBe('ellipsis')
  })

  it('뉴스가 없으면 시트를 열어도 안내 문구가 뜨고 항목이 없다', () => {
    renderWithState({ news: [] })
    fireEvent.click(screen.getByTestId('ticker-line'))
    expect(screen.queryAllByTestId(/^news-item-/)).toHaveLength(0)
    expect(screen.getByTestId('news-sheet').textContent).toContain('아직 아무 소식도 없다')
  })
})

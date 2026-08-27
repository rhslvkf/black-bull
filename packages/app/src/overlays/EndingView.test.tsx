import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { ENDING_IDS, type EndingId } from '@bb/core'
import { renderEnding } from '../testUtils'

// Ruling 18 — packages/app에는 @testing-library/jest-dom이 없다. `toHaveTextContent`
// 대신 순수 DOM(`el.textContent`)으로, `toHaveLength`는 배열 `.length`로 본다.
// 검사 내용은 브리프와 동일하다.

// 리뷰 Fix Round 1(Critical) — 엔딩은 모달이 아니라 게임의 마지막 장면이다(Ruling 28,
// Task 20이 프롤로그·컷신에 세운 원칙과 같다). `.overlay`의 기본 반투명 배경
// (rgba(...,.96))을 그대로 물려받으면 뒤(홈 HUD·탭바)가 비친다 — 실제로 Fix Round 1
// 리뷰가 스크린샷 14장 전부에서 재현했다. jsdom은 실제 합성 결과를 계산하지 않으므로
// (Ruling 20과 같은 이유) index.css 소스에서 `.overlay.ending` 규칙 블록을 직접 파싱해,
// 알파 채널(rgba(...)의 네 번째 인자, 또는 별도 opacity 속성)을 전혀 쓰지 않는지 고정한다.
// overlays.test.tsx의 '프롤로그·컷신은 완전 불투명 장면이다' 블록과 같은 기법이다.
describe('EndingView는 완전 불투명 장면이다 (Critical Fix Round 1)', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
  const css = readFileSync(cssPath, 'utf-8')
  const endingBgRule = css.match(/\.overlay\.ending\s*\{[^}]*\}/)?.[0] ?? ''

  it('.overlay.ending 규칙이 index.css에 존재한다', () => {
    expect(endingBgRule, '.overlay.ending 규칙을 못 찾았다').not.toBe('')
  })

  it('알파 채널(rgba/opacity)을 전혀 쓰지 않는다', () => {
    expect(endingBgRule, `알파가 섞인 rgba(...)를 쓰고 있다: "${endingBgRule}"`).not.toMatch(/rgba\(/)
    expect(endingBgRule, `opacity 속성으로 반투명을 흉내내고 있다: "${endingBgRule}"`).not.toMatch(/opacity\s*:/)
  })
})

describe('EndingView 잔고증명서', () => {
  it('예수금·주식평가금액·합계를 보여준다', () => {
    renderEnding({ cash: 31_311_114, holdingValue: 3_308_610 })
    expect(screen.getByTestId('doc-cash').textContent).toContain('31,311,114원')
    expect(screen.getByTestId('doc-stock').textContent).toContain('3,308,610원')
    expect(screen.getByTestId('doc-total').textContent).toContain('34,619,724원')
  })

  it('낸 수수료와 세금의 합계를 보여준다', () => {
    renderEnding({ trackers: { feesPaid: 300_000, taxPaid: 112_880 } })
    expect(screen.getByTestId('doc-cost').textContent).toContain('412,880원')
  })

  it('최고 자산·최대 낙폭·거래 횟수를 보여준다', () => {
    renderEnding({ trackers: { peakAssets: 42_180_000, maxDrawdownPct: 18.4, tradeCount: 47 } })
    expect(screen.getByTestId('doc-peak').textContent).toContain('42,180,000원')
    expect(screen.getByTestId('doc-drawdown').textContent).toContain('18.4')
    expect(screen.getByTestId('doc-trades').textContent).toContain('47')
  })

  // 리뷰 Fix Round 1(Major) — 브리프의 toContain('18.4') 검사는 부분 문자열이라
  // '−18.4'와 '18.4' 둘 다 통과시킨다(Task 17의 '최존버2' 함정과 같은 부류). 부호
  // 자체는 §4.4 와이어프레임(`−18.4 %`)이 요구하는 의도된 표시라 지우지 않고,
  // 대신 부호까지 포함한 정확 일치로 낙폭 표시를 고정한다.
  it('최대 낙폭에 하락 부호(−)가 붙는다 (부호까지 정확히 일치)', () => {
    renderEnding({ trackers: { maxDrawdownPct: 18.4 } })
    expect(screen.getByTestId('doc-drawdown').textContent).toBe('\u221218.4%')
  })

  it('최대 낙폭 0%일 때는 부호가 붙지 않는다', () => {
    renderEnding({ trackers: { maxDrawdownPct: 0 } })
    expect(screen.getByTestId('doc-drawdown').textContent).toBe('0.0%')
  })

  it('엔딩 이름이 한국어로 나오고 내부 id가 새지 않는다', () => {
    renderEnding({ endingId: 'bank' })
    expect(screen.getByTestId('ending-name').textContent).toContain('은행 이자보단 낫지')
    expect(screen.getByTestId('ending-doc').textContent).not.toContain('bank')
  })

  it('칭호가 전부, 넘긴 순서 그대로 표시된다', () => {
    // 리뷰 Fix Round 1(Minor 1) — 개수만 보면 순서가 뒤바뀌어도 통과한다.
    // 리터럴 기대 배열과 순서까지 toEqual로 대조한다.
    renderEnding({ titles: ['강철멘탈의', '빚 없이'] })
    const shown = screen.getAllByTestId(/^title-/).map(el => el.textContent)
    expect(shown).toEqual(['강철멘탈의', '빚 없이'])
  })

  it('칭호가 없으면 칭호 영역이 비어 있다', () => {
    renderEnding({ titles: [] })
    expect(screen.queryAllByTestId(/^title-/).length).toBe(0)
  })

  it('실존 증권사명을 쓰지 않는다', () => {
    renderEnding({})
    const text = screen.getByTestId('ending-doc').textContent!
    for (const w of ['미래에셋', '삼성증권', '키움', 'NH투자', '한국투자', '토스증권']) {
      expect(text.includes(w), `문서에 금칙어 "${w}"가 있음`).toBe(false)
    }
  })

  it('계좌번호가 마스킹된 형태다', () => {
    renderEnding({})
    expect(/^0{3}-0{2}-0{6}$/.test(screen.getByTestId('doc-account').textContent ?? '')).toBe(true)
  })

  it('계좌번호에 0이 아닌 실제 숫자가 섞이지 않는다', () => {
    // 위 정규식 하나만으로는 "누군가 마스킹을 풀어도 우연히 0으로만 채워진 자릿수"를
    // 지나칠 수 있는 결합 공격 지점은 아니지만(정규식이 이미 0만 허용), MU8(마스킹을
    // 풀어 실제 숫자처럼 보이게 함)을 향한 의도를 별도 단언으로 한 번 더 명시한다.
    renderEnding({})
    const account = screen.getByTestId('doc-account').textContent ?? ''
    expect(/[1-9]/.test(account)).toBe(false)
  })

  it('터치 타깃(다시 하기 버튼)이 44px 이상이다', () => {
    // 계획서 전역 제약의 터치 타깃 최소값. design/layout.ts의 TOUCH_TARGET_PX를
    // import해 자기 자신과 비교하지 않는다 — 44는 이 테스트 안의 리터럴이다.
    const MIN_TOUCH_TARGET_PX = 44
    renderEnding({})
    const style = screen.getByTestId('restart').style
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })
})

describe('EndingView 극단값', () => {
  it('자산 0원에서도 서식이 무너지지 않는다', () => {
    renderEnding({ cash: 0, holdingValue: 0, trackers: { feesPaid: 0, taxPaid: 0, peakAssets: 0, maxDrawdownPct: 0, tradeCount: 0 } })
    expect(screen.getByTestId('doc-total').textContent).toContain('0원')
    expect(screen.getByTestId('doc-drawdown').textContent).toContain('0.0')
    expect(screen.getByTestId('doc-trades').textContent).toContain('0')
  })

  it('자산 수십억에서도 천 단위 구분자가 유지된다', () => {
    renderEnding({ cash: 3_000_000_000, holdingValue: 1_234_567_890 })
    expect(screen.getByTestId('doc-cash').textContent).toContain('3,000,000,000원')
    expect(screen.getByTestId('doc-total').textContent).toContain('4,234,567,890원')
  })

  it('최대 낙폭 100%에서도 서식이 무너지지 않는다', () => {
    renderEnding({ trackers: { maxDrawdownPct: 100 } })
    expect(screen.getByTestId('doc-drawdown').textContent).toContain('100.0')
  })

  it('거래 횟수 0회를 그대로 보여준다', () => {
    renderEnding({ trackers: { tradeCount: 0 } })
    expect(screen.getByTestId('doc-trades').textContent).toContain('0회')
  })
})

describe('EndingView 엔딩 8종 전수 검사', () => {
  // 계획서 §5.1은 엔딩마다 다른 도장 그래픽을 요구한다(§8 — 3종은 현재 도달
  // 불가능하지만 8종 전부가 정상 렌더되어야 신용 시스템이 연결되는 즉시 쓸 수 있다).
  // 사전선언한 이름 배열과 비교하지 않는다(결합 공격에 세 번 뚫린 패턴) — core의
  // 정본 목록(`ENDING_IDS`)에서 `.map()`으로 실측값을 유도하고, 기대 이름만 이
  // 테스트 안의 리터럴 레코드로 대조한다.
  const EXPECTED_NAMES: Record<EndingId, string> = {
    legend: '흑우의 전설',
    savings: '적금이나 들걸',
    breakeven: '본전이 어디야',
    bank: '은행 이자보단 낫지',
    wise: '슬기로운 투자생활',
    super: '슈퍼개미',
    fire: '파이어족',
    kimheir: '김실장의 후예',
  }

  it('8종 전부가 이름·도장과 함께 렌더된다', () => {
    const observed = ENDING_IDS.map(id => {
      const { unmount } = renderEnding({ endingId: id })
      const name = screen.getByTestId('ending-name').textContent
      // 도장: Art가 그리는 svg[role="img"] 하나가 문서 안에 실제로 있는가.
      const stamp = screen.getByTestId('ending-doc').querySelector('svg[role="img"]')
      const result = { id, name, hasStamp: stamp !== null }
      unmount()
      return result
    })

    expect(observed).toEqual(
      ENDING_IDS.map(id => ({ id, name: EXPECTED_NAMES[id], hasStamp: true })),
    )
  })

  it('엔딩마다 도장의 시각 정체(aria-label)가 서로 다르다', () => {
    const labels = ENDING_IDS.map(id => {
      const { unmount } = renderEnding({ endingId: id })
      const stamp = screen.getByTestId('ending-doc').querySelector('svg[role="img"]')
      const label = stamp?.getAttribute('aria-label') ?? null
      unmount()
      return label
    })
    expect(new Set(labels).size).toBe(ENDING_IDS.length)
  })
})

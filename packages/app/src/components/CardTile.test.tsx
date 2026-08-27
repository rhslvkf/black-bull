import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GRADES, gradeAp, gradeCashMul, gradeMul, loadCards, type CardGrade } from '@bb/core'
import { CardTile } from './CardTile'

// Ruling 18 — @testing-library/jest-dom을 추가하지 않는다. toHaveTextContent/toBeDisabled
// 대신 순수 DOM(el.textContent, el.hasAttribute('disabled'))으로 본다. 검사 내용은
// 브리프와 동일하다.
//
// Ruling 20 — jsdom은 외부 CSS를 읽지 않고 var()도 해석하지 않는다. 등급 배지 색은
// CardTile.tsx가 인라인 `backgroundColor: var(--grade-<등급>)`로 내리므로
// getComputedStyle이 그 문자열을 그대로 돌려주고, 6개 등급이 서로 다른 문자열이 된다.
// (Fix Round 1 Minor 2 — "서로 다르다"만 보고 "실제 토큰을 가리키는가"는 안 보던 구멍을
// 아래 describe가 tokens.css를 직접 읽어 메운다.)

const CARDS = loadCards()
const analyze = CARDS.find(c => c.id === 'analyze')!
const rest = CARDS.find(c => c.id === 'rest')!

// design/tokens.test.ts(Task 9)가 세운 전례를 그대로 따른다 — tokens.css를 readFileSync로
// 읽어 `--name: 값;` 형태의 실제 선언이 있는지 정규식으로 확인한다. 손으로 6개 이름을
// 다시 적지 않고 core의 GRADES에서 유도한다.
const tokensCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../design/tokens.css'),
  'utf-8',
)
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}
function definesCustomProperty(css: string, name: string): boolean {
  const re = new RegExp(`--${name}\\s*:\\s*[^;]+;`)
  return re.test(stripCssComments(css))
}

describe('CardTile', () => {
  it('등급 배지를 보여준다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
    expect(screen.getByTestId('grade-badge').textContent).toContain('A')
  })

  it('등급마다 배지 색이 다르다', () => {
    const color = (g: CardGrade) => {
      const { container, unmount } = render(<CardTile slot={{ cardId: 'analyze', grade: g }} />)
      const c = getComputedStyle(container.querySelector('[data-testid=grade-badge]')!).backgroundColor
      unmount()
      return c
    }
    expect(new Set(GRADES.map(g => color(g))).size).toBe(GRADES.length)
  })

  it('효과가 등급 배율이 반영된 값으로 보인다', () => {
    // 기댓값은 CardTile.tsx를 다시 베끼지 않고 core의 실제 값(loadCards + gradeMul)에서
    // 직접 유도한다 — analyze의 기본 analysis 델타는 카드 데이터가 정하고, 배율은
    // core의 gradeMul('A')가 정한다. 둘 다 CardTile 내부 구현이 아니라 이 테스트가
    // 독립적으로 아는 값이므로, CardTile이 배율을 빼먹으면(MU3) 실패해야 한다.
    const base = analyze.effects.find(e => e.type === 'stat' && e.stat === 'analysis')
    if (base?.type !== 'stat') throw new Error('테스트 전제가 깨졌다: analyze에 analysis 스탯 효과가 없다')
    const expected = base.delta * gradeMul('A')
    expect(expected).toBeCloseTo(1.1, 5) // 브리프가 못박은 값(0.5 × 2.2)과 일치하는지도 함께 고정
    render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
    expect(screen.getByTestId('effect-summary').textContent).toContain(`+${expected.toFixed(1)}`)
  })

  it('회복 카드는 행동력 0으로 표시된다', () => {
    render(<CardTile slot={{ cardId: 'rest', grade: 'C' }} />)
    expect(screen.getByTestId('ap-cost').textContent).toBe('⚡0')
  })

  // MU4 대비 — 등급이 최고(S)라도 회복 카드는 여전히 0이어야 한다. 등급 C 하나만
  // 보면 "회복이라 0"인지 "우연히 이 등급이 0"인지 구별할 수 없다.
  it('회복 카드는 등급이 S여도 행동력 0이다 (MU4 대비)', () => {
    render(<CardTile slot={{ cardId: 'rest', grade: 'S' }} />)
    expect(screen.getByTestId('ap-cost').textContent).toBe('⚡0')
  })

  // 컨트롤러 판정 1·MU7 — 효과 요약이 보상(analysis +1.1)만 보여주고 컨디션 대가를
  // 숨기면 "등급이 오르면 보상과 함께 대가도 커진다"는 §2.2 규칙이 화면에서 사라진다.
  // 브리프의 원본 테스트에는 없던 항목 — 이 태스크가 직접 추가한다.
  describe('효과 요약이 대가를 숨기지 않는다 (컨트롤러 판정 1, MU7)', () => {
    it('analyze A등급의 컨디션 대가(-6 × 2.2 = -13.2)가 화면에 보인다', () => {
      const base = analyze.effects.find(e => e.type === 'condition')
      if (base?.type !== 'condition') throw new Error('테스트 전제가 깨졌다: analyze에 condition 효과가 없다')
      const expectedCondition = base.delta * gradeMul('A')
      expect(expectedCondition).toBeCloseTo(-13.2, 5)
      const { container } = render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
      const costNode = container.querySelector('[data-testid^="cost-condition-"]')
      expect(costNode).not.toBeNull()
      expect(costNode!.textContent).toContain(expectedCondition.toFixed(1))
    })

    it('대가는 effect-summary(보상 줄)가 아니라 별도 비용 표시에 있다', () => {
      const { container } = render(<CardTile slot={{ cardId: 'analyze', grade: 'A' }} />)
      expect(screen.getByTestId('effect-summary').textContent).not.toContain('13.2')
      expect(container.querySelector('[data-testid^="cost-condition-"]')).not.toBeNull()
    })
  })

  // Fix Round 1 Minor 2 — "6개 등급의 배지 색이 서로 다르다"는 위 테스트가 이미 보지만,
  // 그 문자열이 실제로 tokens.css에 정의된 변수를 가리키는지는 안 본다(오타를 내도
  // 6개가 여전히 서로 다른 오타 문자열이라 통과한다). 여기서 그 구멍을 막는다 —
  // 배지의 backgroundColor에서 변수 이름을 뽑아 tokens.css에 실제 선언이 있는지 본다.
  describe('등급 배지가 참조하는 CSS 변수가 tokens.css에 실제로 존재한다 (Fix Round 1 Minor 2)', () => {
    it('등급 6종 전부 tokens.css에 정의된 --grade-* 변수를 가리킨다', () => {
      for (const g of GRADES) {
        const { container, unmount } = render(<CardTile slot={{ cardId: 'analyze', grade: g }} />)
        const bg = getComputedStyle(container.querySelector('[data-testid=grade-badge]')!).backgroundColor
        const m = bg.match(/^var\(--([a-zA-Z0-9-]+)\)$/)
        expect(m, `등급 ${g} 배지의 backgroundColor가 var(--x) 형태가 아니다: "${bg}"`).not.toBeNull()
        expect(
          definesCustomProperty(tokensCss, m![1]!),
          `등급 ${g}가 가리키는 --${m ? m[1] : '?'}가 tokens.css에 정의돼 있지 않다`,
        ).toBe(true)
        unmount()
      }
    })
  })

  // MU9 대비 — 회복 카드는 항상 열려 있고 행동력을 쓰지 않는다는 사실이 시각적으로
  // 구별돼야 한다(전역 제약). 행동 카드에는 이 표식이 없어야 대비가 실제로 성립한다.
  describe('회복 카드는 시각적으로 구별된다 (전역 제약, MU9)', () => {
    it('회복 카드에는 recovery-marker가 있다', () => {
      render(<CardTile slot={{ cardId: 'rest', grade: 'C' }} />)
      expect(screen.queryByTestId('recovery-marker')).not.toBeNull()
    })
    it('행동 카드에는 recovery-marker가 없다', () => {
      render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} />)
      expect(screen.queryByTestId('recovery-marker')).toBeNull()
    })
  })

  // Fix Round 1 Minor 1 — jsdom은 실제 그리드/텍스트 레이아웃을 계산하지 않으므로
  // §3.1 카드 높이 예산(190px)을 픽셀로 이 스위트에서 직접 잠글 수 없다(실측은
  // playwright로 따로 했다 — task-13-report.md "## Fix Round 1" 참고, 이 프로젝트의
  // 실제 vitest 스위트에는 브라우저 레이아웃 엔진이 없다). 대신 픽셀 높이의 실제
  // 원인이었던 "표시 줄 수"를 구조로 고정한다 — recovery-marker를 별도 줄로 되돌리거나
  // 새 줄을 추가하는 회귀가 있으면 여기서 잡힌다.
  describe('카드 표시 줄 수 상한 (Fix Round 1 Minor 1 — 높이 예산의 대리 지표)', () => {
    it('잠기지 않은 카드는 이름줄·효과줄·비용줄, 최대 3줄을 넘지 않는다 (카드 11종 × 등급 6종 전부)', () => {
      for (const c of CARDS) {
        for (const g of GRADES) {
          const { container, unmount } = render(<CardTile slot={{ cardId: c.id, grade: g }} />)
          const rows = container.querySelector(`[data-testid="slot-card-${c.id}"]`)!.children.length
          expect(rows, `${c.id}(${g}) 표시 줄 수가 3을 넘었다(${rows}줄)`).toBeLessThanOrEqual(3)
          unmount()
        }
      }
    })
  })

  it('선택된 카드는 picked 클래스를 받는다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} selected />)
    expect(screen.getByTestId('slot-card-analyze').className).toContain('picked')
  })

  it('disabled와 lockReason이 있으면 카드가 잠기고 사유가 보인다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} disabled lockReason="흔들려서 손에 안 잡힌다" />)
    const card = screen.getByTestId('slot-card-analyze')
    expect(card.hasAttribute('disabled')).toBe(true)
    expect(card.textContent).toContain('흔들려서')
  })

  it('disabled가 아니면 사유가 보이지 않는다', () => {
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} />)
    expect(screen.queryByTestId('card-lock-analyze')).toBeNull()
  })

  // 전역 제약: "터치 타깃 44px 이상". TopBar.test.tsx·ActionMeter.test.tsx와 같은 방식 —
  // 44는 계획서 요구값이지 이 구현의 상수가 아니므로 CardTile.tsx의 어떤 export도
  // 가져오지 않고 리터럴로 적는다(MU11 대비).
  it('카드 타일의 터치 타깃이 44px 이상이다 (Global Constraints, MU11)', () => {
    const MIN_TOUCH_TARGET_PX = 44
    render(<CardTile slot={{ cardId: 'analyze', grade: 'C' }} />)
    const style = getComputedStyle(screen.getByTestId('slot-card-analyze'))
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })

  it('알 수 없는 카드 id면 아무것도 그리지 않는다', () => {
    const { container } = render(<CardTile slot={{ cardId: 'no-such-card', grade: 'C' }} />)
    expect(container.textContent).toBe('')
  })

  it('rest 카드 자체가 존재한다 (테스트 전제 확인)', () => {
    expect(rest.isRecovery).toBe(true)
  })
})

// Task 22 §6 "타격감 — 카드 프레스". jsdom은 실제 CSS 트랜지션/의사클래스(:active)의
// 시각 효과를 계산하지 않으므로(Ruling 20과 같은 근본 이유) index.css 소스 텍스트를
// 직접 읽어 규칙 존재를 고정한다(tokens.test.ts·overlays.test.tsx가 세운 전례).
describe('카드 프레스 피드백이 CSS에 존재한다 (§6 타격감, MU9)', () => {
  const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
  const css = readFileSync(cssPath, 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

  function ruleBody(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
    const m = css.match(re)
    if (!m) throw new Error(`선택자를 찾을 수 없다: ${selector}`)
    return m[1]!
  }

  it('.card:active:not(:disabled)가 눌림(scale 축소)을 그린다', () => {
    expect(ruleBody('.card:active:not(:disabled)')).toMatch(/transform:\s*scale\(/)
  })

  it('.card가 transform 트랜지션을 --dur-fast 토큰으로 건다(하드코딩 금지)', () => {
    const body = ruleBody('.card')
    expect(body).toMatch(/transform\s+var\(--dur-fast\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 최종 리뷰 M1 — 등급 표시가 통째로 미고정이었다.
//
// 리뷰어가 CardTile.tsx의 세 지점을 상수 'A'로 바꿔도 app 707개가 전부 green이었다:
//   (1) `{slot.grade}`            → `{'A'}`                          (배지 글자)
//   (2) `gradeMul(grade)` / `gradeCashMul(grade)` → `...('A')`       (효과 배율)
//   (3) `cardApCost(card.id, slot.grade)` → `cardApCost(card.id, 'A')` (행동력 비용)
// 기존 테스트가 전부 **등급 'A' 한 종류만** 렌더했기 때문이다 — A로 고정하는 뮤테이션은
// A를 보는 테스트에게는 아무 변화가 없다. 단일 값 한 번 확인이 이 결함의 원인이었으므로,
// 여기서는 E·D·C·B·A·S **여섯 등급 전부**를 실제로 렌더해 화면에 도달한 값을 본다.
//
// 기댓값은 CardTile.tsx를 다시 베끼지 않는다 — core의 gradeMul/gradeCashMul/gradeAp와
// 카드 데이터(loadCards)에서 유도하고, 표기 규칙(§3.1 — 소수 첫째 자리·부호 명시,
// 천단위 구분자 + "원")은 이 파일이 독립적으로 다시 적는다(CardTile.tsx의 fmtDelta/
// fmtCash를 import하면 그 함수가 통째로 틀려도 같이 틀려서 통과한다).
describe('등급 6종이 각각 다른 화면으로 도달한다 (최종 리뷰 M1)', () => {
  const overtime = CARDS.find(c => c.id === 'overtime')!
  const cashEffect = overtime.effects.find(e => e.type === 'cash')
  const condEffect = overtime.effects.find(e => e.type === 'condition')
  const analyzeStat = analyze.effects.find(e => e.type === 'stat')

  // 이 스위트의 전제 — 데이터가 바뀌어 전제가 깨지면 조용히 무의미해지지 않고 여기서 터진다.
  it('전제: overtime은 현금 보상 + 컨디션 대가를 가진 행동 카드이고, analyze는 스탯 보상을 가진다', () => {
    expect(cashEffect?.type).toBe('cash')
    expect(condEffect?.type).toBe('condition')
    expect(analyzeStat?.type).toBe('stat')
    expect(overtime.isRecovery).toBe(false)
    expect(GRADES.length).toBe(6)
  })

  // §3.1 표기 규칙을 테스트가 스스로 다시 적는다.
  const round1 = (n: number): number => Math.round(n * 10) / 10
  const signed = (n: number): string => `${round1(n) >= 0 ? '+' : ''}${round1(n).toFixed(1)}`
  const signedWon = (n: number): string => {
    const r = Math.round(n)
    return `${r >= 0 ? '+' : ''}${r.toLocaleString('ko-KR')}원`
  }

  interface Shot {
    badgeText: string
    badgeColor: string
    summary: string
    ap: string
    costs: string
  }

  /** 카드 한 장을 등급 g로 렌더해 **화면에 실제로 그려진 문자열**만 뽑는다. */
  function shoot(cardId: string, g: CardGrade): Shot {
    const { container, unmount } = render(<CardTile slot={{ cardId, grade: g }} />)
    const root = container.querySelector(`[data-testid="slot-card-${cardId}"]`)
    if (!root) throw new Error(`${cardId} 타일이 렌더되지 않았다`)
    const badge = root.querySelector('[data-testid=grade-badge]')
    if (!badge) throw new Error(`${cardId}(${g}) 등급 배지가 없다`)
    const shot: Shot = {
      badgeText: badge.textContent ?? '',
      badgeColor: getComputedStyle(badge).backgroundColor,
      summary: root.querySelector('[data-testid=effect-summary]')?.textContent ?? '',
      ap: root.querySelector('[data-testid=ap-cost]')?.textContent ?? '',
      costs: Array.from(root.querySelectorAll('[data-testid^="cost-"]')).map(n => n.textContent).join(' | '),
    }
    unmount()
    return shot
  }

  const shotsOf = (cardId: string): Map<CardGrade, Shot> =>
    new Map(GRADES.map(g => [g, shoot(cardId, g)]))

  it('배지 글자가 등급마다 그 등급 자신이다 (뮤테이션 1: `{slot.grade}` → `{\'A\'}`)', () => {
    for (const g of GRADES) {
      expect(shoot('overtime', g).badgeText, `등급 ${g}의 배지 글자`).toBe(g)
    }
  })

  it('배지 색 토큰이 등급마다 그 등급 자신을 가리킨다', () => {
    for (const g of GRADES) {
      expect(shoot('overtime', g).badgeColor, `등급 ${g}의 배지 색`).toBe(`var(--grade-${g})`)
    }
  })

  it('현금 보상이 등급마다 gradeCashMul 곡선을 그대로 탄다 (뮤테이션 2: cashMul 고정)', () => {
    if (cashEffect?.type !== 'cash') throw new Error('전제가 깨졌다')
    for (const g of GRADES) {
      const expected = signedWon(cashEffect.delta * gradeCashMul(g))
      expect(shoot('overtime', g).summary, `등급 ${g}의 현금 보상`).toBe(`현금 ${expected}`)
    }
  })

  it('컨디션 대가가 등급마다 gradeMul 곡선을 그대로 탄다 (뮤테이션 2: mul 고정)', () => {
    if (condEffect?.type !== 'condition') throw new Error('전제가 깨졌다')
    for (const g of GRADES) {
      const expected = signed(condEffect.delta * gradeMul(g))
      expect(shoot('overtime', g).costs, `등급 ${g}의 컨디션 대가`).toBe(`컨디션 ${expected}`)
    }
  })

  it('스탯 보상도 등급마다 gradeMul 곡선을 그대로 탄다', () => {
    if (analyzeStat?.type !== 'stat') throw new Error('전제가 깨졌다')
    for (const g of GRADES) {
      const expected = signed(analyzeStat.delta * gradeMul(g))
      expect(shoot('analyze', g).summary, `등급 ${g}의 분석 보상`).toBe(`분석 ${expected}`)
    }
  })

  it('행동력 비용이 등급마다 gradeAp 그대로다 (뮤테이션 3: cardApCost의 등급 인자 고정)', () => {
    for (const g of GRADES) {
      expect(shoot('overtime', g).ap, `등급 ${g}의 행동력 비용`).toBe(`⚡${gradeAp(g)}`)
    }
  })

  // gradeAp는 E1 D1 C2 B2 A3 S3 — 6개가 서로 다를 수 없다(등급 3쌍이 같은 비용을 공유한다).
  // 그래서 "전부 다르다"가 아니라 "상수가 아니다"를 못박는다. 위 테스트가 이미 정확한
  // 값을 보지만, 등급 인자를 상수로 바꾸는 뮤테이션이 정확히 이 성질을 죽인다.
  it('행동력 비용은 등급에 따라 실제로 달라진다 — 최저 등급과 최고 등급이 같지 않다', () => {
    expect(shoot('overtime', 'E').ap).not.toBe(shoot('overtime', 'S').ap)
  })

  it('여섯 등급이 서로 다른 화면을 낸다 — 두 등급이 같은 타일을 그리면 red', () => {
    for (const cardId of ['overtime', 'analyze']) {
      const shots = shotsOf(cardId)
      const signatures = GRADES.map(g => JSON.stringify(shots.get(g)))
      expect(new Set(signatures).size, `${cardId}의 등급별 타일이 중복됐다: ${signatures.join('\n')}`)
        .toBe(GRADES.length)
    }
  })

  // 위 '서로 다르다'만으로는 방향(등급이 오를수록 커진다)까지는 못 본다 — §2.2의
  // 핵심 규칙은 "등급이 오르면 **보상과 대가가 함께** 커진다"이므로 그 단조성을 본다.
  it('등급이 오를수록 보상과 대가가 함께 커진다 (§2.2)', () => {
    if (cashEffect?.type !== 'cash' || condEffect?.type !== 'condition') throw new Error('전제가 깨졌다')
    const num = (s: string): number => Number(s.replace(/[^0-9.-]/g, ''))
    let prevGain = -Infinity
    let prevCost = -Infinity
    for (const g of GRADES) {
      const s = shoot('overtime', g)
      const gain = num(s.summary)   // 현금 보상(양수)
      const cost = -num(s.costs)    // 컨디션 대가의 크기(양수)
      expect(gain, `등급 ${g}의 현금 보상이 이전 등급보다 크지 않다`).toBeGreaterThan(prevGain)
      expect(cost, `등급 ${g}의 컨디션 대가가 이전 등급보다 크지 않다`).toBeGreaterThan(prevCost)
      prevGain = gain
      prevCost = cost
    }
  })
})

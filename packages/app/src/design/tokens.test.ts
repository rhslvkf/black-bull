import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GRADES } from '@bb/core'

const here = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(join(here, 'tokens.css'), 'utf-8')
const indexCssPath = join(here, '../index.css')
const indexCss = readFileSync(indexCssPath, 'utf-8')

/** CSS 주석(`/* ... *\/`)을 제거한다. 주석 안의 문자열이 실제 선언·import로 오인되지
 * 않게 하기 위해서다(리뷰 Minor 1 — `@import`를 주석 처리해도 정규식이 매치했었다). */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** `--name: 값;` 형태의 커스텀 프로퍼티가 실제로 정의돼 있는지 확인한다(문자열만 있고
 * 실제 선언이 없는 경우를 잡기 위해 콜론 뒤 값까지 요구한다). 주석은 제외하고 본다. */
function definesCustomProperty(css: string, name: string): boolean {
  const re = new RegExp(`--${name}\\s*:\\s*[^;]+;`)
  return re.test(stripCssComments(css))
}

interface Rgb { r: number; g: number; b: number }

/**
 * 토큰 이름으로 색을 해석한다. 값이 `var(--other)` 별칭이면 그 대상을 재귀적으로
 * 따라간다 — 별칭이 엉뚱한 토큰을 가리키도록 배선이 틀려도(리뷰 Critical의 짝) 실제
 * 도달하는 hex 값을 보고 판정하기 위해서다.
 */
function resolveColorToken(css: string, name: string, depth = 0): Rgb {
  if (depth > 8) throw new Error(`토큰 별칭이 너무 깊거나 순환 참조한다: --${name}`)
  const clean = stripCssComments(css)
  const m = clean.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))
  if (!m) throw new Error(`--${name} 토큰이 정의되지 않았다`)
  const value = m[1]!.trim()
  const aliasMatch = value.match(/^var\(--([a-zA-Z0-9-]+)\)$/)
  if (aliasMatch) return resolveColorToken(css, aliasMatch[1]!, depth + 1)
  const hexMatch = value.match(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/)
  if (!hexMatch) throw new Error(`--${name} 값이 hex 색이 아니다: ${value}`)
  const hex = hexMatch[1]!
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

describe('디자인 토큰 CSS', () => {
  it('등급색 6종을 core의 GRADES에서 유도해 전부 정의한다', () => {
    // GRADES를 손으로 다시 적지 않는다 — core가 등급 목록의 유일한 출처다.
    // (1차 개발에서 레지스트리가 core 상수를 복제해 두 사본이 어긋난 사고가 있었다.)
    expect(GRADES.length).toBeGreaterThan(0)
    for (const grade of GRADES) {
      expect(definesCustomProperty(tokensCss, `grade-${grade}`)).toBe(true)
    }
  })

  it('등급색 6종은 서로 충분히 구별된다', () => {
    // 단조 밝기 램프 방향은 고정하지 않는다(리뷰 — 향후 튜닝을 과하게 제약하면 안 됨).
    // 대신 실제 위험인 "두 등급이 화면에서 같아 보이는 것"만 막는다. 유클리드 거리
    // (r,g,b 각 채널 차이의 제곱합의 제곱근)가 30 미만이면 어두운 다크 테마 배지에서
    // 육안 구별이 어렵다고 보고 그 값을 최소 문턱으로 잡았다(예: 순수 명도 차이만
    // 15 정도로는 인접 등급이 흐릿하게 겹쳐 보인다 — 30은 색상 자체가 달라야 나오는 값).
    const MIN_DISTANCE = 30
    const colors = GRADES.map(g => resolveColorToken(tokensCss, `grade-${g}`))
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const a = colors[i]!
        const b = colors[j]!
        const dist = Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
        expect(dist).toBeGreaterThanOrEqual(MIN_DISTANCE)
      }
    }
  })

  it('핵심 색 토큰(--bg, --surface, --up, --down, --neutral)을 정의한다', () => {
    for (const name of ['bg', 'surface', 'up', 'down', 'neutral']) {
      expect(definesCustomProperty(tokensCss, name)).toBe(true)
    }
  })

  it('기존 화면이 쓰는 15개 색 토큰 이름을 그대로 유지한다', () => {
    // 이 태스크 전부터 화면 코드가 이 이름들을 참조한다. 이름을 바꾸면서
    // 사용처를 함께 고치지 않으면 화면이 조용히 깨진다 — 이름 존재를 고정한다.
    const legacyNames = [
      'bg', 'panel', 'panel-2', 'border', 'text', 'muted', 'accent',
      'accent-soft', 'gold', 'bull', 'bear', 'danger', 'danger-soft', 'good', 'rumor',
    ]
    for (const name of legacyNames) {
      expect(definesCustomProperty(tokensCss, name)).toBe(true)
    }
  })

  it('간격 8단계를 정의한다', () => {
    for (let i = 1; i <= 8; i++) {
      expect(definesCustomProperty(tokensCss, `space-${i}`)).toBe(true)
    }
  })

  it('타이포 6단계를 정의한다', () => {
    for (let i = 1; i <= 6; i++) {
      expect(definesCustomProperty(tokensCss, `text-${i}`)).toBe(true)
    }
  })

  it('모션 3단계(fast/base/slow)를 정의하고, 갈수록 길어진다', () => {
    for (const name of ['dur-fast', 'dur-base', 'dur-slow']) {
      expect(definesCustomProperty(tokensCss, name)).toBe(true)
    }
    const ms = (name: string): number => {
      const m = stripCssComments(tokensCss).match(new RegExp(`--${name}\\s*:\\s*([\\d.]+)ms`))
      return Number(m?.[1] ?? NaN)
    }
    expect(ms('dur-fast')).toBeLessThan(ms('dur-base'))
    expect(ms('dur-base')).toBeLessThan(ms('dur-slow'))
  })
})

describe('한국 관례 색 — 상승 빨강 / 하락 파랑, 0은 중립', () => {
  // 전역 제약: "상승 빨강 / 하락 파랑(한국 관례), 0은 중립". 값이 우연히 맞는 것과
  // 규칙이 실제로 지켜지는 것은 다르다 — R·B 채널을 직접 비교해 방향을 고정한다.
  // --up/--down은 별칭이므로 별칭 배선이 틀려도(엉뚱한 토큰을 가리켜도) 실제
  // 도달하는 색이 검사되어 함께 잡힌다.

  it('--bull과 --up은 빨강 계열이다(R > B)', () => {
    for (const name of ['bull', 'up']) {
      const c = resolveColorToken(tokensCss, name)
      expect(c.r).toBeGreaterThan(c.b)
    }
  })

  it('--bear와 --down은 파랑 계열이다(B > R)', () => {
    for (const name of ['bear', 'down']) {
      const c = resolveColorToken(tokensCss, name)
      expect(c.b).toBeGreaterThan(c.r)
    }
  })

  it('--neutral은 빨강·파랑 어느 쪽으로도 치우치지 않는다', () => {
    const c = resolveColorToken(tokensCss, 'neutral')
    // 현재 --muted(#8892a0)의 R-B 채널 차이는 24다. 40은 그 값에 여유를 더한
    // 문턱이다 — 이보다 커지면 회색이 아니라 붉은빛·푸른빛으로 치우친 색이 된다.
    expect(Math.abs(c.r - c.b)).toBeLessThanOrEqual(40)
  })
})

describe('CSS가 정의되지 않은 커스텀 프로퍼티를 참조하지 않는다', () => {
  // 리뷰 Minor 4: index.css가 `var(--bad)`처럼 tokens.css에 없는 이름을 참조해도
  // 조용히 무시(상위 상속값 사용)될 뿐 아무 데도 안 걸렸다. 두 CSS 파일에서 쓰이는
  // 모든 var(--x) 참조가 tokens.css에서 실제로 정의된 이름인지 전수 검사한다.
  it('index.css와 tokens.css의 모든 var(--x) 참조는 tokens.css에 정의돼 있다', () => {
    const definedNames = new Set<string>()
    for (const m of stripCssComments(tokensCss).matchAll(/--([a-zA-Z0-9-]+)\s*:/g)) {
      definedNames.add(m[1]!)
    }
    expect(definedNames.size).toBeGreaterThan(0)

    const usedNames = new Set<string>()
    for (const css of [tokensCss, indexCss]) {
      for (const m of stripCssComments(css).matchAll(/var\(\s*--([a-zA-Z0-9-]+)/g)) {
        usedNames.add(m[1]!)
      }
    }
    expect(usedNames.size).toBeGreaterThan(0)

    const undefinedRefs = [...usedNames].filter(name => !definedNames.has(name))
    expect(undefinedRefs).toEqual([])
  })
})

describe('index.css가 토큰 파일을 import한다', () => {
  it('design/tokens.css를 실제로(주석이 아니라) import한다', () => {
    expect(stripCssComments(indexCss)).toMatch(/@import\s+['"].*design\/tokens\.css['"]/)
  })

  it('더 이상 :root 색 토큰을 직접 선언하지 않는다(중복 정의 방지)', () => {
    expect(stripCssComments(indexCss)).not.toMatch(/--bg\s*:\s*#/)
  })
})

/**
 * Fix Round 1 Major 2 — 위 "정의되지 않은 var(--x) 참조 금지" 검사는 반대 방향의 구멍은
 * 못 잡는다: `.ticker-line.rumor { color: var(--rumor) }`를 통째로
 * `.ticker-line.rumor { color: #c893ff }`(hex 하드코딩)로 바꿔도, `--rumor` 토큰
 * 자체는 여전히 tokens.css에 정의돼 있으니 위 검사는 안 걸린다. 여기서는 반대로
 * "이 규칙이 실제로 토큰을 통해 색을 적용하는가"를 직접 본다(Task 13이 등급색에
 * 대해 닫은 구멍과 대칭이지만 방향이 반대다: 그쪽은 "참조하는 이름이 정의됐는가",
 * 이쪽은 "정의된 이름을 실제로 참조하는가").
 */
/**
 * Task 22 §6의 제1 제약: "전부 prefers-reduced-motion을 존중하고 스킵 옵션을 둔다.
 * 156턴을 도는 게임에서 매번 기다리게 하면 짐이 된다." JS가 인라인 style(animation)로
 * 재생 여부를 직접 결정하는 애니메이션(ChoiceSheet·CutsceneView·DialogueBox·App의
 * 탭 슬라이드/가장자리 맥동·StockDetail의 흔들림)은 각자 prefersReducedMotion()을
 * 보지만, 순수 CSS 트랜지션/애니메이션(카드 프레스, 게이지 보간, 행동력 점 소모,
 * 스탯 칩 링, 스톡 행 눌림 등 index.css에 흩어진 것들)은 매 규칙마다 개별
 * `@media (prefers-reduced-motion: reduce)` 예외를 달지 않는 한 reduced-motion을
 * 못 본다. index.css 맨 위에 `*`(전 요소)를 겨냥한 전역 안전망 하나를 두어, 앞으로
 * 추가되는 순수 CSS 애니메이션까지 한 번에 커버한다 — 이 테스트가 그 안전망 자체가
 * 사라지지 않는지 고정한다.
 */
describe('prefers-reduced-motion 전역 안전망 (§6 제1 제약)', () => {
  const clean = stripCssComments(indexCss)

  it('reduced-motion 미디어 쿼리 블록이 index.css에 존재한다', () => {
    expect(clean).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
  })

  it('그 블록이 모든 요소(*)의 animation-duration·transition-duration을 사실상 0으로 만든다', () => {
    const m = clean.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/)
    expect(m, 'reduced-motion 전역 블록을 찾을 수 없다').not.toBeNull()
    const block = m![1]!
    // 전체 요소를 겨냥해야 한다 — 특정 클래스 하나만 좁혀 잡으면 "안전망"이 아니다.
    expect(block).toMatch(/\*[^{]*\{/)
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
  })

  // Fix Round 1 Minor 4(리뷰) — 위 테스트는 duration 두 줄만 보고 이 줄은 따로
  // 확인하지 않아, `animation-iteration-count: 1 !important`를 지워도 안 잡혔다.
  // `infinite` 반복 애니메이션(예: `.gauge-critical .gauge-fill`)이 duration만
  // 0.01ms로 눌려도 여전히 "무한히" 도는 상태로 남을 수 있어, 반복 횟수 자체를
  // 1로 강제하는 이 줄이 별도로 고정돼야 한다.
  it('animation-iteration-count도 1로 강제한다 (Fix Round 1 Minor 4 — 무한 반복 방지)', () => {
    const m = clean.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?)\n\}/)
    expect(m, 'reduced-motion 전역 블록을 찾을 수 없다').not.toBeNull()
    const block = m![1]!
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/)
  })
})

describe('루머 색은 하드코딩이 아니라 --rumor 토큰을 통해 적용된다 (Fix Round 1 Major 2)', () => {
  /** `selector { ... }` 규칙 하나를 그대로 찾아 본문을 돌려준다. 못 찾으면 던진다 —
   *  선택자 자체가 사라지면(리팩터로 이름이 바뀌면) 조용히 통과하는 게 아니라
   *  이 테스트가 먼저 알아채야 한다. */
  function ruleBody(css: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`)
    const m = stripCssComments(css).match(re)
    if (!m) throw new Error(`선택자를 찾을 수 없다: ${selector}`)
    return m[1]!
  }

  it('.ticker-line.rumor는 var(--rumor)로 색을 지정한다', () => {
    expect(ruleBody(indexCss, '.ticker-line.rumor')).toMatch(/color:\s*var\(--rumor\)/)
  })
  it('.news-sheet-list li.rumor는 var(--rumor)로 색을 지정한다', () => {
    expect(ruleBody(indexCss, '.news-sheet-list li.rumor')).toMatch(/color:\s*var\(--rumor\)/)
  })
})

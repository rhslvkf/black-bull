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

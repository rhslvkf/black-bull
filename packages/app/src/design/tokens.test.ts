import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { GRADES } from '@bb/core'

const here = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(join(here, 'tokens.css'), 'utf-8')

/** `--name: 값;` 형태의 커스텀 프로퍼티가 실제로 정의돼 있는지 확인한다(문자열만 있고
 * 실제 선언이 없는 경우를 잡기 위해 콜론 뒤 값까지 요구한다). */
function definesCustomProperty(css: string, name: string): boolean {
  const re = new RegExp(`--${name}\\s*:\\s*[^;]+;`)
  return re.test(css)
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

  it('등급색 6종은 서로 다른 색이다', () => {
    const colors = GRADES.map(grade => {
      const m = tokensCss.match(new RegExp(`--grade-${grade}\\s*:\\s*([^;]+);`))
      return m?.[1]?.trim()
    })
    expect(new Set(colors).size).toBe(GRADES.length)
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
      const m = tokensCss.match(new RegExp(`--${name}\\s*:\\s*([\\d.]+)ms`))
      return Number(m?.[1] ?? NaN)
    }
    expect(ms('dur-fast')).toBeLessThan(ms('dur-base'))
    expect(ms('dur-base')).toBeLessThan(ms('dur-slow'))
  })
})

describe('index.css가 토큰 파일을 import한다', () => {
  const indexCss = readFileSync(join(here, '../index.css'), 'utf-8')

  it('design/tokens.css를 import한다', () => {
    expect(indexCss).toMatch(/@import\s+['"].*design\/tokens\.css['"]/)
  })

  it('더 이상 :root 색 토큰을 직접 선언하지 않는다(중복 정의 방지)', () => {
    expect(indexCss).not.toMatch(/--bg\s*:\s*#/)
  })
})

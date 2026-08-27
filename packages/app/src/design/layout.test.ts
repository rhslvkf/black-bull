import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 홈 화면 세로 예산의 **뼈대**를 고정한다(Task 24).
 *
 * 이 테스트가 막으려는 사고는 실측으로 잡힌 것이다 — 390x844에서 문서 scrollHeight가
 * 954px(뷰포트 +110px)이었고, `position: fixed` 탭바가 '한 주 넘기기' 버튼의 아래
 * 72px과 카드 아래 줄 7px을 덮고 있었다. 원인은 셋이었다:
 *   1) `.app`이 `min-height: 100dvh`라 내용이 길어지면 뷰포트보다 커졌다
 *   2) `.body`가 `min-height: auto`(플렉스 기본)라 `overflow-y: auto`가 죽은 선언이었다
 *   3) 탭바가 흐름 밖(`position: fixed`)이라 레이아웃 계산에 참여하지 않았다
 *
 * **이 테스트가 할 수 있는 일과 없는 일.** jsdom은 외부 CSS를 읽지도, 레이아웃을
 * 계산하지도 않는다 — 그래서 여기서는 CSS **소스**를 읽어 그 세 줄이 그대로 있는지만
 * 본다. 실제로 화면이 한 장에 들어가는지는 이 테스트가 증명하지 못한다(그 증거는
 * Task 24 보고서의 브라우저 실측이다: 954px -> 844px, 겹침 -72px -> 여유 +12px).
 * 즉 이건 "고친 메커니즘이 조용히 되돌아가는 것"을 막는 잠금장치이지, 레이아웃
 * 검증이 아니다. 그 한계를 알고 읽어야 한다.
 */
const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '../index.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')

/** 선택자가 정확히 일치하는 규칙 블록의 선언부를 돌려준다(주석은 이미 제거돼 있다). */
function ruleBody(selector: string): string {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sels = m[1]!.split(',').map(x => x.trim().replace(/\s+/g, ' '))
    if (sels.includes(selector)) return m[2]!
  }
  throw new Error(`CSS에 '${selector}' 규칙이 없다`)
}
/** 선언 하나를 값으로 읽는다. 없으면 null. */
function decl(selector: string, prop: string): string | null {
  const m = ruleBody(selector).match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))
  return m ? m[1]!.trim() : null
}

describe('앱 셸 세로 예산의 뼈대', () => {
  it('.app은 뷰포트 한 장 높이로 고정된다 (min-height가 아니라 height)', () => {
    expect(decl('.app', 'height')).toBe('100dvh')
    // min-height: 100dvh로 되돌리면 내용이 길어질 때 다시 문서가 늘어난다.
    expect(decl('.app', 'min-height')).toBeNull()
  })

  it('.body는 min-height: 0이라 실제로 내부 스크롤이 동작한다', () => {
    expect(decl('.body', 'overflow-y')).toBe('auto')
    // 이 한 줄이 빠지면 overflow-y 선언이 죽고 `.app`이 다시 밀려난다.
    expect(decl('.body', 'min-height')).toBe('0')
  })

  it('탭바는 흐름 안에 있다 — 고정 배치로 되돌리면 다시 버튼을 덮는다', () => {
    expect(decl('.tabbar', 'position')).toBeNull()
    expect(css).not.toMatch(/\.tabbar\s*\{[^}]*position:\s*fixed/)
  })

  it('홈에서 줄어드는 창구는 캐릭터 스테이지 하나뿐이다', () => {
    // 자식 전부 flex-shrink 0 → 조작부(카드·버튼·행동력)가 찌그러지지 않는다.
    expect(decl('.screen.home > *', 'flex')).toBe('0 0 auto')
    // 스테이지만 줄어들 수 있고, 하한이 있다.
    const stage = decl('.screen.home > .char-stage', 'flex')
    expect(stage).not.toBeNull()
    expect(stage!.split(/\s+/)[1]).toBe('1')      // flex-shrink = 1
    expect(decl('.screen.home > .char-stage', 'min-height')).toBeTruthy()
  })
})

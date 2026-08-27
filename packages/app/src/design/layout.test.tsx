import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, screen } from '@testing-library/react'
import { useGame } from '../store/store'
import App from '../App'

/**
 * 홈 화면 세로 예산의 **뼈대**를 고정한다.
 *
 * ### 왜 런타임 검사인가 (Fix Round 1)
 * Round 1 이전 버전은 `index.css`를 **문자열로 읽어** 선언이 그대로 있는지만 봤다.
 * 리뷰어가 뮤테이션 둘로 그 한계를 실증했다:
 *   - MU5: `.char-stage`의 `flex: 0 1 auto` → `1 1 auto` (flex-grow만 켠다).
 *     `flex-shrink`만 보던 검사는 통과했고, 실측 스테이지가 274px로 §3.1 예산 260을 넘겼다.
 *   - MU6: `.home-scroll > .card-list { flex: 1 1 auto }`처럼 **더 구체적인 선택자로
 *     덮어쓴다.** `.home-scroll > *` 선언 문자열은 그대로라 검사는 통과했고,
 *     흡수 창구가 둘이 되어 스테이지가 244px로 줄었다.
 * 둘 다 "선언이 파일에 있는가"로는 잡히지 않는다 — 실제로 요소에 **적용된 값**을 봐야 한다.
 *
 * 그런데 jsdom의 `getComputedStyle`에 그냥 기댈 수는 없다. **jsdom의 캐스케이드는
 * 구체성을 무시하고 소스 순서만 본다** — 실측으로 확인했다: `.p > .x { flex: 1 1 auto }`가
 * 앞에 있고 `.x { flex: 0 0 auto }`가 뒤에 있으면 브라우저는 1을 주지만 jsdom은 0을 준다.
 * MU6이 정확히 그 형태라 jsdom 계산값만 보는 검사는 **뮤테이션을 통과시켰다**(실측).
 * 그래서 flex에 대해서는 캐스케이드를 이 파일이 직접 푼다(`resolveFlex`):
 * 렌더된 요소에 `Element.matches()`로 규칙을 맞춰 보고, 구체성 → 소스 순서로 이긴 선언을
 * 고르며, 인라인 style은 항상 이긴다(이 저장소가 두 번 밟은 "인라인 우회"도 함께 막힌다).
 *
 * ### 이 검사가 할 수 있는 일과 없는 일
 * jsdom은 **레이아웃을 계산하지 않는다** — 높이·겹침·"버튼이 화면 안에 있는가"는
 * 여기서 증명되지 않는다. 그 증거는 보고서의 브라우저 실측이다(390×844에서 156턴
 * 전부 `한 주 넘기기`의 `getBoundingClientRect().bottom <= innerHeight`).
 * 이 파일이 지키는 것은 **그 실측을 성립하게 만든 구조**다: 조작부가 스크롤 밖에
 * 있다는 것, 스크롤 영역에서 자라는 자식이 없다는 것, 줄어드는 자식이 스테이지
 * 하나뿐이라는 것.
 *
 * (Round 1 이전 보고서는 `document.documentElement.scrollHeight`를 근거로 삼았는데,
 *  `.app { height: 100dvh; overflow: hidden }` 아래에서 그 값은 뷰포트를 넘을 수가
 *  없다 — 항상 참인 지표라 아무것도 증명하지 못했다. 지표를 바꾼 이유가 그것이다.)
 */
const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, p), 'utf-8')
// index.css는 tokens.css를 @import한다. jsdom은 @import를 따라가지 않으므로 직접 이어붙인다
// (토큰 값 자체는 이 검사와 무관하지만, 빠뜨리면 var() 참조가 있는 선언이 통째로 무시될 수 있다).
const CSS = read('./tokens.css') + '\n' + read('../index.css').replace(/@import[^;]+;/g, '')

let styleEl: HTMLStyleElement

beforeAll(() => {
  styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
})
afterAll(() => { styleEl.remove() })

beforeEach(() => {
  cleanup()
  localStorage.clear()
  useGame.getState().reset()
  useGame.getState().newGame(1)
  // 프롤로그 오버레이는 홈 구조와 무관하므로 건너뛴다.
  useGame.getState().finishPrologue()
  render(<App />)
})

/** 선택자 하나의 구체성 (a, b, c). 이 저장소의 선택자는 전부 클래스·자식결합자·`*`
 *  수준이라 이 근사로 충분하다 — id는 쓰지 않고, 의사클래스도 `:not(.home)`·`:disabled`
 *  정도다. 더 복잡한 선택자가 들어오면 이 근사가 틀릴 수 있다는 점은 알고 쓴다. */
function specificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length
  const types = (selector.replace(/\.[\w-]+|\[[^\]]+\]|:{1,2}[\w-]+/g, '').match(/[a-zA-Z][\w-]*/g) ?? []).length
  return ids * 10000 + classes * 100 + types
}

interface FlexValue { grow: number; shrink: number }
/** 규칙 하나가 선언한 flex-grow/shrink. `flex` 단축도 편다. */
function declaredFlex(style: CSSStyleDeclaration): Partial<FlexValue> {
  const out: Partial<FlexValue> = {}
  const short = style.getPropertyValue('flex').trim()
  if (short !== '') {
    const parts = short.split(/\s+/)
    if (parts[0] !== undefined && parts[0] !== 'none') out.grow = Number(parts[0])
    if (parts[1] !== undefined && !parts[1].includes('%') && !/[a-z]/.test(parts[1])) out.shrink = Number(parts[1])
    else if (parts.length === 1) out.shrink = 1                    // `flex: 1` === `1 1 0%`
    if (short === 'none') { out.grow = 0; out.shrink = 0 }
  }
  const g = style.getPropertyValue('flex-grow').trim()
  if (g !== '') out.grow = Number(g)
  const sh = style.getPropertyValue('flex-shrink').trim()
  if (sh !== '') out.shrink = Number(sh)
  return out
}

/** 주입한 스타일시트의 최상위 스타일 규칙 목록 (@media·@keyframes 안은 아래에서 따로 본다). */
function topLevelRules(): CSSStyleRule[] {
  const sheet = styleEl.sheet
  if (sheet === null) throw new Error('주입한 스타일시트를 읽지 못했다')
  const out: CSSStyleRule[] = []
  for (const rule of [...sheet.cssRules]) if (rule instanceof CSSStyleRule) out.push(rule)
  return out
}

/**
 * 요소에 **실제로 적용되는** flex-grow / flex-shrink. 캐스케이드를 직접 푼다:
 * 인라인 style > (구체성, 소스 순서)로 이긴 규칙 > 초기값(grow 0 / shrink 1).
 */
function flexOf(el: Element): FlexValue {
  const result: FlexValue = { grow: 0, shrink: 1 }
  const winners: { spec: number; order: number; decl: Partial<FlexValue> }[] = []
  topLevelRules().forEach((rule, order) => {
    for (const sel of rule.selectorText.split(',').map(x => x.trim())) {
      if (sel === '' || !el.matches(sel)) continue
      const decl = declaredFlex(rule.style)
      if (decl.grow !== undefined || decl.shrink !== undefined) {
        winners.push({ spec: specificity(sel), order, decl })
      }
    }
  })
  winners.sort((a, b) => a.spec - b.spec || a.order - b.order)
  for (const w of winners) Object.assign(result, w.decl)
  // 인라인 style은 어떤 규칙보다도 이긴다.
  if (el instanceof HTMLElement) Object.assign(result, declaredFlex(el.style))
  return result
}
const label = (el: Element) => `${el.tagName.toLowerCase()}.${el.className || '(무클래스)'}`
/** jsdom은 `min-height: 0`을 '0'으로, `min-height: 170px`를 '170px'로 돌려준다 —
 *  단위 유무에 흔들리지 않게 숫자로 읽는다. */
const px = (v: string) => Number.parseFloat(v)

describe('앱 셸 세로 예산의 뼈대', () => {
  it('.app은 뷰포트 한 장 높이로 고정된다 (min-height가 아니라 height)', () => {
    const app = screen.getByTestId('app-root')
    const cs = getComputedStyle(app)
    expect(cs.height).toBe('100dvh')
    // min-height: 100dvh로 되돌리면 내용이 길어질 때 다시 문서가 늘어난다.
    expect(cs.minHeight === '' || cs.minHeight === 'auto' || cs.minHeight === '0px').toBe(true)
  })

  it('.body는 min-height: 0이라 실제로 내부 스크롤이 동작한다', () => {
    const body = screen.getByTestId('tab-body')
    const cs = getComputedStyle(body)
    expect(cs.overflowY).toBe('auto')
    // 이 한 줄이 빠지면(플렉스 기본값 auto) overflow 선언이 죽고 `.app`이 다시 밀려난다.
    expect(px(cs.minHeight)).toBe(0)
  })

  it('탭바는 흐름 안에 있다 — 고정 배치로 되돌리면 다시 버튼을 덮는다', () => {
    const tabbar = document.querySelector('.tabbar')
    expect(tabbar).not.toBeNull()
    expect(getComputedStyle(tabbar!).position).not.toBe('fixed')
  })
})

describe('홈 세로 예산 — 주 조작부는 스크롤 밖에 있다 (Fix Round 1)', () => {
  it("'한 주 넘기기'는 스크롤 영역 안에 있지 않다", () => {
    const scroll = screen.getByTestId('home-scroll')
    const button = screen.getByTestId('next-turn')
    // 스크롤 컨테이너 안에 있으면 내용이 길어질 때 화면 밖으로 밀려난다 —
    // 리뷰어 실측으로 156턴 중 13턴에서 실제로 그랬다(최악 −56px).
    expect(scroll.contains(button)).toBe(false)
    expect(screen.getByTestId('home-actions').contains(button)).toBe(true)
  })

  it('조작부는 홈의 직계 자식이고 자라지도 줄지도 않는다', () => {
    const home = document.querySelector('.screen.home')
    const actions = screen.getByTestId('home-actions')
    expect(actions.parentElement).toBe(home)
    expect(flexOf(actions)).toEqual({ grow: 0, shrink: 0 })
    // 버튼 자신도 찌그러지지 않는다.
    expect(flexOf(screen.getByTestId('next-turn')).shrink).toBe(0)
  })

  it('스크롤 영역만 남은 세로를 차지한다', () => {
    const scroll = screen.getByTestId('home-scroll')
    const cs = getComputedStyle(scroll)
    expect(Number(cs.flexGrow)).toBeGreaterThan(0)
    expect(px(cs.minHeight)).toBe(0)
    expect(cs.overflowY).toBe('auto')
  })
})

describe('flex 캐스케이드 해석기 자체가 동작한다 (위 검사들의 전제)', () => {
  // 해석기가 늘 초기값만 돌려주면 아래 두 검사가 통째로 공허해진다 — 실제로 규칙을
  // 읽고 있다는 것과, **구체성이 소스 순서를 이긴다**는 것을 여기서 못박는다.
  it('스크롤 영역과 스테이지의 값을 규칙에서 실제로 읽어낸다', () => {
    expect(flexOf(screen.getByTestId('home-scroll'))).toEqual({ grow: 1, shrink: 1 })
    expect(flexOf(screen.getByTestId('char-stage'))).toEqual({ grow: 0, shrink: 1 })
  })

  it('나중에 나오는 낮은 구체성 규칙이 앞선 높은 구체성 규칙을 이기지 못한다', () => {
    const probe = document.createElement('style')
    probe.textContent = '.zz-a > .zz-b { flex: 1 1 auto; } .zz-b { flex: 0 0 auto; }'
    document.head.appendChild(probe)
    const parent = document.createElement('div'); parent.className = 'zz-a'
    const child = document.createElement('div'); child.className = 'zz-b'
    parent.append(child); document.body.append(parent)
    // jsdom의 getComputedStyle은 여기서 0을 준다(구체성 무시). 우리 해석기는 1을 줘야 한다.
    const sheet = probe.sheet
    if (sheet === null) throw new Error('probe 스타일시트를 읽지 못했다')
    const rules = [...sheet.cssRules].filter((r): r is CSSStyleRule => r instanceof CSSStyleRule)
    const cands = rules
      .map((r, order) => ({ spec: specificity(r.selectorText), order, decl: declaredFlex(r.style), sel: r.selectorText }))
      .filter(c => child.matches(c.sel))
      .sort((a, b) => a.spec - b.spec || a.order - b.order)
    expect(cands[cands.length - 1]!.decl.grow).toBe(1)
    probe.remove(); parent.remove()
  })
})

describe('홈 스크롤 영역 — 흡수 창구는 캐릭터 스테이지 하나뿐이다', () => {
  /** 스크롤 영역의 직계 자식 전부. 선언이 아니라 **적용된 값**을 훑는다. */
  const children = () => [...screen.getByTestId('home-scroll').children]

  it('자식이 실제로 여럿 렌더돼 있다 (빈 배열에 대고 도는 공허한 검사 방지)', () => {
    expect(children().length).toBeGreaterThan(4)
  })

  it('자라는 자식이 하나도 없다 — 하나라도 자라면 스테이지 260px 상한이 깨진다 (MU5)', () => {
    const growing = children().filter(el => flexOf(el).grow > 0).map(label)
    expect(growing).toEqual([])
  })

  it('줄어드는 자식은 캐릭터 스테이지 정확히 하나다 (MU6)', () => {
    const shrinking = children().filter(el => flexOf(el).shrink > 0)
    expect(shrinking.map(label)).toHaveLength(1)
    expect(shrinking[0]!.getAttribute('data-testid')).toBe('char-stage')
  })

  it('스테이지에는 하한이 있다 — 무한정 줄어들면 인물이 사라진다', () => {
    const minH = getComputedStyle(screen.getByTestId('char-stage')).minHeight
    expect(minH).toMatch(/^\d+px$/)
    expect(px(minH)).toBeGreaterThan(0)
  })
})

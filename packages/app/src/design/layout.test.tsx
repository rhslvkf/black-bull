import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, cleanup, screen } from '@testing-library/react'
import { useGame } from '../store/store'
import App from '../App'
import { CHARACTER_STAGE_HEIGHT_PX } from '../components/CharacterStage'

/**
 * 홈 화면 세로 예산의 **뼈대**를 고정한다 — 두 겹으로.
 *
 * ### 왜 두 겹인가 (Fix Round 2, Ruling 32)
 * 이 파일은 세 번 다시 쓰였고 그때마다 같은 이유로 뚫렸다.
 *
 * 1. **CSS 소스 문자열 검사** (Round 0) — 선언이 파일에 있는지만 봤다.
 *    더 구체적인 선택자로 덮어쓰면(MU6) 통과했다.
 * 2. **캐스케이드 해석기** (Round 1) — 규칙을 요소에 맞춰 보고 구체성·순서로 이긴
 *    선언을 골랐다. 캐스케이드를 **풀려고 했기 때문에** 캐스케이드의 규칙 수만큼
 *    구멍이 생겼다: `!important`(MU-X-B), `@media`(MU-X-C), 인라인 우선순위.
 *    게다가 해석기의 정확성을 검사하던 케이스가 해석기를 호출하지 않고 정렬 로직을
 *    복사해 검사해서 **자기충족**이었다 — 해석기에서 인라인 우선순위를 지워도 green.
 *
 * 그래서 캐스케이드를 **풀지 않는다.** 대신 성질이 다른 두 겹을 맞댄다:
 *
 * **(a) 전수 훑기** — `index.css`의 **모든 규칙**을(미디어 쿼리 안이든 `!important`든
 * 구체성이 어떻든) 훑어, 문제가 되는 선언이 **존재하기만 해도** 실패한다.
 * 어느 규칙이 이기는지 따지지 않으므로 캐스케이드 규칙을 흉내 낼 필요가 없다.
 * 대가는 과잉 차단이다 — 나중에 미디어 쿼리로 홈 레이아웃을 진짜 바꾸고 싶으면
 * 여기 예외를 명시적으로 등록해야 한다. 조용히 뚫리는 것보다 낫다는 판단이다.
 *
 * **(b) 런타임** — 렌더된 DOM에서 인라인 style 우회(소스에는 없는 값)를 잡는다.
 * 소스 훑기가 못 보는 유일한 통로가 그것이다.
 *
 * ### 이 파일이 증명하지 못하는 것
 * jsdom은 **레이아웃을 계산하지 않는다** — 높이·겹침·"버튼이 화면 안에 있는가"는
 * 여기서 증명되지 않는다. 그 증거는 `scripts/layout-audit.mjs`(실브라우저 156턴 감사)와
 * 보고서의 실측표다. 이 파일이 지키는 것은 **그 실측을 성립하게 만든 구조**다.
 */

// ─────────────────────────────── CSS 원문 ───────────────────────────────
const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFileSync(join(here, p), 'utf-8')
const RAW_CSS = read('../index.css')
// jsdom은 @import를 따라가지 않으므로 토큰 파일을 직접 이어붙인다(런타임 겹 전용).
const CSS_FOR_DOM = read('./tokens.css') + '\n' + RAW_CSS.replace(/@import[^;]+;/g, '')

interface CssRule {
  /** 선택자 목록 원문. */
  selectorText: string
  /** 선언 이름 → 값(우선순위 표시는 값에 남는다 — 존재만 보므로 그대로 둔다). */
  decls: Map<string, string>
  /** 이 규칙을 감싼 at-rule 조건들(`@media …`). 보고 메시지에만 쓴다. */
  context: string[]
}

/**
 * `index.css`의 **모든** 스타일 규칙을 뽑는다 — `@media` 같은 조건부 블록 **안쪽까지**.
 *
 * jsdom의 CSSOM에 기대지 않고 직접 훑는 이유: 이 겹의 목적이 "파서가 무엇을 살려두었나"와
 * 무관하게 **원문에 그런 선언이 있는가**를 보는 것이기 때문이다. 파서가 조용히 버리는
 * 규칙이 하나라도 있으면 그게 곧 사각지대가 된다.
 */
function parseAllRules(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: CssRule[] = []
  const walk = (text: string, context: string[]): void => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open === -1) break
      // 중괄호 균형을 맞춰 블록 끝을 찾는다(중첩 at-rule 대응).
      let depth = 1
      let j = open + 1
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++
        else if (text[j] === '}') depth--
        j++
      }
      const prelude = text.slice(i, open).trim()
      const body = text.slice(open + 1, j - 1)
      if (prelude.startsWith('@')) {
        // @media·@supports 등 조건부 블록은 안쪽을 이어서 훑는다.
        // @keyframes는 선택자가 아니라 키프레임 선택자(0%, from…)라 건너뛴다.
        if (!prelude.startsWith('@keyframes') && !prelude.startsWith('@font-face')) {
          walk(body, [...context, prelude])
        }
      } else if (prelude !== '') {
        const decls = new Map<string, string>()
        for (const part of body.split(';')) {
          const c = part.indexOf(':')
          if (c === -1) continue
          const name = part.slice(0, c).trim().toLowerCase()
          const value = part.slice(c + 1).trim()
          if (name !== '' && value !== '') decls.set(name, value)
        }
        out.push({ selectorText: prelude, decls, context })
      }
      i = j
    }
  }
  walk(src, [])
  return out
}

const ALL_RULES = parseAllRules(RAW_CSS)

/**
 * `flex` 축약/개별 선언이 지정하는 flex-grow. 지정하지 않으면 null.
 *
 * **해석할 수 없는 값(`var(--x)`, `calc(...)` 등)은 `Infinity`를 돌려준다** — 즉
 * 위반으로 친다. "모르겠으니 통과"는 이 파일이 세 번 뚫린 이유 그 자체다:
 * `flex: var(--g) 1 auto`는 브라우저에선 실제로 자라는데 정적 검사로는 값을 알 수 없다.
 * 과잉 차단이 이 겹의 설계 방향이므로, 정말 필요하면 여기 예외를 명시적으로 등록한다.
 */
function declaredGrow(decls: Map<string, string>): number | null {
  const unresolvable = (v: string) => /var\(|calc\(|env\(|attr\(/i.test(v)
  const grow = decls.get('flex-grow')
  if (grow !== undefined) return unresolvable(grow) ? Infinity : Number.parseFloat(grow)
  const short = decls.get('flex')
  if (short === undefined) return null
  const v = short.replace(/!important/i, '').trim()
  if (unresolvable(v)) return Infinity
  if (v === 'none') return 0
  if (v === 'auto') return 1            // auto === 1 1 auto
  if (v === 'initial') return 0         // initial === 0 1 auto
  const first = v.split(/\s+/)[0]
  const n = first === undefined ? Number.NaN : Number.parseFloat(first)
  return Number.isNaN(n) ? null : n
}

/** px 단위 min-height 선언. 없거나 px가 아니면 null. */
function declaredMinHeightPx(decls: Map<string, string>): number | null {
  const v = decls.get('min-height')
  if (v === undefined) return null
  const cleaned = v.replace(/!important/i, '').trim()
  if (cleaned === '0') return 0
  const m = cleaned.match(/^(-?[\d.]+)px$/)
  return m === null ? null : Number.parseFloat(m[1]!)
}

/** 상태 의사클래스·의사요소·`:not()`을 걷어낸 "기본형" 선택자.
 *  걷어내면 매칭이 넓어져 **과잉 차단**하는 쪽으로 틀린다 — 이 겹이 원하는 방향이다
 *  (`.card:hover { flex: 1 1 auto }` 같은 상태 한정 우회도 존재만으로 걸린다). */
function baseSelector(sel: string): string {
  return sel
    .replace(/::[\w-]+(\([^)]*\))?/g, '')
    .replace(/:not\([^)]*\)/g, '')
    .replace(/:[\w-]+(\([^)]*\))?/g, '')
    .trim()
}

/** 이 규칙이 el에 (조건이 맞는다면) 적용될 수 있는가. 캐스케이드는 따지지 않는다. */
function couldApplyTo(rule: CssRule, el: Element): boolean {
  return rule.selectorText.split(',').some(raw => {
    const sel = baseSelector(raw)
    if (sel === '') return false
    try { return el.matches(sel) } catch {
      // 파싱조차 안 되는 선택자가 문제 선언을 들고 있으면 조용히 넘기지 않는다.
      throw new Error(`선택자를 해석할 수 없다: "${raw}" (규칙: ${rule.selectorText})`)
    }
  })
}

const where = (r: CssRule) => (r.context.length > 0 ? `${r.context.join(' / ')} { ${r.selectorText} }` : r.selectorText)

// ─────────────────────────────── 렌더 ───────────────────────────────
let styleEl: HTMLStyleElement

beforeAll(() => {
  styleEl = document.createElement('style')
  styleEl.textContent = CSS_FOR_DOM
  document.head.appendChild(styleEl)
})
afterAll(() => { styleEl.remove() })

beforeEach(() => {
  cleanup()
  localStorage.clear()
  useGame.getState().reset()
  useGame.getState().newGame(1)
  useGame.getState().finishPrologue()   // 프롤로그 오버레이는 홈 구조와 무관하다
  render(<App />)
})

const scrollChildren = () => [...screen.getByTestId('home-scroll').children]
const label = (el: Element) => `${el.tagName.toLowerCase()}.${el.className || '(무클래스)'}`
/** jsdom은 `min-height: 0`을 '0'으로, `170px`를 '170px'로 돌려준다. */
const px = (v: string) => Number.parseFloat(v)

describe('전수 훑기의 전제 — 파서가 실제로 규칙을 읽고 있다', () => {
  it('index.css에서 충분히 많은 규칙을 뽑았다 (빈 배열에 대고 도는 공허한 검사 방지)', () => {
    expect(ALL_RULES.length).toBeGreaterThan(100)
  })
  it('@media 안쪽 규칙도 함께 뽑는다 — 미디어에 숨기는 우회를 보려면 필수다', () => {
    const inMedia = ALL_RULES.filter(r => r.context.length > 0)
    expect(inMedia.length).toBeGreaterThan(0)
    expect(inMedia.every(r => r.context.every(c => c.startsWith('@')))).toBe(true)
  })
  it('@keyframes의 `from`/`to`를 선택자로 오인하지 않는다', () => {
    expect(ALL_RULES.some(r => /^(from|to|\d+%)$/.test(r.selectorText.trim()))).toBe(false)
  })
})

describe('앱 셸 세로 예산의 뼈대', () => {
  it('.app은 뷰포트 한 장 높이로 고정된다 (min-height가 아니라 height)', () => {
    const cs = getComputedStyle(screen.getByTestId('app-root'))
    expect(cs.height).toBe('100dvh')
    expect(cs.minHeight === '' || cs.minHeight === 'auto' || px(cs.minHeight) === 0).toBe(true)
  })

  it('.body는 내부 스크롤 컨테이너다', () => {
    expect(getComputedStyle(screen.getByTestId('tab-body')).overflowY).toBe('auto')
  })

  it('탭바는 흐름 안에 있다 — 고정 배치로 되돌리면 다시 버튼을 덮는다', () => {
    const tabbar = document.querySelector('.tabbar')
    expect(tabbar).not.toBeNull()
    expect(getComputedStyle(tabbar!).position).not.toBe('fixed')
    // 소스 어디에도(미디어 안 포함) 탭바를 fixed로 만드는 선언이 없어야 한다.
    const fixedRules = ALL_RULES.filter(r => r.decls.get('position')?.includes('fixed') === true)
      .filter(r => couldApplyTo(r, tabbar!)).map(where)
    expect(fixedRules).toEqual([])
  })
})

/**
 * ### 축소 사슬 (Fix Round 2 Major 1, Ruling 33)
 * `.app`(100dvh) → `.body` → `.screen.home` → `.home-scroll`로 이어지는 사슬의 각 노드가
 * **내용보다 작아질 수 있어야** 스크롤이 안쪽에서 일어나고 조작부가 제자리에 남는다.
 * 플렉스 아이템의 자동 최소 크기(min-height: auto)는 내용 크기라, 한 노드라도
 * `min-height: 0`이 아니면 그 노드가 내용만큼 부풀어 아래 형제를 밀어낸다.
 *
 * 재리뷰어의 MU-X-A(`.screen.home`의 `min-height: 0` 삭제)가 정확히 그것이고,
 * 원 Critical이 그대로 재발했다(화면밖 12·탭바겹침 104·최악 −67px). 그런데 1,140개가
 * 전부 green이었다 — **고침을 지탱하는 한 줄이 어떤 장부에도 없었다.**
 *
 * `.body`와 `.home-scroll`은 `overflow-y: auto`라 자동 최소 크기가 이미 0이므로
 * 엄밀히는 `min-height: 0`이 없어도 동작한다(하중을 지는 노드는 `.screen.home` 하나다).
 * 그래도 **사슬 전체에 명시적으로 요구**한다: 어느 노드의 overflow가 나중에 바뀌면
 * 그 즉시 하중을 지는 노드가 되기 때문이다. 방어를 한 노드에만 두지 않는다.
 */
describe('축소 사슬 — 각 노드가 내용보다 작아질 수 있다 (Ruling 33)', () => {
  const chain = (): { name: string; el: Element }[] => [
    { name: '.body', el: screen.getByTestId('tab-body') },
    { name: '.screen.home', el: document.querySelector('.screen.home')! },
    { name: '.home-scroll', el: screen.getByTestId('home-scroll') },
  ]

  it('사슬 노드가 실제로 렌더돼 있고 부모-자식으로 이어져 있다', () => {
    const [body, home, scroll] = chain()
    expect(body!.el.contains(home!.el)).toBe(true)
    expect(home!.el.contains(scroll!.el)).toBe(true)
    expect(scroll!.el.parentElement).toBe(home!.el)
  })

  it('사슬의 모든 노드가 min-height: 0을 **실제로 갖는다** (런타임)', () => {
    // `|| '0'` 같은 폴백을 두면 **선언이 아예 없는 경우**(MU-X-A: 그 한 줄을 지운다)가
    // 0으로 읽혀 통과해버린다 — 실제로 그렇게 뚫렸다. 빈 문자열은 '없음'이지 0이 아니다.
    const bad = chain().filter(({ el }) => {
      const v = getComputedStyle(el).minHeight
      return v === '' || v === 'auto' || px(v) !== 0
    }).map(({ name }) => name)
    expect(bad).toEqual([])
  })

  it('소스에 사슬 노드마다 min-height: 0 선언이 실제로 있다 (전수 훑기)', () => {
    // 삭제형 뮤테이션(MU-X-A)은 "0이 아닌 선언이 없다"로는 절대 잡히지 않는다 —
    // 선언 자체가 사라지기 때문이다. **있어야 한다**를 따로 요구한다.
    const missing = chain().filter(({ el }) =>
      !ALL_RULES.some(r => declaredMinHeightPx(r.decls) === 0 && couldApplyTo(r, el))
    ).map(({ name }) => name)
    expect(missing).toEqual([])
  })

  it('소스 어디에서도 사슬 노드에 0이 아닌 min-height를 주지 않는다 (전수 훑기)', () => {
    const violations: string[] = []
    for (const { name, el } of chain()) {
      for (const rule of ALL_RULES) {
        if (!rule.decls.has('min-height')) continue
        if (!couldApplyTo(rule, el)) continue
        const v = declaredMinHeightPx(rule.decls)
        if (v !== 0) violations.push(`${name} ← ${where(rule)} { min-height: ${rule.decls.get('min-height')} }`)
      }
    }
    expect(violations).toEqual([])
  })

  it('인라인 style로 사슬 노드의 min-height를 되돌리지 않는다 (런타임)', () => {
    const bad = chain().filter(({ el }) => el instanceof HTMLElement && el.style.minHeight !== '' && px(el.style.minHeight) !== 0)
      .map(({ name }) => name)
    expect(bad).toEqual([])
  })
})

describe('주 조작부는 스크롤 밖에 있다', () => {
  it("'한 주 넘기기'는 스크롤 영역 안에 있지 않다", () => {
    const scroll = screen.getByTestId('home-scroll')
    const button = screen.getByTestId('next-turn')
    expect(scroll.contains(button)).toBe(false)
    expect(screen.getByTestId('home-actions').contains(button)).toBe(true)
  })

  it('조작부는 홈의 직계 자식이고 스크롤 영역의 형제다', () => {
    const home = document.querySelector('.screen.home')
    const actions = screen.getByTestId('home-actions')
    expect(actions.parentElement).toBe(home)
    expect(screen.getByTestId('home-scroll').parentElement).toBe(home)
  })

  it('스크롤 영역이 실제로 스크롤 컨테이너다 — overflow를 잃으면 내용이 조작부를 덮는다', () => {
    const scroll = screen.getByTestId('home-scroll')
    expect(getComputedStyle(scroll).overflowY).toBe('auto')
    // 삭제형 뮤테이션 대비 — 선언이 실제로 있어야 한다.
    expect(ALL_RULES.some(r => r.decls.get('overflow-y')?.includes('auto') === true && couldApplyTo(r, scroll))).toBe(true)
    // 어디서도 visible로 되돌리지 않는다(@media 포함).
    const undone = ALL_RULES.filter(r => {
      const v = r.decls.get('overflow-y') ?? r.decls.get('overflow')
      return v !== undefined && v.includes('visible')
    }).filter(r => couldApplyTo(r, scroll)).map(where)
    expect(undone).toEqual([])
  })

  it('조작부는 흐름 안에 남는다 — absolute/fixed로 빼내면 아무 데나 갈 수 있다', () => {
    for (const el of [screen.getByTestId('home-actions'), screen.getByTestId('next-turn')]) {
      expect(['static', 'relative', ''], label(el)).toContain(getComputedStyle(el).position)
      const outOfFlow = ALL_RULES.filter(r => /absolute|fixed/.test(r.decls.get('position') ?? ''))
        .filter(r => couldApplyTo(r, el)).map(where)
      expect(outOfFlow, label(el)).toEqual([])
      if (el instanceof HTMLElement) expect(el.style.position === '' || el.style.position === 'static').toBe(true)
    }
  })

  it('조작부와 버튼은 찌그러지지 않는다 (소스·인라인 양쪽)', () => {
    const targets = [screen.getByTestId('home-actions'), screen.getByTestId('next-turn')]
    for (const el of targets) {
      // **선언으로 먼저 거르고** 그 다음에 매칭한다 — 무관한 규칙의 선택자까지
      // 해석하려다 실패하는 일을 줄인다.
      const shrinkRules = ALL_RULES.filter(r => {
        const s = r.decls.get('flex-shrink') ?? r.decls.get('flex')?.replace(/!important/i, '').trim().split(/\s+/)[1]
        return s !== undefined && Number.parseFloat(s) > 0
      }).filter(r => couldApplyTo(r, el)).map(where)
      expect(shrinkRules, label(el)).toEqual([])
      if (el instanceof HTMLElement) expect(el.style.flexShrink === '' || el.style.flexShrink === '0').toBe(true)
    }
  })
})

/**
 * ### 성장 창구 (Fix Round 2 Major 2, Ruling 32)
 * 스크롤 영역의 자식 중 **하나라도 자라면** 캐릭터 스테이지의 260px 기준(§3.1 예산)이
 * 그만큼 깨지고, 흡수 창구가 둘이 되어 세로 예산 계산이 무너진다.
 * 여기서는 "적용된 값"이 아니라 **선언의 존재**를 본다 — 미디어 안이든 `!important`든.
 */
describe('스크롤 영역에서 자라는 자식은 없다 (전수 훑기 + 런타임)', () => {
  it('자식이 실제로 여럿 렌더돼 있다 (빈 배열에 대고 도는 공허한 검사 방지)', () => {
    expect(scrollChildren().length).toBeGreaterThan(4)
    expect(scrollChildren().some(el => el.getAttribute('data-testid') === 'char-stage')).toBe(true)
  })

  it('소스 어디에도 flex-grow > 0을 주는 선언이 없다 (@media·!important 포함)', () => {
    const violations: string[] = []
    for (const el of scrollChildren()) {
      for (const rule of ALL_RULES) {
        const grow = declaredGrow(rule.decls)
        if (grow === null || grow <= 0) continue
        if (!couldApplyTo(rule, el)) continue
        violations.push(`${label(el)} ← ${where(rule)} { ${rule.decls.get('flex') ?? `flex-grow: ${rule.decls.get('flex-grow')}`} }`)
      }
    }
    expect(violations).toEqual([])
  })

  it('인라인 style로도 자라지 않는다 (런타임 — 소스 훑기가 못 보는 유일한 통로)', () => {
    const violations = scrollChildren().filter(el => {
      if (!(el instanceof HTMLElement)) return false
      const inline = new Map<string, string>()
      if (el.style.flex !== '') inline.set('flex', el.style.flex)
      if (el.style.flexGrow !== '') inline.set('flex-grow', el.style.flexGrow)
      const g = declaredGrow(inline)
      return g !== null && g > 0
    }).map(label)
    expect(violations).toEqual([])
  })

  it('계산된 값으로도 자라지 않는다 (겹치는 마지막 확인)', () => {
    const violations = scrollChildren()
      .filter(el => Number(getComputedStyle(el).flexGrow || '0') > 0).map(label)
    expect(violations).toEqual([])
  })
})

/**
 * ### 흡수 창구는 스테이지 하나 + 그 하한과 상한 (Ruling 34)
 * 하한이 없으면 인물이 사라지고, **상한이 없으면** 스테이지가 카드 자리를 먹는다 —
 * 재리뷰어의 MU-X-D(하한 170 → 420)에서 아랫줄 카드 가시성이 0%가 됐는데도 green이었다.
 * §3.1 예산의 260px을 상한으로 삼는다(스테이지의 인라인 height와 같은 값이다).
 */
describe('흡수 창구는 캐릭터 스테이지 하나뿐이고, 그 크기에는 하한과 상한이 있다', () => {
  const stage = () => screen.getByTestId('char-stage')

  it('줄어드는 자식은 스테이지 정확히 하나다 (소스 전수 훑기)', () => {
    const shrinkable: string[] = []
    for (const el of scrollChildren()) {
      const hit = ALL_RULES.some(rule => {
        const s = rule.decls.get('flex-shrink') ?? rule.decls.get('flex')?.replace(/!important/i, '').trim().split(/\s+/)[1]
        if (s === undefined || Number.parseFloat(s) <= 0) return false
        return couldApplyTo(rule, el)
      })
      if (hit) shrinkable.push(label(el))
    }
    expect(shrinkable).toHaveLength(1)
    expect(shrinkable[0]).toContain('char-stage')
  })

  it('스테이지 min-height 선언은 모두 0보다 크고 §3.1 예산(260px) 이하다 (@media 포함)', () => {
    const declared = ALL_RULES.filter(r => r.decls.has('min-height') && couldApplyTo(r, stage()))
    expect(declared.length, '스테이지에 하한을 주는 규칙이 하나는 있어야 한다').toBeGreaterThan(0)
    const bad = declared.filter(r => {
      const v = declaredMinHeightPx(r.decls)
      return v === null || v <= 0 || v > CHARACTER_STAGE_HEIGHT_PX
    }).map(r => `${where(r)} { min-height: ${r.decls.get('min-height')} }`)
    expect(bad).toEqual([])
  })

  it('스테이지의 계산된 min-height도 (0, 260] 안이다 (인라인 우회 포함)', () => {
    const v = px(getComputedStyle(stage()).minHeight || '0')
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThanOrEqual(CHARACTER_STAGE_HEIGHT_PX)
  })

  it('스테이지의 기준 높이는 §3.1 예산 그대로다 (상한의 근거)', () => {
    expect(getComputedStyle(stage()).height).toBe(`${CHARACTER_STAGE_HEIGHT_PX}px`)
  })
})

/**
 * 홈 화면 세로 예산 감사 — 실제 브라우저로 한 판(기본 156턴)을 끝까지 돌면서
 * **주 조작 버튼이 매 턴 화면 안에 온전히 있는지**를 잰다.
 *
 * 왜 있는가
 * ---------
 * 이 저장소에서 레이아웃 결함은 단위 테스트로 잡히지 않는다 — jsdom은 레이아웃을
 * 계산하지 않는다. Task 24에서 "홈이 한 장에 들어간다"의 근거로 삼았던
 * `document.documentElement.scrollHeight`는 `.app { height:100dvh; overflow:hidden }`
 * 아래에서 뷰포트를 넘을 수가 없어 **항상 통과하는 무효한 지표**였고, 그 사이 실제로는
 * 여러 턴에서 '한 주 넘기기' 버튼이 화면 밖에 있었다. 지표를 바꾼 것이 이 스크립트다:
 *
 *   버튼 여유 = window.innerHeight − nextTurnButton.getBoundingClientRect().bottom
 *
 * 이 값이 음수면 버튼이 화면 밖이고, 탭바 위쪽 경계를 넘으면 눌러도 탭바가 먹는다.
 *
 * **여유(clearance) 하나로는 부족하다 (Fix Round 3, Ruling 36).** 그 값은 *부재를
 * 만족으로* 읽는다 — 버튼이 `display:none`이면 rect가 0×0이라 여유가 844(최선)로 나오고,
 * 다른 요소가 버튼을 덮고 있어도 여유는 멀쩡하다. 이 저장소가 세 번 밟은 병(`docScrollHeight`,
 * `|| '0'` 폴백)과 같은 얼굴이다. 그래서 **결과**를 직접 잰다:
 *
 *   1) 버튼이 존재하는가                     (없으면 위반)
 *   2) 크기가 있는가 (width·height > 0)      (0×0이면 위반)
 *   3) 터치 타깃을 만족하는가 (height ≥ 44)  (전역 제약)
 *   4) 화면 안에 온전히 있는가               (top/bottom/left/right 전부)
 *   5) **그 좌표를 클릭하면 버튼이 잡히는가** (`document.elementFromPoint`)
 *   6) **보이는가** (`Element.checkVisibility` — display·visibility·opacity·content-visibility)
 *
 * 5번이 핵심이다 — 무엇이 덮든(`position`·`z-index`·`transform`·`pointer-events`…
 * 메커니즘이 무엇이든) "눌리지 않는다"는 결과 하나로 잡힌다. 메커니즘을 열거하지
 * 않는 이유가 그것이다(Ruling 35).
 * `design/layout.test.tsx`는 이 실측을 성립하게 만드는 **구조**를 고정하고,
 * 이 스크립트는 **실측 자체**를 담당한다 — 둘 중 하나만으로는 부족하다.
 *
 * Playwright는 선택적 외부 의존이다 (package.json에 넣지 않는다)
 * ------------------------------------------------------------
 *   npm i -g playwright && npx playwright install chromium
 *   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs \
 *   PLAYWRIGHT_CHROMIUM=/path/to/chrome \
 *     node scripts/layout-audit.mjs --url http://localhost:4173/
 *
 * 사용법
 * ------
 *   pnpm --filter @bb/app build && pnpm --filter @bb/app preview   # 다른 터미널에서
 *   node scripts/layout-audit.mjs --url http://localhost:4173/ --width 390 --height 844
 *   node scripts/layout-audit.mjs --url http://localhost:4173/ --height 667   # 짧은 기기
 *
 * 위반이 하나라도 있으면 종료 코드 1.
 */

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}
const url = arg('url', 'http://localhost:4173/')
const width = Number(arg('width', '390'))
const height = Number(arg('height', '844'))
const maxTurns = Number(arg('turns', '156'))
const shotDir = arg('shots', '')

async function loadPlaywright() {
  const explicit = process.env.PLAYWRIGHT_MODULE
  for (const spec of [explicit, 'playwright', 'playwright-core'].filter(Boolean)) {
    try { return await import(spec) } catch { /* 다음 후보 */ }
  }
  console.error(`
[layout-audit] Playwright를 찾지 못했다.

이 스크립트는 **선택적 외부 의존**이다 — 무거운 브라우저 의존성을 이 저장소의
package.json에 올리지 않기로 했다(별개 결정). 다음 중 하나로 준비한다:

  npm i -g playwright && npx playwright install chromium
  PLAYWRIGHT_MODULE=<playwright의 index.mjs 경로> node scripts/layout-audit.mjs …

브라우저 실행 파일 경로가 기본값과 다르면 PLAYWRIGHT_CHROMIUM으로 지정한다.
`)
  process.exit(1)
}

const { chromium } = await loadPlaywright()
const launchOptions = process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
let browser
try {
  browser = await chromium.launch(launchOptions)
} catch (err) {
  console.error(`[layout-audit] 브라우저를 띄우지 못했다: ${err.message}`)
  console.error('PLAYWRIGHT_CHROMIUM으로 실행 파일 경로를 지정하거나 `npx playwright install chromium`을 실행한다.')
  process.exit(1)
}

const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const consoleErrors = [], pageErrors = [], badResponses = []
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', e => pageErrors.push(String(e)))
page.on('response', r => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`) })

/** 클릭. **실패해도 던지지 않는다** — 크래시는 지표가 아니다(Ruling 36).
 *  못 누른 사실은 아래 clickFailures에 기록되고 마지막에 exit 1로 이어진다. */
const clickFailures = []
const click = async (testid) => {
  try { await page.getByTestId(testid).click({ timeout: 8000 }); return true }
  catch (err) { clickFailures.push(`${testid}: ${String(err).split('\n')[0]}`); return false }
}

/** 한 번의 evaluate로 화면 상태와 세로 예산 실측을 함께 읽는다. */
const probe = () => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const next = q('[data-testid=next-turn]')
  const tabbar = q('.tabbar')
  const scroll = q('.home-scroll')
  const chips = q('.stat-chips')
  const nr = next?.getBoundingClientRect()
  const tr = tabbar?.getBoundingClientRect()
  const sr = scroll?.getBoundingClientRect()
  /** 카드 타일이 스크롤 영역 안에서 실제로 보이는 세로 비율(0~1). */
  const cardVisibility = [...document.querySelectorAll('[data-testid^="slot-card-"]')].map(c => {
    const r = c.getBoundingClientRect()
    if (sr === undefined || r.height === 0) return 1
    const visible = Math.max(0, Math.min(r.bottom, sr.bottom) - Math.max(r.top, sr.top))
    return visible / r.height
  })
  /** 버튼 중심을 실제로 클릭하면 무엇이 잡히는가. 버튼(또는 그 자손)이 아니면 못 누른다. */
  const hit = (() => {
    if (nr === undefined || nr.width === 0 || nr.height === 0) return { ok: false, what: '(크기 없음)' }
    const cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return { ok: false, what: '(화면 밖 좌표)' }
    const el = document.elementFromPoint(cx, cy)
    if (el === null) return { ok: false, what: '(아무것도 없음)' }
    const ok = el === next || next.contains(el)
    return { ok, what: `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''}` }
  })()
  // 브라우저 자신의 가시성 오라클. 기하학과 히트테스트가 전부 멀쩡한데 `opacity: 0`
  // 하나로 버튼이 안 보이는 경우를 잡는다(내가 고안한 공격이 정확히 그것이었다).
  // 메커니즘을 열거하지 않고 브라우저에게 "보이느냐"고 묻는다 — Ruling 35의 방향이다.
  const visible = next !== null && typeof next.checkVisibility === 'function'
    ? next.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })
    : null   // 지원하지 않는 브라우저에서는 판정하지 않는다
  return {
    buttonExists: next !== null,
    visible,
    buttonW: nr ? Math.round(nr.width) : 0,
    buttonH: nr ? Math.round(nr.height) : 0,
    inViewport: nr ? (nr.top >= 0 && nr.left >= 0 && nr.bottom <= window.innerHeight && nr.right <= window.innerWidth) : false,
    hitOk: hit.ok, hitWhat: hit.what,
    ending: !!q('[data-testid=ending]'), prologue: !!q('[data-testid=prologue]'),
    cutscene: !!q('[data-testid=cutscene]'), event: !!q('[data-testid=event-modal]'),
    sheet: !!q('[data-testid=choice-sheet]'),
    choices: [...document.querySelectorAll('[data-testid]')]
      .map(e => e.getAttribute('data-testid')).filter(t => /^choice-\d+$/.test(t ?? '')),
    turn: (() => { const m = q('.topbar-dday')?.textContent?.match(/D-(\d+)/); return m ? 156 - Number(m[1]) : null })(),
    cards: [...document.querySelectorAll('[data-testid^="slot-card-"]')]
      .map(c => ({ id: c.getAttribute('data-testid'), disabled: c.hasAttribute('disabled') })),
    nextEnabled: !!next && !next.hasAttribute('disabled'),
    rerollEnabled: (() => { const r = q('[data-testid=reroll]'); return !!r && !r.hasAttribute('disabled') })(),
    // ── 실측 ──
    // 버튼이 없거나 크기가 0이면 여유는 **의미가 없다** — null로 두고 위 지표로 판정한다.
    clearance: nr && nr.height > 0 ? Math.round(window.innerHeight - nr.bottom) : null,
    tabbarOverlap: nr && tr ? Math.round(nr.bottom - tr.top) : null,
    chipOverflow: chips ? chips.scrollWidth - chips.clientWidth : null,
    scrollOverflow: scroll ? scroll.scrollHeight - scroll.clientHeight : null,
    minCardVisibility: cardVisibility.length > 0 ? Math.min(...cardVisibility) : null,
  }
})

const samples = []
const record = (turn, when, p) => samples.push({ turn, when, ...p })

await page.goto(url, { waitUntil: 'networkidle' })
await click('start')

let lastTurn = 0, ended = false, stuck = null
let sameScreen = 0, prevSignature = ''
for (let i = 0; i < maxTurns * 40; i++) {
  const p = await probe()
  if (p.ending) { ended = true; break }
  if (p.prologue) { await click('prologue-next'); continue }
  if (p.cutscene) { await click('cutscene-close'); continue }
  if (p.event) {
    if (p.sheet && p.choices.length > 0) await click(p.choices[i % p.choices.length])
    else await click('dialogue-box')
    continue
  }
  if (p.turn !== null && p.turn > maxTurns) break     // --turns로 조기 종료(부분 감사)
  if (p.turn !== null && p.turn !== lastTurn) {
    lastTurn = p.turn
    record(p.turn, '고르기 전', p)
    if (shotDir !== '' && p.clearance !== null && p.clearance < 0) {
      await page.screenshot({ path: `${shotDir}/violation-turn${p.turn}.png` })
    }
  }
  if (p.cards.length > 0) {
    // 같은 화면에서 진전이 없으면(클릭이 먹지 않는 상태) 무한 루프 대신 멈춘다.
    const signature = `${p.turn}|${p.cards.map(c => c.id + (c.disabled ? 'x' : '')).join(',')}`
    sameScreen = signature === prevSignature ? sameScreen + 1 : 0
    prevSignature = signature
    if (sameScreen > 6) { stuck = { turn: p.turn, why: '같은 화면에서 진전 없음(클릭이 먹지 않는다)' }; break }

    if (p.turn !== null && p.turn % 4 === 0 && p.rerollEnabled) { await click('reroll'); continue }
    for (const c of p.cards) if (!c.disabled) await click(c.id)
    const after = await probe()
    record(p.turn, '고른 뒤', after)
    if (!after.nextEnabled) { stuck = { turn: p.turn, why: 'next-turn 비활성' }; break }
    await click('next-turn')
    continue
  }
  stuck = { turn: p.turn, why: '알 수 없는 화면' }
  break
}

// ── 위반 집계 (Ruling 36) ──────────────────────────────────────────────
// 각 지표에 대해 물었다: **이 값이 나쁠 수 있는가? 무엇이 틀렸을 때 나빠지는가?**
//   missing   ← 버튼을 아예 안 그리거나 display:none (rect 없음)
//   zeroSize  ← 크기가 0으로 접힘
//   tooSmall  ← 터치 타깃(44px) 미달
//   outside   ← 뷰포트 밖으로 밀려남(위·아래·좌·우 전부)
//   unhittable← 좌표를 눌러도 다른 것이 잡힘(무엇이 덮든, pointer-events든)
// clearance는 이제 **보조 지표**다 — 버튼이 없거나 0×0이면 null이라 판정에 쓰이지 않는다.
const missing = samples.filter(s => !s.buttonExists)
const zeroSize = samples.filter(s => s.buttonExists && (s.buttonW === 0 || s.buttonH === 0))
const tooSmall = samples.filter(s => s.buttonH > 0 && s.buttonH < 44)
const outside = samples.filter(s => s.buttonExists && s.buttonW > 0 && s.buttonH > 0 && !s.inViewport)
const unhittable = samples.filter(s => !s.hitOk)
const invisible = samples.filter(s => s.visible === false)
const offscreen = samples.filter(s => s.clearance !== null && s.clearance < 0)
const covered = samples.filter(s => s.tabbarOverlap !== null && s.tabbarOverlap > 0)
const chipsOver = samples.filter(s => s.chipOverflow !== null && s.chipOverflow > 0)
const worst = samples.reduce((m, s) => (s.clearance !== null && s.clearance < m.clearance ? s : m), { clearance: Infinity })
const worstCard = samples.reduce((m, s) => (s.minCardVisibility !== null && s.minCardVisibility < m.minCardVisibility ? s : m), { minCardVisibility: Infinity })
const maxOverflow = samples.reduce((m, s) => Math.max(m, s.scrollOverflow ?? 0), 0)

console.log(`
[layout-audit] ${width}×${height} · ${url}
  완주            ${ended ? 'O' : (maxTurns < 156 ? `부분 감사(${maxTurns}턴까지)` : 'X')}${stuck ? ` (막힘: 턴 ${stuck.turn} — ${stuck.why})` : ''}
  측정            ${samples.length}회 / ${new Set(samples.map(s => s.turn)).size}턴
  버튼 없음       ${missing.length}건${missing.length > 0 ? ` — 턴 ${[...new Set(missing.map(s => s.turn))].slice(0, 8).join(', ')}` : ''}
  버튼 크기 0     ${zeroSize.length}건
  터치 타깃 미달  ${tooSmall.length}건 (44px 기준)
  뷰포트 밖       ${outside.length}건${outside.length > 0 ? ` — 턴 ${[...new Set(outside.map(s => s.turn))].slice(0, 8).join(', ')}` : ''}
  **보이지 않음**   ${invisible.length}건${samples.some(s => s.visible === null) ? ' (일부 표본은 checkVisibility 미지원 — 판정 제외)' : ''}
  **클릭이 안 닿음** ${unhittable.length}건${unhittable.length > 0 ? ` — 대신 잡히는 것: ${[...new Set(unhittable.map(s => s.hitWhat))].slice(0, 4).join(', ')}` : ''}
  버튼 여유 최악  ${worst.clearance === Infinity ? 'n/a' : `${worst.clearance}px (턴 ${worst.turn}, ${worst.when})`}
  버튼 화면 밖(여유<0) ${offscreen.length}건${offscreen.length > 0 ? ` — 턴 ${[...new Set(offscreen.map(s => s.turn))].slice(0, 8).join(', ')}` : ''}
  탭바가 덮음     ${covered.length}건${covered.length > 0 ? ` — 턴 ${[...new Set(covered.map(s => s.turn))].join(', ')}` : ''}
  스탯 칩 넘침    ${chipsOver.length}건
  스크롤 넘침 최대 ${maxOverflow}px (넘침 자체는 정상 — 스크롤로 닿는다)
  카드 최소 가시성 ${worstCard.minCardVisibility === Infinity ? 'n/a' : `${Math.round(worstCard.minCardVisibility * 100)}% (턴 ${worstCard.turn}, ${worstCard.when})`}
  클릭 실패       ${clickFailures.length}건
  콘솔 에러 ${consoleErrors.length} · pageerror ${pageErrors.length} · 4xx/5xx ${badResponses.length}`)
for (const f of clickFailures.slice(0, 5)) console.log(`    ! 클릭 실패 ${f}`)
for (const e of [...consoleErrors, ...pageErrors, ...badResponses]) console.log(`    ! ${e}`)

await browser.close()

// 표본이 0이면 "위반 0건"은 아무 뜻이 없다 — 부재를 만족으로 읽는 자리다(Ruling 36).
const noSamples = samples.length === 0
// `--turns`로 일부만 돌린 경우는 '완주'를 요구하지 않는다(부분 감사).
const fullRun = maxTurns >= 156
const failed = noSamples || (fullRun && !ended) || stuck !== null
  || missing.length > 0 || zeroSize.length > 0 || tooSmall.length > 0
  || outside.length > 0 || unhittable.length > 0 || invisible.length > 0
  || offscreen.length > 0 || covered.length > 0 || chipsOver.length > 0
  || clickFailures.length > 0
if (noSamples) console.log('[layout-audit] 측정 표본이 0이다 — 홈 화면에 도달하지 못했다.')
console.log(failed ? '\n[layout-audit] 실패 — 위 위반을 보라.' : '\n[layout-audit] 통과.')
process.exit(failed ? 1 : 0)

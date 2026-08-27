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
 * 5·6번이 결과 지표다. 다만 **둘 다 반례가 있었다**(Fix Round 4에서 실증):
 * `elementFromPoint`는 `pointer-events: none`인 커튼을 **정의상 못 본다**(그 커튼은
 * 클릭을 가로채지 않지만 화면은 가린다). `checkVisibility`는 `filter: opacity(0)`을
 * 안 보고, `opacity: .01`은 "0이 아니므로" true다. 그래서 마지막 겹이 하나 더 있다:
 *
 *   7) **그 자리의 픽셀이 비어 있지 않은가** (버튼 rect로 크롭한 **페이지** 스크린샷)
 *
 * 7번은 원인을 묻지 않는다 — 무엇 때문이든 "그 자리에 아무것도 안 보인다"를 잡는다.
 * (요소 스크린샷이 아니라 페이지 스크린샷을 크롭하는 이유: 요소 스크린샷은 그 위를
 *  덮은 것을 담지 않아 커튼을 놓친다.)
 *
 * **여전히 열려 있는 것(정직하게).** 이 감사가 보는 것은 '한 주 넘기기' 버튼 **한 곳**이고,
 * 픽셀 오라클은 "무언가 보이는가"만 묻는다 — 글자가 **읽을 수 있는지**(대비·잘림·엉뚱한
 * 문구)는 묻지 않는다. 카드·탭바·오버레이의 가시성도 범위 밖이다.
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
 *   node scripts/layout-audit.mjs --url http://localhost:4173/ --seed 42      # 시드 고정
 *   node scripts/layout-audit.mjs --url http://localhost:4173/ --turns 20     # 부분 표본
 *
 * 옵션: --url --width --height --seed --turns --pixels off --pixel-debug 1 --shots <dir>
 *
 * 종료 코드: 0 완주 통과 · 1 위반 · **2 부분 표본**(--turns로 줄인 런 — 판정이 아니다).
 */

import { inflateSync } from 'node:zlib'

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}
const url = arg('url', 'http://localhost:4173/')
const width = Number(arg('width', '390'))
const height = Number(arg('height', '844'))
const maxTurns = Number(arg('turns', '156'))
const shotDir = arg('shots', '')
/** 감사는 **재현되어야 한다**(Ruling 39). 시드를 고정하지 않으면 같은 결함에 대해
 *  실행마다 다른 숫자가 나온다(실측: 같은 뮤테이션에서 38/63 vs 11/24). */
const seed = arg('seed', '20260826')
/** 픽셀 오라클을 켤지. 끄고 싶을 때를 위한 탈출구이고 기본은 켬이다. */
const pixels = arg('pixels', 'on') !== 'off'
const pageUrl = `${url}${url.includes('?') ? '&' : '?'}seed=${encodeURIComponent(seed)}`

// ─────────────────────── PNG 디코더 (의존성 없이) ───────────────────────
// Playwright의 스크린샷은 PNG다. 픽셀을 보려면 디코딩이 필요한데 이 저장소에 이미지
// 라이브러리를 들이지 않기 위해(Playwright조차 선택적 외부 의존이다) 여기서 직접 푼다.
// 8비트 truecolor(RGB/RGBA)만 다룬다 — Chromium 스크린샷이 그 형식이다.
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0
  const idat = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9] }
    else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (bitDepth !== 8 || channels === 0) throw new Error(`지원하지 않는 PNG 형식(bitDepth ${bitDepth}, colorType ${colorType})`)
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]
    const rowStart = y * stride
    for (let x = 0; x < stride; x++) {
      const cur = raw[p + x]
      const a = x >= channels ? out[rowStart + x - channels] : 0
      const b = y > 0 ? out[rowStart - stride + x] : 0
      const c = (x >= channels && y > 0) ? out[rowStart - stride + x - channels] : 0
      let v
      if (filter === 0) v = cur
      else if (filter === 1) v = cur + a
      else if (filter === 2) v = cur + b
      else if (filter === 3) v = cur + ((a + b) >> 1)
      else if (filter === 4) {
        const pr = a + b - c
        const pa = Math.abs(pr - a), pb = Math.abs(pr - b), pc = Math.abs(pr - c)
        v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      } else throw new Error(`알 수 없는 PNG 필터 ${filter}`)
      out[rowStart + x] = v & 0xff
    }
    p += stride
  }
  return { width, height, channels, data: out }
}

/**
 * 버튼 자리의 **픽셀**을 본다 (Fix Round 4, Ruling 38).
 *
 * 기하학·히트테스트·`checkVisibility`가 전부 통과하는데 버튼이 안 보이는 경우가 있다 —
 * `filter: opacity(0)`(checkVisibility가 filter를 안 본다), `opacity: .01`(정확히 0만
 * false), 다른 요소가 `pointer-events: none`으로 덮는 커튼(elementFromPoint가 정의상
 * 못 본다). 셋의 공통점은 **버튼 상자가 통째로 안 보이는데 기하는 정상**이라는 것이다.
 * 메커니즘을 하나씩 막는 대신 결과를 묻는다: *그 자리에 무언가 보이는가?*
 *
 * **요소 스크린샷이 아니라 페이지 스크린샷을 rect로 크롭한다** — 요소 스크린샷은 그 위를
 * 덮은 것을 담지 않아 커튼을 놓친다.
 *
 * 세 값을 함께 본다(임계값 근거는 보고서 참고):
 *  - distinct   서로 다른 RGB 색의 수
 *  - modalShare 가장 흔한 색이 차지하는 비율 (1에 가까우면 균일 = 아무것도 안 보인다)
 *  - inkShare   각 행의 대표 밝기에서 크게 벗어난 픽셀 비율 (= 글자/테두리 같은 '잉크')
 */
function analyzePixels(png) {
  const { width, height, channels, data } = png
  const counts = new Map()
  const lum = new Float64Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const key = (r << 16) | (g << 8) | b
      counts.set(key, (counts.get(key) ?? 0) + 1)
      lum[y * width + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
  }
  const total = width * height
  let modal = 0
  for (const n of counts.values()) if (n > modal) modal = n
  // 행마다 중앙 밝기를 구하고, 거기서 크게 벗어난 픽셀을 '잉크'로 센다.
  // 세로 그라디언트(버튼 배경)는 행 안에서 거의 균일하므로 잉크로 잡히지 않는다.
  let ink = 0
  const row = new Float64Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = lum[y * width + x]
    const sorted = Float64Array.from(row).sort()
    const median = sorted[Math.floor(width / 2)]
    for (let x = 0; x < width; x++) if (Math.abs(row[x] - median) > 24) ink++
  }
  return { distinct: counts.size, modalShare: modal / total, inkShare: ink / total }
}

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

// 픽셀을 재려면 화면이 흔들리면 안 된다 — 카운트업·타이핑·전환 애니메이션을 끄고
// 잰다(`prefers-reduced-motion`은 이 앱이 §6에서 존중하기로 한 설정이다).
const ctx = await browser.newContext({
  viewport: { width, height }, deviceScaleFactor: 2,
  reducedMotion: pixels ? 'reduce' : 'no-preference',
})
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
/** 버튼 자리의 픽셀을 재서 샘플에 붙인다. 실패해도 감사를 죽이지 않고 사유를 남긴다. */
async function measurePixels(p) {
  if (!pixels || !p.buttonExists || p.buttonW === 0 || p.buttonH === 0) return null
  const rect = await page.evaluate(() => {
    const r = document.querySelector('[data-testid=next-turn]').getBoundingClientRect()
    return { x: r.left, y: r.top, width: r.width, height: r.height, vw: innerWidth, vh: innerHeight }
  })
  const clip = {
    x: Math.max(0, Math.round(rect.x)), y: Math.max(0, Math.round(rect.y)),
    width: Math.round(Math.min(rect.width, rect.vw - Math.max(0, rect.x))),
    height: Math.round(Math.min(rect.height, rect.vh - Math.max(0, rect.y))),
  }
  if (clip.width < 4 || clip.height < 4) return null
  try {
    // **페이지** 스크린샷을 rect로 크롭한다 — 요소 스크린샷은 위를 덮은 것을 담지 않는다.
    const buf = await page.screenshot({ clip })
    return analyzePixels(decodePng(buf))
  } catch (err) { pixelErrors.push(String(err).split('\n')[0]); return null }
}
const pixelErrors = []
const record = async (turn, when, p) => {
  samples.push({ turn, when, ...p, pixels: await measurePixels(p) })
}

await page.goto(pageUrl, { waitUntil: 'networkidle' })
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
    await record(p.turn, '고르기 전', p)
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
    await record(p.turn, '고른 뒤', after)
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
// ── 픽셀 오라클 판정 (Ruling 38) ──
// **임계값은 실측으로 골랐다.** 390×844 156턴 완주 312표본의 정상값은 딱 세 가지였다
// (버튼 비활성/활성 상태 차이):
//     distinct 379 · 540 · 780        ink 3.52% · 3.68% · 3.75%
// 같은 자리에서 공격 상태의 값은:
//     filter:opacity(0)  distinct 1   ink 0.00%
//     opacity:.01        distinct 8~10 ink 0.00%
//     하단 커튼(overlay) distinct 1   ink 0.00%
//     color:transparent  distinct 235 ink 1.03% (버튼 활성 상태에서)
//     font-size:0        distinct 69~234 ink 1.62~1.81%
// 두 무리 사이의 간격은 1.81% ↔ 3.52%다. 그 안에 2.0%를 놓는다 —
// 정상 최저값 대비 1.76배 여유, 최악 공격값 대비 1.10배.
const PIXEL_MIN_DISTINCT = 30     // 정상 379~780 / 안 보이면 1~10
const PIXEL_MIN_INK = 0.020
// `modalShare`는 **판정에서 뺐다.** 비활성 버튼은 단색 배경이라 정상 상태에서도
// 한 색이 95.6%를 차지한다 — 균일함 자체는 결함의 신호가 아니다(실측으로 배웠다).
//
// **남은 위험(정직하게).** 이 수치는 웹폰트(Pretendard)가 **로드되지 않은** 환경에서
// 잰 것이다(이 샌드박스는 CDN이 막혀 폴백 폰트를 쓴다). 폰트가 바뀌면 글자가 차지하는
// 픽셀 비율도 움직인다. 그래서 감사는 매 실행 **관측된 최소 잉크**를 출력한다 —
// 그 값이 2%에 가까워지면 임계값을 다시 재라(`--pixel-debug 1`로 분포를 볼 수 있다).
const measured = samples.filter(s => s.pixels !== null)
if (arg('pixel-debug', '') !== '') {
  for (const s of measured) {
    console.log(`  [픽셀] 턴 ${s.turn} ${s.when}: distinct=${s.pixels.distinct} modal=${s.pixels.modalShare.toFixed(3)} ink=${(s.pixels.inkShare * 100).toFixed(2)}% (버튼 ${s.nextEnabled ? '활성' : '비활성'})`)
  }
}
const blank = measured.filter(s =>
  s.pixels.distinct < PIXEL_MIN_DISTINCT || s.pixels.inkShare < PIXEL_MIN_INK)
const worstPixels = measured.reduce((m, s) => (s.pixels.inkShare < m.inkShare ? s.pixels : m), { inkShare: Infinity })
const offscreen = samples.filter(s => s.clearance !== null && s.clearance < 0)
const covered = samples.filter(s => s.tabbarOverlap !== null && s.tabbarOverlap > 0)
const chipsOver = samples.filter(s => s.chipOverflow !== null && s.chipOverflow > 0)
const worst = samples.reduce((m, s) => (s.clearance !== null && s.clearance < m.clearance ? s : m), { clearance: Infinity })
const worstCard = samples.reduce((m, s) => (s.minCardVisibility !== null && s.minCardVisibility < m.minCardVisibility ? s : m), { minCardVisibility: Infinity })
const maxOverflow = samples.reduce((m, s) => Math.max(m, s.scrollOverflow ?? 0), 0)

console.log(`
[layout-audit] ${width}×${height} · seed ${seed} · ${pageUrl}
  완주            ${ended ? 'O' : (maxTurns < 156 ? `부분 감사(${maxTurns}턴까지)` : 'X')}${stuck ? ` (막힘: 턴 ${stuck.turn} — ${stuck.why})` : ''}
  측정            ${samples.length}회 / ${new Set(samples.map(s => s.turn)).size}턴
  버튼 없음       ${missing.length}건${missing.length > 0 ? ` — 턴 ${[...new Set(missing.map(s => s.turn))].slice(0, 8).join(', ')}` : ''}
  버튼 크기 0     ${zeroSize.length}건
  터치 타깃 미달  ${tooSmall.length}건 (44px 기준)
  뷰포트 밖       ${outside.length}건${outside.length > 0 ? ` — 턴 ${[...new Set(outside.map(s => s.turn))].slice(0, 8).join(', ')}` : ''}
  **픽셀이 비어 있음** ${pixels ? `${blank.length}건 (측정 ${measured.length}회` : '(픽셀 검사 꺼짐'}${pixels ? `, 최소 잉크 ${worstPixels.inkShare === Infinity ? 'n/a' : (worstPixels.inkShare * 100).toFixed(1) + '%'})` : ')'}
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
// `--turns`로 일부만 돌린 경우는 '완주'를 요구하지 않는다 — 그리고 그 결과는
// **결과가 아니라 표본**이다(재리뷰 Minor 1). R3는 12턴에서 통과하고 156턴에서만
// 잡혔다. 출력과 종료 코드로 구분한다: 0=완주 통과, 1=위반, 2=부분 표본(위반 없음).
const fullRun = maxTurns >= 156
const failed = noSamples || (fullRun && !ended) || stuck !== null
  || missing.length > 0 || zeroSize.length > 0 || tooSmall.length > 0
  || outside.length > 0 || unhittable.length > 0 || invisible.length > 0 || blank.length > 0
  || pixelErrors.length > 0
  || offscreen.length > 0 || covered.length > 0 || chipsOver.length > 0
  || clickFailures.length > 0
if (noSamples) console.log('[layout-audit] 측정 표본이 0이다 — 홈 화면에 도달하지 못했다.')
if (failed) {
  console.log('\n[layout-audit] 실패 — 위 위반을 보라.')
  process.exit(1)
}
if (!fullRun) {
  console.log(`\n[layout-audit] **부분 표본** — ${maxTurns}턴까지만 돌았다. 이것은 결과가 아니다.`)
  console.log('  붐비는 턴(안내 문구가 여러 줄 붙는 턴)에서만 드러나는 결함이 있다 —')
  console.log('  실제로 `display: contents` 결함은 12턴에서 통과하고 156턴에서만 잡혔다.')
  console.log('  판정을 인용하려면 --turns 없이(156턴) 돌려라.')
  process.exit(2)
}
console.log('\n[layout-audit] 통과 (156턴 완주).')
process.exit(0)

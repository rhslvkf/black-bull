/**
 * 픽셀 오라클의 **순수 함수 부분** — PNG 디코딩과 버튼 자리 픽셀 판정.
 *
 * `layout-audit.mjs` 안에 있던 것을 Fix Round 5에서 여기로 꺼냈다. 이유는 재리뷰가
 * 실증한 두 구멍이다:
 *  - 임계 상수를 0으로 낮추면 공격(N1)이 통과하는데 app 685/685가 green이었다.
 *    스크립트가 vitest 대상이 아니라 **게이트의 기둥이 아무 테스트에도 안 걸려 있었다.**
 *  - PNG 디코더 뮤테이션(`const b = 0`)이 정상 빌드에서 green이고, 그 상태로 N2가
 *    빠져나갔다(ink 0.00% → 6.46%). 디코더가 틀리면 오라클 전체가 조용히 거짓이 된다.
 *
 * 그래서 이 파일은 **테스트 아래**에 있다(`src/design/pixelOracle.test.ts`).
 * `.mjs`인 이유는 `layout-audit.mjs`가 빌드 없이 `node`로 직접 돌기 때문이다 —
 * 타입은 옆의 `pixel-oracle.d.mts`가 준다.
 */
import { inflateSync } from 'node:zlib'

/**
 * PNG를 픽셀 버퍼로 푼다. 8비트 truecolor(RGB/RGBA)만 다룬다 — Chromium 스크린샷이
 * 그 형식이다(실측: `8bit · colorType 2 · interlace 0 · 전 행 Paeth · IDAT 2조각`).
 *
 * 지원하지 않는 형식은 **조용히 오독하지 않고 던진다.** 특히 인터레이스(Adam7)는
 * 바이트 배치가 완전히 다르므로, 무시하고 진행하면 쓰레기 픽셀을 정상으로 읽는다.
 */
export function decodePng(buf) {
  if (buf.length < 8 || buf.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG 시그니처가 아니다')
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0, sawIhdr = false
  const idat = []
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      sawIhdr = true
      width = data.readUInt32BE(0); height = data.readUInt32BE(4)
      bitDepth = data[8]; colorType = data[9]; interlace = data[12]
    } else if (type === 'IDAT') idat.push(data)
    else if (type === 'IEND') break
    pos += 12 + len
  }
  if (!sawIhdr) throw new Error('IHDR 청크가 없다')
  if (interlace !== 0) throw new Error(`인터레이스 PNG는 지원하지 않는다(interlace=${interlace})`)
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (bitDepth !== 8 || channels === 0) throw new Error(`지원하지 않는 PNG 형식(bitDepth ${bitDepth}, colorType ${colorType})`)
  if (idat.length === 0) throw new Error('IDAT 청크가 없다')
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  if (raw.length < height * (stride + 1)) throw new Error('IDAT 길이가 IHDR 크기와 맞지 않는다')
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

/** 잉크로 칠 밝기 차. 세로 그라디언트는 행 안에서 거의 균일하므로 잉크가 되지 않는다. */
export const INK_LUMINANCE_DELTA = 24

/**
 * 크롭한 이미지에서 세 값을 뽑는다.
 *  - distinct   서로 다른 RGB 색의 수
 *  - modalShare 가장 흔한 색의 비율 (참고용 — 판정에는 쓰지 않는다)
 *  - inkShare   각 행의 중앙 밝기에서 크게 벗어난 픽셀 비율 (= 글자·테두리 같은 '잉크')
 */
export function analyzePixels(png) {
  const { width, height, channels, data } = png
  if (width === 0 || height === 0) throw new Error('빈 이미지는 분석할 수 없다')
  const counts = new Map()
  const lum = new Float64Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      const r = data[i], g = data[i + 1], b = data[i + 2]
      counts.set((r << 16) | (g << 8) | b, (counts.get((r << 16) | (g << 8) | b) ?? 0) + 1)
      lum[y * width + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
  }
  const total = width * height
  let modal = 0
  for (const n of counts.values()) if (n > modal) modal = n
  let ink = 0
  const row = new Float64Array(width)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) row[x] = lum[y * width + x]
    const sorted = Float64Array.from(row).sort()
    const median = sorted[Math.floor(width / 2)]
    for (let x = 0; x < width; x++) if (Math.abs(row[x] - median) > INK_LUMINANCE_DELTA) ink++
  }
  return { distinct: counts.size, modalShare: modal / total, inkShare: ink / total }
}

/**
 * 임계값 — 390×844 156턴 완주 312표본 실측에서 골랐다.
 *   정상: distinct 379·540·780 / ink 3.52%·3.68%·3.75%   (분산 0)
 *   공격: distinct 1~235      / ink 0.00%~1.81%
 * 두 무리 사이(1.81% ↔ 3.52%)에 2.0%를 놓았다. 재리뷰가 5시드×2높이 11런·3,432표본으로
 * 정상 최소값이 여전히 3.52%/379임을 재확인했다(2.5% 미만 표본 0건).
 */
export const PIXEL_MIN_DISTINCT = 30
export const PIXEL_MIN_INK = 0.020

/** 그 자리에 아무것도 안 보이는가. `analyzePixels` 결과를 받아 판정한다. */
export function isBlank(pixels) {
  return pixels.distinct < PIXEL_MIN_DISTINCT || pixels.inkShare < PIXEL_MIN_INK
}

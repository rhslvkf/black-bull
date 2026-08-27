import { describe, it, expect } from 'vitest'
import { deflateSync } from 'node:zlib'
import {
  decodePng, analyzePixels, isBlank,
  PIXEL_MIN_DISTINCT, PIXEL_MIN_INK, INK_LUMINANCE_DELTA,
} from '../../scripts/pixel-oracle.mjs'

/**
 * **감사 게이트의 기둥을 테스트 아래로** (Fix Round 5, Ruling 44).
 *
 * 재리뷰가 실증한 두 구멍:
 *  - 임계 상수를 0으로 낮추면 공격(N1 `filter: opacity(0)`)이 감사를 통과하는데
 *    app 685/685가 green이었다 — 스크립트가 vitest 대상이 아니라 상수가 무검증이었다.
 *  - PNG 디코더에 `const b = 0` 뮤테이션을 넣어도 green이고, 그 상태로 N2가
 *    빠져나갔다(ink 0.00% → 6.46%). 디코더가 틀리면 오라클 전체가 조용히 거짓이 된다.
 *
 * 디코더는 순수 함수이므로 여기서 직접 검사한다 — **알려진 픽셀 구성의 PNG를 코드로
 * 만들어 먹이고 바이트 일치를 본다.** 실제 크롬 스크린샷이 쓰는 조합(8bit·truecolor·
 * 인터레이스 없음·행마다 Paeth·IDAT 여러 조각)을 포함해 필터 0~4를 전부 돈다.
 */

// ─────────────────────────── 테스트용 PNG 인코더 ───────────────────────────
// 디코더를 검사하려면 **디코더와 독립적인** 인코더가 필요하다. 여기서 직접 만든다.
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
/** PNG 필터를 **인코딩 방향**으로 적용한다(디코더의 역함수 — 구현을 공유하지 않는다). */
function filterRow(cur: Buffer, prev: Buffer | null, bpp: number, filter: number): Buffer {
  const out = Buffer.alloc(cur.length)
  for (let x = 0; x < cur.length; x++) {
    const a = x >= bpp ? cur[x - bpp]! : 0
    const b = prev !== null ? prev[x]! : 0
    const c = x >= bpp && prev !== null ? prev[x - bpp]! : 0
    let pred = 0
    if (filter === 1) pred = a
    else if (filter === 2) pred = b
    else if (filter === 3) pred = (a + b) >> 1
    else if (filter === 4) {
      const p = a + b - c
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
      pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
    }
    out[x] = (cur[x]! - pred) & 0xff
  }
  return out
}
interface EncodeOptions { channels: 3 | 4; filters: number[]; interlace?: number; idatPieces?: number }
/** `pixels[y][x] = [r,g,b(,a)]` → PNG 버퍼. 행마다 다른 필터를 줄 수 있다. */
function encodePng(pixels: number[][][], opts: EncodeOptions): Buffer {
  const { channels, filters, interlace = 0, idatPieces = 1 } = opts
  const height = pixels.length
  const width = pixels[0]!.length
  const stride = width * channels
  const rows: Buffer[] = []
  let prev: Buffer | null = null
  for (let y = 0; y < height; y++) {
    const cur = Buffer.alloc(stride)
    for (let x = 0; x < width; x++) {
      for (let ch = 0; ch < channels; ch++) cur[x * channels + ch] = pixels[y]![x]![ch]! & 0xff
    }
    const f = filters[y % filters.length]!
    rows.push(Buffer.concat([Buffer.from([f]), filterRow(cur, prev, channels, f)]))
    prev = cur
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8                                  // bit depth
  ihdr[9] = channels === 4 ? 6 : 2             // color type
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = interlace
  const z = deflateSync(Buffer.concat(rows))
  const pieces: Buffer[] = []
  const size = Math.ceil(z.length / idatPieces)
  for (let i = 0; i < z.length; i += size) pieces.push(chunk('IDAT', z.subarray(i, i + size)))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), ...pieces, chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 결정적이지만 규칙이 단순하지 않은 픽셀 — 필터 예측이 우연히 맞아떨어지지 않게 한다. */
function makePixels(width: number, height: number, channels: 3 | 4): number[][][] {
  const rows: number[][][] = []
  for (let y = 0; y < height; y++) {
    const row: number[][] = []
    for (let x = 0; x < width; x++) {
      const px = [(x * 37 + y * 11) % 256, (x * 5 + y * 97) % 256, (x * 131 + y * 3) % 256]
      if (channels === 4) px.push((x + y) % 2 === 0 ? 255 : 128)
      row.push(px)
    }
    rows.push(row)
  }
  return rows
}
const flatten = (pixels: number[][][]): number[] => pixels.flat(2)

describe('PNG 디코더 — 알려진 픽셀 구성으로 바이트 일치를 본다 (Ruling 44)', () => {
  for (const channels of [3, 4] as const) {
    for (const filter of [0, 1, 2, 3, 4]) {
      it(`채널 ${channels} · 필터 ${filter} 단독을 정확히 푼다`, () => {
        const pixels = makePixels(9, 7, channels)
        const png = encodePng(pixels, { channels, filters: [filter] })
        const out = decodePng(png)
        expect(out.width).toBe(9)
        expect(out.height).toBe(7)
        expect(out.channels).toBe(channels)
        expect([...out.data]).toEqual(flatten(pixels))
      })
    }
  }

  it('행마다 필터가 섞여 있어도 정확히 푼다 (실제 스크린샷이 그렇다)', () => {
    const pixels = makePixels(11, 10, 3)
    const png = encodePng(pixels, { channels: 3, filters: [0, 1, 2, 3, 4, 4, 3, 2, 1, 0] })
    expect([...decodePng(png).data]).toEqual(flatten(pixels))
  })

  it('IDAT이 여러 조각으로 나뉘어도 정확히 푼다 (실측: 크롬은 2조각으로 낸다)', () => {
    const pixels = makePixels(16, 16, 3)
    const png = encodePng(pixels, { channels: 3, filters: [4], idatPieces: 3 })
    expect([...decodePng(png).data]).toEqual(flatten(pixels))
  })

  it('Paeth 예측이 세 이웃을 실제로 구별한다 (a·b·c를 뒤바꾸면 결과가 달라지는 구성)', () => {
    // Paeth는 a(왼쪽)·b(위)·c(왼쪽위) 셋을 비교해 하나를 고른다. 셋이 서로 다르고
    // 선택이 갈리는 값이어야 `b=0`이나 `b↔c` 교환 같은 뮤테이션이 결과를 바꾼다.
    const pixels = [
      [[10, 20, 30], [200, 40, 60], [90, 150, 210]],
      [[250, 5, 128], [17, 233, 91], [64, 64, 200]],
      [[3, 199, 44], [120, 8, 250], [199, 77, 15]],
    ]
    const png = encodePng(pixels, { channels: 3, filters: [4] })
    expect([...decodePng(png).data]).toEqual(flatten(pixels))
  })

  it('인터레이스 PNG는 **조용히 오독하지 않고** 던진다', () => {
    const png = encodePng(makePixels(8, 8, 3), { channels: 3, filters: [0], interlace: 1 })
    expect(() => decodePng(png)).toThrow(/인터레이스/)
  })

  it('PNG가 아니거나 형식이 다르면 던진다', () => {
    expect(() => decodePng(Buffer.from('not a png at all'))).toThrow()
    const bad = encodePng(makePixels(4, 4, 3), { channels: 3, filters: [0] })
    bad[8 + 8 + 8] = 16                              // IHDR의 bit depth를 16으로
    expect(() => decodePng(bad)).toThrow(/지원하지 않는 PNG 형식/)
  })

  it('알 수 없는 필터 바이트는 던진다', () => {
    const pixels = makePixels(4, 3, 3)
    const png = encodePng(pixels, { channels: 3, filters: [0] })
    // IDAT을 직접 다시 만들어 첫 행의 필터 바이트만 9로 바꾼다.
    const stride = 4 * 3
    const rows = Buffer.alloc(3 * (stride + 1))
    for (let y = 0; y < 3; y++) {
      rows[y * (stride + 1)] = y === 0 ? 9 : 0
      for (let x = 0; x < stride; x++) rows[y * (stride + 1) + 1 + x] = pixels[y]![Math.floor(x / 3)]![x % 3]!
    }
    const header = png.subarray(0, 8 + 25)
    const broken = Buffer.concat([header, chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))])
    expect(() => decodePng(broken)).toThrow(/필터/)
  })
})

describe('픽셀 분석과 임계값 (Ruling 44 — 상수도 검사 아래로)', () => {
  /** 단색 이미지: 아무것도 안 보이는 상태. */
  const solid = (w: number, h: number, rgb: number[]) =>
    Array.from({ length: h }, () => Array.from({ length: w }, () => [...rgb]))

  it('단색 이미지는 distinct 1 · 잉크 0이다', () => {
    const png = decodePng(encodePng(solid(20, 10, [11, 14, 19]), { channels: 3, filters: [0] }))
    const stats = analyzePixels(png)
    expect(stats.distinct).toBe(1)
    expect(stats.inkShare).toBe(0)
    expect(stats.modalShare).toBe(1)
  })

  it('세로 그라디언트만 있으면 잉크가 0이다 — 버튼 배경을 글자로 오인하지 않는다', () => {
    const px = Array.from({ length: 20 }, (_, y) => Array.from({ length: 30 }, () => [y * 3, 60 + y, 40]))
    const stats = analyzePixels(decodePng(encodePng(px, { channels: 3, filters: [0] })))
    expect(stats.distinct).toBe(20)          // 행마다 한 색
    expect(stats.inkShare).toBe(0)           // 행 안에서는 균일하다
  })

  it('행 안에 밝은 글자가 있으면 잉크로 잡힌다', () => {
    const px = Array.from({ length: 20 }, (_, y) => Array.from({ length: 30 }, (_, x) => (
      x >= 10 && x < 14 ? [255, 255, 255] : [y * 2, 50 + y, 40]
    )))
    const stats = analyzePixels(decodePng(encodePng(px, { channels: 3, filters: [0] })))
    expect(stats.inkShare).toBeCloseTo(4 / 30, 5)
  })

  it('잉크 문턱은 밝기 차 기준이다 — 문턱 이하 차이는 잉크가 아니다', () => {
    const base = 100
    const under = base + INK_LUMINANCE_DELTA - 5
    const px = Array.from({ length: 6 }, () => Array.from({ length: 20 }, (_, x) => (
      x < 3 ? [under, under, under] : [base, base, base]
    )))
    expect(analyzePixels(decodePng(encodePng(px, { channels: 3, filters: [0] }))).inkShare).toBe(0)
  })

  it('임계값이 실측 두 무리 사이에 있다 — 값과 그 의미를 함께 못박는다', () => {
    expect(PIXEL_MIN_DISTINCT).toBe(30)
    expect(PIXEL_MIN_INK).toBe(0.02)
    // 아래 수치는 전부 **실측값**이다(보고서 Fix Round 4 표).
    const healthy = [
      { distinct: 379, modalShare: 0.956, inkShare: 0.0352 },   // 버튼 비활성
      { distinct: 540, modalShare: 0.04, inkShare: 0.0368 },
      { distinct: 780, modalShare: 0.036, inkShare: 0.0375 },   // 버튼 활성
    ]
    const attacks = [
      { name: 'filter:opacity(0)', distinct: 1, modalShare: 1, inkShare: 0 },
      { name: 'opacity:.01', distinct: 8, modalShare: 0.638, inkShare: 0 },
      { name: '하단 커튼', distinct: 1, modalShare: 1, inkShare: 0 },
      { name: 'color:transparent', distinct: 235, modalShare: 0.04, inkShare: 0.0103 },
      { name: 'font-size:0', distinct: 69, modalShare: 0.98, inkShare: 0.0162 },
    ]
    for (const h of healthy) expect(isBlank(h), `정상값 ${JSON.stringify(h)}`).toBe(false)
    for (const a of attacks) expect(isBlank(a), `공격 ${a.name}`).toBe(true)
    // 임계값을 0으로 낮추면 공격이 전부 빠져나간다 — 그 뮤테이션이 red가 되는 이유가 이 줄이다.
    expect(Math.min(...healthy.map(h => h.inkShare))).toBeGreaterThan(PIXEL_MIN_INK)
    expect(Math.max(...attacks.map(a => a.inkShare))).toBeLessThan(PIXEL_MIN_INK)
  })

  it('빈 이미지는 분석하지 않고 던진다 — 0표본을 "이상 없음"으로 읽지 않는다', () => {
    expect(() => analyzePixels({ width: 0, height: 0, channels: 3, data: Buffer.alloc(0) })).toThrow()
  })
})

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, '../../index.html'), 'utf-8')

describe('index.html', () => {
  it('Pretendard 폰트를 실제로 로드한다(stylesheet 링크)', () => {
    // index.css는 font-family: 'Pretendard', ...를 선언하지만 @font-face나 <link>가
    // 없으면 조용히 시스템 폰트로 떨어진다(Task 9 이전 결함). 실제 로딩 여부를 고정한다.
    const linkMatch = html.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi) ?? []
    const hasFontLink = linkMatch.some(tag => /pretendard/i.test(tag))
    expect(hasFontLink).toBe(true)
  })

  it('폰트 로딩이 실패해도 무너지지 않는 폴백 스택이 index.css에 남아 있다', () => {
    const cssPath = join(here, '../index.css')
    const css = readFileSync(cssPath, 'utf-8')
    const fontFamily = css.match(/font-family:\s*([^;]+);/)?.[1] ?? ''
    expect(fontFamily).toMatch(/Pretendard/)
    // 시스템 폰트 폴백이 최소 하나는 남아 있어야 CDN이 막혀도 화면이 무너지지 않는다.
    expect(fontFamily).toMatch(/system-ui|sans-serif/)
  })

  it('favicon 경로가 절대경로가 아니다(GitHub Pages 서브패스 배포 대응)', () => {
    const faviconTag = html.match(/<link[^>]*rel=["']icon["'][^>]*>/i)?.[0] ?? ''
    expect(faviconTag).not.toBe('')
    const href = faviconTag.match(/href=["']([^"']+)["']/)?.[1] ?? ''
    expect(href.startsWith('/')).toBe(false)
  })
})

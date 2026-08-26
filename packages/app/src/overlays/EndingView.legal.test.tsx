import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import listed from '../../../core/data/listed-companies.json'
import { renderEnding } from '../testUtils'

/**
 * 계획서 §4.4·§7 — 잔고증명서 발행처는 실존 증권사의 상호와 겹치면 안 된다.
 * Task 1이 종목명에 적용한 3축 검사(`packages/core/src/market/stocks.test.ts`)를
 * 발행처 이름 하나에 그대로 재사용한다. 브리프의 금칙어 6개(미래에셋·삼성증권·
 * 키움·NH투자·한국투자·토스증권)는 최소치일 뿐이라 상장법인목록 2,761개 전체와
 * 브랜드 어근 목록까지 대조한다.
 *
 * `packages/core/data/listed-companies.json`을 `@bb/core`가 재수출하지 않으므로
 * (이 태스크는 packages/app만 건드린다 — core의 export 목록을 늘리지 않는다)
 * 상대 경로로 직접 읽는다. patched.json의 `.json`은 vite/vitest가 기본으로
 * 파싱해 준다(resolveJsonModule).
 */
const ISSUER_NAME = '새벽증권'

const listedNames = listed as string[]
const listedLen2Plus = listedNames.filter(n => n.length >= 2)

// 축 B — market/stocks.test.ts의 BRAND_ROOTS와 같은 목록(재벌·대기업 브랜드 어근).
const BRAND_ROOTS = [
  '삼성', 'LG', 'SK', '현대', '롯데', '한화', '두산', '포스코', 'POSCO', '카카오', '네이버', 'NAVER', '셀트리온',
  '에코프로', '하이닉스', '신세계', 'CJ', 'GS', '한진', '효성', '금호', '대우', 'KB', '신한', '미래에셋', '키움',
  '쿠팡', '넥슨', '엔씨', '넷마블', '크래프톤', '기아', 'LS', 'DB', '아모레', '오리온', '농심', '빙그레',
  '대한항공', '아시아나', '하이브', 'JYP', 'YG', 'NH', '한국투자', '토스',
] as const

describe('EndingView 발행처 법적 안전성', () => {
  it('상장법인목록이 실제로 로드된다', () => {
    expect(Array.isArray(listedNames)).toBe(true)
    expect(listedNames.length).toBeGreaterThan(2000)
  })

  it('발행처명이 어떤 상장사명과도 완전일치하지 않는다', () => {
    expect(new Set(listedNames).has(ISSUER_NAME)).toBe(false)
  })

  // 축 A — 역방향 포함: 상장사명이 발행처명 "안에" 들어있는가.
  it('어떤 상장사명도 발행처명에 포함되지 않는다 (역방향 포함)', () => {
    const hits = listedLen2Plus.filter(n => ISSUER_NAME.includes(n))
    expect(hits, `발행처명 "${ISSUER_NAME}"이 상장사명 [${hits.join(', ')}]을 포함함`).toEqual([])
  })

  // 축 C — 정방향 포함: 발행처명 전체가 어떤 상장사명 "안에" 들어있는가.
  it('발행처명 전체가 어떤 상장사명에도 부분문자열로 포함되지 않는다', () => {
    const hits = listedNames.filter(n => n.includes(ISSUER_NAME))
    expect(hits, `발행처명 "${ISSUER_NAME}"이 상장사명 [${hits.join(', ')}]에 포함됨`).toEqual([])
  })

  // 축 B — 브랜드 어근 금칙.
  it('발행처명에 재벌·대기업 브랜드 어근이 나타나지 않는다', () => {
    const hits = BRAND_ROOTS.filter(r => ISSUER_NAME.includes(r))
    expect(hits, `발행처명 "${ISSUER_NAME}"이 브랜드 어근 [${hits.join(', ')}]을 포함함`).toEqual([])
  })

  it('브리프 금칙어 6종이 화면 어디에도 나타나지 않는다', () => {
    renderEnding({})
    const text = screen.getByTestId('ending-doc').textContent!
    for (const w of ['미래에셋', '삼성증권', '키움', 'NH투자', '한국투자', '토스증권']) {
      expect(text.includes(w), `문서에 금칙어 "${w}"가 있음`).toBe(false)
    }
  })

  it('실제로 렌더된 발행처명이 이 파일의 상수와 같다 (자기충족 검사 방지)', () => {
    // 위 4개 테스트는 ISSUER_NAME이라는 로컬 상수를 검사한다 — 실제 컴포넌트가
    // 다른 문자열을 쓰면서 이 상수만 안전하게 유지되는 결합 공격을 막으려면,
    // 화면에 실제로 그려진 발행처명이 이 상수와 같은 문자열인지 별도로 고정해야
    // 한다. `doc-issuer`가 그 지점이다.
    renderEnding({})
    expect(screen.getByTestId('doc-issuer').textContent).toBe(ISSUER_NAME)
  })
})

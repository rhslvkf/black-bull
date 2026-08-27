import { describe, it, expect } from 'vitest'
import { loadStockDefs, initStockStates, SECTORS, TIER_GATES } from './stocks'
import { loadEvents } from '../events/content'
import listed from '../../data/listed-companies.json'

describe('stocks 데이터', () => {
  const defs = loadStockDefs()
  it('10개다', () => expect(defs).toHaveLength(10))
  it('id가 유일하다', () => expect(new Set(defs.map(d => d.id)).size).toBe(10))
  it('8개 섹터가 모두 등장한다', () => {
    expect(new Set(defs.filter(d => !d.etf).map(d => d.sector)).size).toBe(8)
  })
  it('tierGate 0 종목이 3개 이상이다', () => {
    expect(defs.filter(d => d.tierGate === 0).length).toBeGreaterThanOrEqual(3)
  })
  it('수치가 유효 범위다', () => {
    defs.forEach(d => {
      expect(d.initialPrice).toBeGreaterThan(0)
      expect(d.fundamental).toBeGreaterThan(0)
      expect(d.volatility).toBeGreaterThan(0)
      expect(d.hype).toBeGreaterThanOrEqual(0)
      expect(d.hype).toBeLessThanOrEqual(1)
    })
  })
  it('ETF가 lev/inv 각 1개다', () => {
    expect(defs.filter(d => d.etf === 'lev')).toHaveLength(1)
    expect(defs.filter(d => d.etf === 'inv')).toHaveLength(1)
  })
  it('모든 종목의 sector가 유효하다', () => {
    defs.forEach(d => {
      expect(SECTORS).toContain(d.sector)
    })
  })
  it('모든 종목의 tierGate가 유효하다', () => {
    defs.forEach(d => {
      expect(TIER_GATES).toContain(d.tierGate)
    })
  })
  it('모든 종목의 etf가 유효하다', () => {
    defs.forEach(d => {
      expect([undefined, 'lev', 'inv']).toContain(d.etf)
    })
  })
  it('모든 종목의 가격이 정수다', () => {
    defs.forEach(d => {
      expect(Number.isInteger(d.initialPrice)).toBe(true)
      expect(Number.isInteger(d.fundamental)).toBe(true)
    })
  })
  it('initStockStates가 초기가로 상태를 만든다', () => {
    const st = initStockStates(defs)
    expect(st).toHaveLength(10)
    expect(st[0]!.price).toBe(defs[0]!.initialPrice)
    expect(st[0]!.history).toEqual([defs[0]!.initialPrice])
  })
})

describe('종목명 법적 안전성', () => {
  // 순우리말 어근을 쓰는 이유: 실존 상장사는 대부분 한자어·영어 어근이라
  // 순우리말은 구조적으로 충돌 확률이 낮다. 종목 추가 시에도 같은 규칙을 따를 것.
  const ROOTS = ['윤슬', '청람', '나린', '해솔', '도깨비', '한들', '반딧불', '무쇠'] as const

  const listedNames = listed as string[]
  // 1글자 상장사명과의 부분문자열 비교는 오탐이 폭증한다(모든 이름이 어떤 한 글자든
  // 포함하게 됨). 목록에는 현재 1글자 항목이 없지만 방어적으로 걸러 재사용한다.
  // 10종 × 2,761개를 매 테스트마다 다시 필터링하지 않도록 describe 스코프에서 한 번만 계산한다.
  const listedLen2Plus = listedNames.filter(n => n.length >= 2)

  it('상장법인목록이 실제로 로드된다', () => {
    expect(Array.isArray(listed)).toBe(true)
    expect(listed.length).toBeGreaterThan(2000)
  })

  it('어떤 종목명도 실존 상장사와 완전일치하지 않는다', () => {
    const names = new Set<string>(listedNames)
    for (const d of loadStockDefs()) expect(names.has(d.name)).toBe(false)
  })

  it('종목명 어근이 어떤 상장사명에도 포함되지 않는다', () => {
    for (const root of ROOTS) {
      const hits = listedNames.filter(n => n.includes(root))
      expect(hits).toEqual([])
    }
  })

  it('ETF 둘을 뺀 8종이 지정된 어근을 쓴다', () => {
    const nonEtf = loadStockDefs().filter(d => !d.etf)
    expect(nonEtf).toHaveLength(8)
    for (const d of nonEtf) {
      expect(ROOTS.some(r => d.name.startsWith(r))).toBe(true)
    }
  })

  // 축 A — 역방향 포함: 상장사명이 우리 종목명 "안에" 들어있는가.
  // ROOTS 검사는 "우리 어근이 상장사명에 포함되는가"만 보므로, 어근과 무관한 자리에
  // 실존 상장사명이 붙는 경우(예: 무쇠정밀 → 무쇠두산정밀)를 놓친다. 10종 전부(ETF 포함)를 검사한다.
  it('어떤 상장사명도 종목명에 포함되지 않는다 (역방향 포함, 10종 전부)', () => {
    for (const d of loadStockDefs()) {
      const hits = listedLen2Plus.filter(n => d.name.includes(n))
      expect(hits, `종목명 "${d.name}"이 상장사명 [${hits.join(', ')}]을 포함함`).toEqual([])
    }
  })

  // 축 B — 재벌/브랜드 어근 금칙: 종목명에만 적용한다(이벤트 본문 금칙어는 별개 축).
  // 축 A가 못 잡는 구멍: "삼성"은 상장법인목록에 항상 접미어가 붙어(삼성전자, 삼성물산 …)
  // 등장하고 "삼성" 단독으로 정확히 일치하는 상장사명이 없다. 그래서 종목명이
  // "삼성레버리지ETF"가 되어도 축 A(상장사명 부분문자열 검사)는 반응하지 않는다.
  // 이 축은 상장사명 목록과 무관하게 재벌·대기업 브랜드 어근 자체를 종목명에서 금지한다.
  const BRAND_ROOTS = [
    '삼성', 'LG', 'SK', '현대', '롯데', '한화', '두산', '포스코', 'POSCO', '카카오', '네이버', 'NAVER', '셀트리온',
    '에코프로', '하이닉스', '신세계', 'CJ', 'GS', '한진', '효성', '금호', '대우', 'KB', '신한', '미래에셋', '키움',
    '쿠팡', '넥슨', '엔씨', '넷마블', '크래프톤', '기아', 'LS', 'DB', '아모레', '오리온', '농심', '빙그레',
    '대한항공', '아시아나', '하이브', 'JYP', 'YG',
  ] as const

  it('종목명에 재벌·대기업 브랜드 어근이 나타나지 않는다 (10종 전부)', () => {
    for (const d of loadStockDefs()) {
      const hits = BRAND_ROOTS.filter(r => d.name.includes(r))
      expect(hits, `종목명 "${d.name}"이 브랜드 어근 [${hits.join(', ')}]을 포함함`).toEqual([])
    }
  })

  // 축 C — 정방향 전체 이름 포함: 우리 종목명 전체가 어떤 상장사명 "안에" 들어있는가.
  // ROOTS/어근 검사는 ETF 이름(레버리지ETF, 곱버스ETF)에 어근이 없어 ETF를 덮지 못한다.
  // 이 축은 이름 전체를 단위로 비교하므로 ETF를 포함한 10종 전부를 덮는다.
  it('종목명 전체가 어떤 상장사명에도 부분문자열로 포함되지 않는다 (10종 전부)', () => {
    for (const d of loadStockDefs()) {
      const hits = listedNames.filter(n => n.includes(d.name))
      expect(hits, `종목명 "${d.name}"이 상장사명 [${hits.join(', ')}]에 포함됨`).toEqual([])
    }
  })

  it('이벤트 본문에 실존 기업명이 남아 있지 않다', () => {
    // 상장법인목록 2,761개 전체를 이 검사에 그대로 걸 수는 없다: 목록에는 '노을', '기아',
    // '나노'처럼 이벤트 본문의 일상어와 우연히 겹치는 상장사명이 다수라 오탐이 폭발한다.
    // 그래서 축 B의 브랜드 목록 중 실제로 loadEvents() 전문에 대해 오탐이 없는 것만 골라
    // 하드코딩한다('하나', '우리'는 실측 결과 반드시 오탐이라 애초에 제외했다).
    const banned = [
      '에코프로', '두산', '삼성', '하이닉스', '카카오', '네이버', 'HD한국조선', 'KB금융',
      'LG', 'SK', '현대', '롯데', '한화', '포스코', 'POSCO', 'NAVER', '셀트리온', '신세계',
      'CJ', 'GS', '한진', '효성', '금호', '대우', 'KB', '신한', '미래에셋', '키움', '쿠팡',
      '넥슨', '엔씨', '넷마블', '크래프톤', '기아', 'LS', 'DB', '아모레', '오리온', '농심',
      '빙그레', '대한항공', '아시아나', '하이브', 'JYP', 'YG',
    ]
    const all = JSON.stringify(loadEvents())
    for (const w of banned) expect(all, `이벤트 본문에 금칙어 "${w}"가 있음`).not.toContain(w)
  })
})

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

  it('상장법인목록이 실제로 로드된다', () => {
    expect(Array.isArray(listed)).toBe(true)
    expect(listed.length).toBeGreaterThan(2000)
  })

  it('어떤 종목명도 실존 상장사와 완전일치하지 않는다', () => {
    const names = new Set<string>(listed)
    for (const d of loadStockDefs()) expect(names.has(d.name)).toBe(false)
  })

  it('종목명 어근이 어떤 상장사명에도 포함되지 않는다', () => {
    for (const root of ROOTS) {
      const hits = (listed as string[]).filter(n => n.includes(root))
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

  it('이벤트 본문에 실존 기업명이 남아 있지 않다', () => {
    const banned = ['에코프로', '두산', '삼성', '하이닉스', '카카오', '네이버', 'HD한국조선', 'KB금융']
    const all = JSON.stringify(loadEvents())
    for (const w of banned) expect(all).not.toContain(w)
  })
})

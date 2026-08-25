// packages/core/src/endings/endings.test.ts
import { describe, it, expect } from 'vitest'
import { makeState } from '../testkit'
import { judgeEnding, ENDINGS, TITLES } from './endings'

const at = (assets: number, over: Parameters<typeof makeState>[0] = {}) => {
  const s = makeState(over)
  s.player.cash = assets
  return s
}

describe('데이터', () => {
  it('엔딩 8종, 칭호 7종이고 id가 유일하다', () => {
    expect(ENDINGS).toHaveLength(8)
    expect(TITLES).toHaveLength(7)
    expect(new Set(ENDINGS.map(e => e.id)).size).toBe(8)
    expect(new Set(TITLES.map(t => t.id)).size).toBe(7)
  })
})

describe('judgeEnding 우선순위', () => {
  it('파산이 최우선', () => {
    const s = at(50_000_000_000)
    s.player.stats.network = 10
    s.flags['kimRoom'] = true
    expect(judgeEnding(s, true).endingId).toBe('legend')
  })
  it('김실장 루트가 자산 판정보다 앞선다', () => {
    const s = at(20_000_000_000)
    s.player.stats.network = 9
    s.flags['kimRoom'] = true
    expect(judgeEnding(s, false).endingId).toBe('kimheir')
  })
  it('인맥이 부족하면 김실장 엔딩이 아니다', () => {
    const s = at(700_000_000)
    s.player.stats.network = 5
    s.flags['kimRoom'] = true
    expect(judgeEnding(s, false).endingId).toBe('super')
  })
  it('10억+퇴사는 파이어족', () => {
    const s = at(1_500_000_000)
    s.player.employed = false
    expect(judgeEnding(s, false).endingId).toBe('fire')
  })
  it('10억이어도 재직이면 슈퍼개미', () => {
    expect(judgeEnding(at(1_500_000_000), false).endingId).toBe('super')
  })
  it('5억~10억 퇴사자도 판정 공백 없이 슈퍼개미다', () => {
    const s = at(700_000_000)
    s.player.employed = false
    expect(judgeEnding(s, false).endingId).toBe('super')
  })
  it('자산 구간이 순서대로 잡힌다', () => {
    expect(judgeEnding(at(200_000_000), false).endingId).toBe('wise')
    expect(judgeEnding(at(20_000_000), false).endingId).toBe('bank')
    expect(judgeEnding(at(3_100_000), false).endingId).toBe('breakeven')
    expect(judgeEnding(at(1_000_000), false).endingId).toBe('savings')
  })
  it('엔딩 이름이 채워진다', () => {
    const r = judgeEnding(at(20_000_000), false)
    expect(r.endingName.length).toBeGreaterThan(0)
    expect(r.finalAssets).toBe(20_000_000)
  })
})

describe('칭호', () => {
  it('라이벌을 이기면 beatRival', () => {
    const s = at(100_000_000, { rivalAssets: 50_000_000 })
    expect(judgeEnding(s, false).titles).toContain('박대박을 이긴')
  })
  it('라이벌보다 적으면 안 붙는다', () => {
    const s = at(10_000_000, { rivalAssets: 50_000_000 })
    expect(judgeEnding(s, false).titles).not.toContain('박대박을 이긴')
  })
  it('엄마 전화 3회 무시면 엄마 몰래', () => {
    const s = at(20_000_000); s.flags['momIgnored'] = 3
    expect(judgeEnding(s, false).titles).toContain('엄마 몰래')
  })
  it('흔들림 0턴이면 강철멘탈의', () => {
    expect(judgeEnding(at(20_000_000), false).titles).toContain('강철멘탈의')
  })
  it('흔들림이 있으면 안 붙는다', () => {
    const s = at(20_000_000)
    s.trackers = { ...s.trackers, shakenTurns: 4 }
    expect(judgeEnding(s, false).titles).not.toContain('강철멘탈의')
  })
  it('손절 0회 / 신용 미사용 / 52주 보유 / 풀매수', () => {
    const s = at(20_000_000)
    s.trackers = { ...s.trackers, lossCuts: 0, usedMargin: false, maxHeldTurns: 60, cashRatioSum: 1.5, turnsCounted: 156 }
    const t = judgeEnding(s, false).titles
    expect(t).toEqual(expect.arrayContaining(['한 번도 손절 안 한', '빚 없이', '존버한', '풀매수']))
  })
  it('조건 미달이면 칭호가 비어있을 수 있다', () => {
    const s = at(20_000_000, { rivalAssets: 10_000_000_000 })
    s.trackers = { ...s.trackers, shakenTurns: 5, lossCuts: 3, usedMargin: true, maxHeldTurns: 3, cashRatioSum: 100, turnsCounted: 156 }
    expect(judgeEnding(s, false).titles).toHaveLength(0)
  })
})

// endings.json 데이터는 `raw as {...}[]` 캐스팅으로 로드된다 — JSON import 타입은 문자열
// 리터럴을 넓혀버리므로 이 캐스팅 자체는 id 오탈자를 전혀 잡아내지 못한다 (다른 3개 태스크가
// 동일한 함정에 걸렸다). 그래서 judgeEnding/pickTitles가 실제로 참조하는 id 전체를 알려진
// 목록으로 고정하고, 항목별로 순회하며 어긋난 쪽의 이름을 실패 메시지에 남긴다.
const ENDING_IDS = [
  'legend', 'savings', 'breakeven', 'bank', 'wise', 'super', 'fire', 'kimheir',
] as const

const TITLE_IDS = [
  'beatRival', 'momSecret', 'steelMental', 'noCut', 'noDebt', 'hodler', 'allIn',
] as const

describe('endings.json 데이터 유효성', () => {
  it('엔딩 id 8개가 알려진 목록과 정확히 일치한다 (judgeEnding이 반환하는 id들)', () => {
    for (const e of ENDINGS) {
      if (!(ENDING_IDS as readonly string[]).includes(e.id)) {
        throw new Error(`알 수 없는 엔딩 id: ${e.id}`)
      }
    }
    for (const id of ENDING_IDS) {
      if (!ENDINGS.some(e => e.id === id)) {
        throw new Error(`판정 로직이 참조하는 엔딩 id가 데이터에 없다: ${id}`)
      }
    }
  })
  it('칭호 id 7개가 알려진 목록과 정확히 일치한다 (pickTitles가 반환하는 id들)', () => {
    for (const t of TITLES) {
      if (!(TITLE_IDS as readonly string[]).includes(t.id)) {
        throw new Error(`알 수 없는 칭호 id: ${t.id}`)
      }
    }
    for (const id of TITLE_IDS) {
      if (!TITLES.some(t => t.id === id)) {
        throw new Error(`판정 로직이 참조하는 칭호 id가 데이터에 없다: ${id}`)
      }
    }
  })
  it('모든 엔딩의 name/desc가 비어있지 않다', () => {
    for (const e of ENDINGS) {
      if (e.name.length === 0) throw new Error(`엔딩 ${e.id}의 name이 비어있다`)
      if (e.desc.length === 0) throw new Error(`엔딩 ${e.id}의 desc가 비어있다`)
    }
  })
  it('모든 칭호의 name이 비어있지 않다', () => {
    for (const t of TITLES) {
      if (t.name.length === 0) throw new Error(`칭호 ${t.id}의 name이 비어있다`)
    }
  })
})

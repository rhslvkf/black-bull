// packages/core/src/events/content.test.ts
import { describe, it, expect } from 'vitest'
import { loadEvents } from './content'
import { loadStockDefs } from '../market/stocks'
import { makeState } from '../testkit'
import { drawEvents } from './engine'
import { evalAll } from '../turn/conditions'
import { BALANCE } from '../balance'
import type { Sector, Effect, Condition, StatKey, EventDef } from '../types'

const events = loadEvents()
const stockIds = new Set(loadStockDefs().map(s => s.id))
const SECTORS: Sector[] = ['반도체', '2차전지', '바이오', '조선', '게임', '금융', '엔터', '방산']

// 알려진 이름 목록 — satisfies로 목록 자체의 오타를 타입체크 시점에 잡는다.
const CATEGORIES = ['news', 'company', 'personal', 'social', 'story'] as const satisfies readonly EventDef['category'][]
const EFFECT_TYPES = [
  'stat', 'mental', 'condition', 'cash', 'flag', 'impact',
  'buyStockPct', 'retire', 'rivalMul', 'fundamentalMul',
] as const satisfies readonly Effect['type'][]
const CONDITION_TYPES = [
  'tierMin', 'tierMax', 'turnMin', 'turnMax', 'regime', 'statMin',
  'assetsMin', 'assetsMax', 'employed', 'mentalMax', 'flagEq', 'flagMin', 'flagAbsent', 'holdsStock',
] as const satisfies readonly Condition['type'][]
const STAT_KEYS = ['grit', 'stamina', 'info', 'analysis', 'network'] as const satisfies readonly StatKey[]
const SPEAKERS = ['daebak', 'cho', 'kim', 'mom'] as const

// 타깃 형식(market / sector:X / stock:X)만 확인한다. 실존 여부는 기존 테스트가 이미 검증한다.
function isWellFormedTarget(t: string): boolean {
  if (t === 'market') return true
  if (t.startsWith('stock:')) return t.length > 6
  if (t.startsWith('sector:')) return SECTORS.includes(t.slice(7) as Sector)
  return false
}

describe('이벤트 콘텐츠', () => {
  it('60종 이상이고 id가 유일하다', () => {
    expect(events.length).toBeGreaterThanOrEqual(60)
    expect(new Set(events.map(e => e.id)).size).toBe(events.length)
  })
  it('5개 카테고리가 모두 있다', () => {
    for (const c of ['news', 'company', 'personal', 'social', 'story']) {
      expect(events.some(e => e.category === c)).toBe(true)
    }
  })
  it('weight가 양수다', () => events.forEach(e => expect(e.weight).toBeGreaterThan(0)))
  it('제목·본문이 비어있지 않다', () => {
    events.forEach(e => { expect(e.text.title.length).toBeGreaterThan(0); expect(e.text.body.length).toBeGreaterThan(0) })
  })
  it('impact 타깃이 실존한다', () => {
    events.forEach(e => {
      const t = e.impact?.target
      if (!t || t === 'market') return
      if (t.startsWith('stock:')) expect(stockIds.has(t.slice(6))).toBe(true)
      else if (t.startsWith('sector:')) expect(SECTORS).toContain(t.slice(7) as Sector)
      else throw new Error(`잘못된 타깃: ${t}`)
    })
  })
  it('effects의 종목 참조가 실존한다', () => {
    const all = events.flatMap(e => [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)])
    all.forEach(f => {
      if (f.type === 'buyStockPct' || f.type === 'fundamentalMul') expect(stockIds.has(f.stockId)).toBe(true)
      if (f.type === 'impact' && f.target.startsWith('stock:')) expect(stockIds.has(f.target.slice(6))).toBe(true)
    })
  })
  it('선택지는 2개 이상이다', () => {
    events.filter(e => e.choices).forEach(e => expect(e.choices!.length).toBeGreaterThanOrEqual(2))
  })
  it('김실장·엄마·최존버·퇴사 플래그가 존재한다', () => {
    const keys = new Set(events.flatMap(e => [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)])
      .filter(f => f.type === 'flag').map(f => (f as { key: string }).key))
    for (const k of ['kim', 'momIgnored', 'choSaid', 'retired']) expect(keys.has(k)).toBe(true)
  })
  it('퇴사 이벤트가 정확히 하나이고 oneShot이다', () => {
    const r = events.filter(e => [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)].some(f => f.type === 'retire'))
    expect(r).toHaveLength(1)
    expect(r[0]!.oneShot).toBe(true)
    expect(r[0]!.conditions).toEqual(expect.arrayContaining([
      { type: 'assetsMin', value: 300_000_000 }, { type: 'turnMin', value: 60 },
    ]))
  })
  it('1턴 주린이 상태에서도 뽑을 이벤트가 있다', () => {
    const s = drawEvents(makeState(), events)
    expect(s.news.length).toBeGreaterThan(0)
  })
  it('156턴 전체를 돌려도 예외가 없다', () => {
    let s = makeState()
    for (let t = 1; t <= 156; t++) { s = drawEvents({ ...s, turn: t }, events); s = { ...s, pendingChoices: [] } }
    expect(s.news.length).toBeGreaterThan(50)
  })


  // ── 김실장이 신용 창구를 연다 (st_kim_credit) ──────────────────────────────
  // 신용거래는 core에 다 구현돼 있었는데 부르는 화면이 없었고(그래서 화면 쪽에 계좌
  // 신용 섹션이 생겼다), 그 창구의 존재를 알리는 연출이 이 이벤트다. 조건은 티어
  // 3(BALANCE.loan.minTier)뿐이라, 신용을 실제로 쓸 수 있게 된 바로 그 주부터 뜬다.
  describe('신용 창구를 여는 이벤트', () => {
    const kimCredit = events.find(e => e.id === 'st_kim_credit')!

    it('존재하고, 김실장이 말하며, 한 번만 뜬다', () => {
      expect(kimCredit).toBeDefined()
      expect(kimCredit.oneShot).toBe(true)
      expect(kimCredit.text.speaker).toBe('kim')
      expect(kimCredit.category).toBe('story')
    })

    it('조건이 신용 최소 티어와 같은 값에 걸려 있다', () => {
      // 리터럴 3이 아니라 BALANCE에서 읽는다 — 신용 티어를 옮기면 이 단언이 먼저 깨져
      // 이벤트와 규칙이 갈라진 것을 알려준다.
      expect(kimCredit.conditions).toEqual([{ type: 'tierMin', value: BALANCE.loan.minTier }])
    })

    it('티어 0~2에서는 후보에조차 오르지 않고, 3~5에서는 오른다', () => {
      for (const tier of [0, 1, 2] as const) {
        expect(evalAll(makeState({ player: { tier } }), kimCredit.conditions), `tier ${tier}`).toBe(false)
      }
      for (const tier of [3, 4, 5] as const) {
        expect(evalAll(makeState({ player: { tier } }), kimCredit.conditions), `tier ${tier}`).toBe(true)
      }
    })

    it('티어 3에 도달하면 실제로 뽑힌다 — 여러 시드에서 몇 주 안에 뜬다', () => {
      // drawEvents는 매 턴 가중추첨으로 2개를 뽑으므로 "정확히 그 주"를 보장할 수는
      // 없다. 대신 풀 전체에서 가장 큰 weight를 줘서 곧 뜨게 만들었다 — 그 사실을
      // 시드별 실측으로 못박는다(문 여는 연출이 몇 달 뒤에 오면 연출이 아니다).
      const waits: number[] = []
      for (let seed = 1; seed <= 20; seed++) {
        let s = makeState({ player: { tier: 3 }, rng: { s: seed } })
        let fired = -1
        for (let t = 1; t <= 15 && fired < 0; t++) {
          s = drawEvents({ ...s, turn: t, pendingChoices: [] }, events)
          if (s.firedOneShots.includes('st_kim_credit')) fired = t
        }
        expect(fired, `seed ${seed}: 15주 안에 뜨지 않았다`).toBeGreaterThan(0)
        waits.push(fired)
      }
      // 중앙값 3주 이하. weight를 풀의 평범한 값(예: 20)으로 낮추면 중앙값이 7주 부근으로
      // 밀려 여기서 걸린다 — 300시드 실측: weight 40 → 중앙값 4·최대 40주 초과,
      // weight 120 → 중앙값 2·최대 10주.
      const median = [...waits].sort((a, b) => a - b)[Math.floor(waits.length / 2)]!
      expect(median, `대기 주차 ${waits.join(',')}`).toBeLessThanOrEqual(3)
    })

    it('티어 3이어도 이미 떴으면 다시 뜨지 않는다 (oneShot)', () => {
      let s = makeState({ player: { tier: 3 }, rng: { s: 1 }, firedOneShots: ['st_kim_credit'] })
      for (let t = 1; t <= 20; t++) s = drawEvents({ ...s, turn: t, pendingChoices: [] }, events)
      expect(s.news.filter(n => n.title === kimCredit.text.title)).toEqual([])
    })

    it('선택지 둘 다 효과가 있고, 빚을 강요하지도 막지도 않는다', () => {
      // 이 이벤트는 문을 열 뿐 대출 자체를 일으키지 않는다 — 돈을 직접 움직이는
      // 효과(cash·buyStockPct)가 붙어 있으면 플레이어의 판단을 대신 내려버린다.
      expect(kimCredit.choices).toHaveLength(2)
      for (const c of kimCredit.choices!) {
        expect(c.effects.length, c.label).toBeGreaterThan(0)
        for (const f of c.effects) expect(['cash', 'buyStockPct']).not.toContain(f.type)
      }
    })
  })

  // ── 임팩트 채널 균형 (Fix Round 1) ─────────────────────────────────────────
  // 주가를 움직이는 가장 큰 항은 국면 드리프트가 아니라 이벤트 임팩트다. 그 채널이
  // 한쪽으로 기울어 있으면 BALANCE를 아무리 튜닝해도 시장이 그쪽으로 끌려간다.
  // 실제로 그랬다: market 채널의 가중합이 -2.36(턴당 -0.009 상당)이라 국면 드리프트
  // (+0.0014)의 몇 배로 시장을 끌어내렸고, fundamentalMul이 종목별로 한 방향으로만
  // 존재해 청람소재(ecp)는 300시드 전부에서 -50% 이하로 끝났다.
  // 아래 테스트들은 그 편향이 되돌아오는 것을 데이터 수준에서 막는다.
  describe('임팩트 채널 균형', () => {
    type Ch = { w: number; wm: number; pos: number; neg: number }
    /** target -> 가중치·가중합·양/음 이벤트 수. 선택지 안의 임팩트는 선택 확률(1/n)로 나눈다. */
    function impactChannels(): Map<string, Ch> {
      const m = new Map<string, Ch>()
      const add = (t: string, mag: number, w: number) => {
        const c = m.get(t) ?? { w: 0, wm: 0, pos: 0, neg: 0 }
        c.w += w; c.wm += w * mag
        if (mag > 0) c.pos++; else if (mag < 0) c.neg++
        m.set(t, c)
      }
      for (const e of events) {
        if (e.impact) add(e.impact.target, e.impact.magnitude, e.weight)
        for (const f of e.effects ?? []) if (f.type === 'impact') add(f.target, f.magnitude, e.weight)
        const n = e.choices?.length ?? 0
        for (const c of e.choices ?? []) for (const f of c.effects) if (f.type === 'impact') add(f.target, f.magnitude, e.weight / n)
      }
      return m
    }

    it('market 채널이 한쪽으로 기울어 있지 않다', () => {
      const c = impactChannels().get('market')!
      expect(c).toBeDefined()
      // 가중 평균 임팩트. 튜닝 전 데이터는 -0.0375였다(= -2.360 / 63).
      const mean = c.wm / c.w
      expect(Math.abs(mean), `market 가중평균 ${mean.toFixed(4)}`).toBeLessThan(0.008)
      expect(c.pos).toBeGreaterThan(0)
      expect(c.neg).toBeGreaterThan(0)
    })

    it('모든 sector·stock 임팩트 채널에 양방향 이벤트가 있고 가중평균이 0 근처다', () => {
      const bad: string[] = []
      for (const [target, c] of impactChannels()) {
        if (target === 'market') continue
        if (c.pos === 0) bad.push(`${target}: 상승 이벤트 없음 (하락만 ${c.neg}건)`)
        if (c.neg === 0) bad.push(`${target}: 하락 이벤트 없음 (상승만 ${c.pos}건)`)
        const mean = c.wm / c.w
        if (Math.abs(mean) > 0.045) bad.push(`${target}: 가중평균 ${mean.toFixed(4)}`)
      }
      expect(bad).toEqual([])
    })

    it('fundamentalMul이 종목마다 양방향으로 짝지어져 있다', () => {
      // 한 방향으로만 있으면 그 종목의 적정가가 시드와 무관하게 확정적으로 오르거나 깎인다.
      const per = new Map<string, { up: number; down: number; wl: number; w: number }>()
      for (const e of events) {
        const all = [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)]
        for (const f of all) {
          if (f.type !== 'fundamentalMul') continue
          const c = per.get(f.stockId) ?? { up: 0, down: 0, wl: 0, w: 0 }
          if (f.value > 1) c.up++; else if (f.value < 1) c.down++
          c.wl += e.weight * Math.log(f.value); c.w += e.weight
          per.set(f.stockId, c)
        }
      }
      expect(per.size).toBeGreaterThan(0)
      const bad: string[] = []
      for (const [id, c] of per) {
        if (c.up === 0) bad.push(`${id}: 적정가 상승 이벤트 없음`)
        if (c.down === 0) bad.push(`${id}: 적정가 하락 이벤트 없음`)
        const mean = c.wl / c.w
        if (Math.abs(mean) > 0.01) bad.push(`${id}: log 가중평균 ${mean.toFixed(4)}`)
      }
      expect(bad).toEqual([])
    })
  })

  // ── 60종 규모에서 `as EventDef[]` 캐스팅은 아무것도 검증하지 않는다 — 이전 두 태스크(cards.json, stocks.json)와
  // 같은 문제라서 같은 방식으로 고정한다. 이벤트를 순회하며 문제를 bad[]에 모으고, 한 번의 expect로
  // 실패 시 어떤 이벤트·어떤 필드가 문제인지 메시지에 그대로 남긴다.
  describe('이벤트 데이터 유효성 (as EventDef[] 캐스팅은 아무것도 검증하지 않으므로 직접 검증한다)', () => {
    it('id가 비어있지 않다', () => {
      const bad = events.filter(e => e.id.length === 0).map(e => e.id)
      expect(bad).toEqual([])
    })
    it('category가 알려진 값이다', () => {
      const bad: string[] = []
      for (const e of events) if (!CATEGORIES.includes(e.category)) bad.push(`${e.id}: 알 수 없는 category "${e.category}"`)
      expect(bad).toEqual([])
    })
    it('weight가 유한한 양수다', () => {
      const bad: string[] = []
      for (const e of events) if (!Number.isFinite(e.weight) || e.weight <= 0) bad.push(`${e.id}: weight ${e.weight}`)
      expect(bad).toEqual([])
    })
    it('speaker가 있다면 알려진 화자(daebak/cho/kim/mom)다', () => {
      const bad: string[] = []
      for (const e of events) {
        const sp = e.text.speaker
        if (sp !== undefined && !(SPEAKERS as readonly string[]).includes(sp)) bad.push(`${e.id}: 알 수 없는 speaker "${sp}"`)
      }
      expect(bad).toEqual([])
    })
    it('conditions[].type이 알려진 Condition 타입이고, statMin.stat이 알려진 StatKey다', () => {
      const bad: string[] = []
      for (const e of events) {
        for (const c of e.conditions ?? []) {
          if (!CONDITION_TYPES.includes(c.type)) bad.push(`${e.id}: 알 수 없는 condition.type "${c.type}"`)
          if (c.type === 'statMin' && !STAT_KEYS.includes(c.stat)) bad.push(`${e.id}: 알 수 없는 statMin.stat "${c.stat}"`)
        }
      }
      expect(bad).toEqual([])
    })
    it('top-level impact의 target 형식이 올바르고 delay가 0~3이다', () => {
      const bad: string[] = []
      for (const e of events) {
        if (!e.impact) continue
        if (!isWellFormedTarget(e.impact.target)) bad.push(`${e.id}: 잘못된 impact.target "${e.impact.target}"`)
        if (![0, 1, 2, 3].includes(e.impact.delay)) bad.push(`${e.id}: 잘못된 impact.delay ${e.impact.delay}`)
      }
      expect(bad).toEqual([])
    })
    it('effects/choices[].effects의 type이 알려진 Effect 타입이다', () => {
      const bad: string[] = []
      for (const e of events) {
        const all: Effect[] = [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)]
        for (const f of all) if (!EFFECT_TYPES.includes(f.type)) bad.push(`${e.id}: 알 수 없는 effect.type "${f.type}"`)
      }
      expect(bad).toEqual([])
    })
    it('stat 효과의 stat이 알려진 StatKey다', () => {
      const bad: string[] = []
      for (const e of events) {
        const all: Effect[] = [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)]
        for (const f of all) if (f.type === 'stat' && !STAT_KEYS.includes(f.stat)) bad.push(`${e.id}: 알 수 없는 stat "${f.stat}"`)
      }
      expect(bad).toEqual([])
    })
    it('impact 효과(선택지 안)의 target 형식이 올바르고 delay가 0~3이며 title이 비어있지 않다', () => {
      const bad: string[] = []
      for (const e of events) {
        const all: Effect[] = [...(e.effects ?? []), ...(e.choices ?? []).flatMap(c => c.effects)]
        for (const f of all) {
          if (f.type !== 'impact') continue
          if (!isWellFormedTarget(f.target)) bad.push(`${e.id}: 잘못된 impact.target "${f.target}"`)
          if (![0, 1, 2, 3].includes(f.delay)) bad.push(`${e.id}: 잘못된 impact.delay ${f.delay}`)
          if (f.title.length === 0) bad.push(`${e.id}: 빈 impact.title`)
        }
      }
      expect(bad).toEqual([])
    })
    it('choices가 있으면 top-level effects와 함께 쓰지 않는다 (죽은 effects 방지)', () => {
      const bad = events.filter(e => e.choices?.length && e.effects).map(e => e.id)
      expect(bad).toEqual([])
    })
  })
})

/**
 * 리뷰 Fix Round 1 (Major 1~3): "N종이 서로 다르게 보인다"를 테스트로 고정하기 위한
 * 공용 헬퍼. 렌더된 svg의 "의미 있는 지문"을 뽑아 비교한다 — 픽셀 스냅샷은 사소한
 * 변경마다 깨져 결국 무시되므로 쓰지 않는다(리뷰 지시).
 *
 * 지문은 세 축으로 구성한다:
 *  - colors: fill/stroke/stop-color에 실제로 쓰인 색상 값의 정렬된 집합. `url(#...)`
 *    참조(그라디언트를 가리키는 자리표시자)는 값이 아니므로 제외하고, useId()로 렌더마다
 *    바뀌는 gradientId 자체는 애초에 색 속성이 아니라서 여기 안 잡힌다 — 그래서 같은
 *    컴포넌트를 두 번 렌더해도(예: 도감 목록+상세) 지문은 안정적이다.
 *  - shapeCounts: 태그별(path/rect/circle/ellipse/polygon/line) 요소 개수 — 소품이
 *    실제로 추가/제거됐는지(Ruling 57과 같은 신호, 예: npc.*.alt의 링 rect 유무)를 잡는다.
 *  - texts: <text> 요소들의 textContent를 순서대로 이어붙인 것 — 라벨/글리프가 실제로
 *    다르게 그려지는지 잡는다. `excludeSelector`로 특정 <text>를 지문에서 뺄 수 있다
 *    (엔딩처럼 "설명 라벨은 이미 다른 테스트가 보장하니, 시각 정체성인 glyph/tone만으로
 *    구별을 판정하고 싶을 때" 쓴다 — Scenes.tsx의 data-role="label"이 그 훅이다).
 *
 * "충분히 다르다"의 기준: N개의 지문을 signatureOf로 정규화한 뒤, 그 문자열이 N개 전부
 * 서로 달라야 한다(Set 크기 == N). Task 9는 등급색 6종에 연속값 색거리(문턱 30)를 썼지만,
 * 여기서는 비교 대상이 "같은 컴포넌트를 다른 인자로 호출한 결과"라 값 자체가 이산적이다
 * (다른 hex 색, 다른 이모지, 다른 도형 개수) — 인자가 그대로 새면(뮤테이션으로 하드코딩
 * 되면) 산출물 지문이 100% 동일해지고, 정상이라면 인자가 다른 이상 지문의 최소 한 축은
 * 반드시 달라진다. 그래서 "완전 동일 여부"가 여기서는 올바른 문턱이다 — 연속값처럼
 * "얼마나 다른가"를 잴 여지가 없다.
 */
export interface ArtFingerprint {
  colors: string[]
  shapeCounts: Record<string, number>
  texts: string
}

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color']
const SHAPE_TAGS = ['path', 'rect', 'circle', 'ellipse', 'polygon', 'line']

export function fingerprintOf(root: Element, opts?: { excludeSelector?: string }): ArtFingerprint {
  const colors = new Set<string>()
  root.querySelectorAll('*').forEach(el => {
    for (const attr of COLOR_ATTRS) {
      const v = el.getAttribute(attr)
      if (v && v !== 'none' && !v.startsWith('url(')) colors.add(v.toLowerCase())
    }
  })
  const shapeCounts: Record<string, number> = {}
  for (const tag of SHAPE_TAGS) {
    const n = root.querySelectorAll(tag).length
    if (n > 0) shapeCounts[tag] = n
  }
  const textEls = Array.from(root.querySelectorAll('text')).filter(
    t => !opts?.excludeSelector || !t.matches(opts.excludeSelector),
  )
  const texts = textEls.map(t => (t.textContent ?? '').trim()).join('|')
  return { colors: Array.from(colors).sort(), shapeCounts, texts }
}

/** 두 지문이 완전히 같은 문자열이 되는 것은 원본 렌더 결과가 (색/도형개수/텍스트 축에서)
 *  완전히 동일할 때뿐이다 — 순서가 안정적인 직렬화라 지문 비교를 문자열 Set 비교로 줄일
 *  수 있다. */
export function signatureOf(fp: ArtFingerprint): string {
  const shapeKeys = Object.keys(fp.shapeCounts).sort()
  const shapePart = shapeKeys.map(k => `${k}:${fp.shapeCounts[k]}`).join(',')
  return `${fp.colors.join(',')}||${shapePart}||${fp.texts}`
}

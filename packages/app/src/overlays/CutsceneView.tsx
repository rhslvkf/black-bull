import { useGame } from '../store/store'
import { Art } from '../art/Art'
import { DialogueBox } from './DialogueBox'
import { PROMOTE_TIERS, DEMOTE_TIERS, TIER_NAMES, type ArtKey } from '../art/keys'
import { prefersReducedMotion, DUR_SLOW } from '../design/motion'
import { TOUCH_TARGET_PX } from '../design/layout'

// 나레이션 한 줄. 화자가 없는 VN 대화창(DialogueBox의 speaker=null 규약, Task 17)으로
// 그대로 흘려보낸다 — 새 컴포넌트를 만들지 않는다.
const LINES: Record<string, string> = {
  'cutscene.promote.1': '드디어 1주가 아니라 10주씩 산다.',
  'cutscene.promote.2': '이제 코스닥이 보인다. 보이면 안 되는데.',
  'cutscene.promote.3': '최존버가 처음으로 말을 걸었다. "조심해."',
  'cutscene.promote.4': '숫자가 현실감을 잃기 시작한다.',
  'cutscene.promote.5': '이제 내가 사면 오른다. 그게 제일 무섭다.',
  'cutscene.demote.0': '처음으로 돌아왔다. 시간만 썼다.',
  'cutscene.demote.1': '박대박한테서 카톡이 왔다. "괜찮냐?"',
  'cutscene.demote.2': '계좌를 안 열어본 지 나흘째다.',
  'cutscene.demote.3': '올라갈 때보다 내려올 때가 훨씬 빠르다.',
  'cutscene.demote.4': '한 단계 아래로 밀려났다. 다시 처음부터.',
}

/**
 * `kind`·`tier`가 실제 registry의 컷신 아트 키(art/keys.ts §5: cutscene.promote.{1..5} +
 * cutscene.demote.{0..4} 10종)와 대응하면 그 키를, 아니면 `null`을 돌려준다.
 *
 * 리뷰 Fix Round 1(Major) — 이전엔 `Set.has()` 기반 타입가드(`x is ArtKey`)였는데,
 * 그 가드를 "항상 true"로 망가뜨려도 `tsc`와 테스트 556개 전부 통과했다: `x is ArtKey`
 * 단언 자체가 컴파일러에게 "믿어달라"고 말하는 것이라, 가드 본문이 실제로 무엇을
 * 검사하는지와 무관하게 타입 체크를 통과시켜 버린다 — `as` 캐스트를 없앤 자리에
 * 사실상 같은 종류의 구멍을 다시 만든 셈이었다.
 *
 * 이번엔 타입 단언을 아예 쓰지 않는다: `PROMOTE_TIERS`/`DEMOTE_TIERS`(art/keys.ts의
 * 리터럴 튜플 `[1,2,3,4,5]`·`[0,1,2,3,4]`, `as const`로 각 원소가 리터럴 타입이다)를
 * 순회하며 실제 `tier`와 비교하고, **일치가 확인된 반복 변수 `t` 그대로**로 템플릿
 * 문자열을 만든다. `t`는 그 순회 안에서 리터럴 유니온(`1|2|3|4|5` 등)으로 타입되므로
 * `` `cutscene.promote.${t}` ``의 타입을 TypeScript가 ArtKey의 해당 분기와 정확히
 * 같은 리터럴 유니온으로 스스로 추론한다 — 캐스트도 `x is ArtKey` 단언도 필요 없다.
 * 이 함수를 "비교 없이 항상 매칭되게" 망가뜨리면 `tier`(넓은 `number`)가 그대로
 * 템플릿에 들어가 `` `cutscene.promote.${number}` ``가 되어 ArtKey에 대입할 수 없다
 * — 즉 가드를 무력화하는 순간 **컴파일 자체가 깨진다**(`tsc --noEmit`이 잡는다).
 */
function cutsceneArtKey(kind: 'promote' | 'demote', tier: number): ArtKey | null {
  if (kind === 'promote') {
    for (const t of PROMOTE_TIERS) if (t === tier) return `cutscene.promote.${t}`
  } else {
    for (const t of DEMOTE_TIERS) if (t === tier) return `cutscene.demote.${t}`
  }
  return null
}

interface ParsedCutscene { kind: 'promote' | 'demote'; tier: number }
/** `GameState.cutscene`은 core에서 평범한 string으로 온다(types.ts 주석: "ArtKey 문자열").
 *  제목·톤은 아트 키 유효성과 무관하게 이 정규식 하나로 유도한다 — economy.ts의
 *  settleTier가 만드는 형태(`cutscene.<kind>.<tier>`)와 일치해야 한다. */
function parseCutscene(id: string): ParsedCutscene | null {
  const m = /^cutscene\.(promote|demote)\.(\d+)$/.exec(id)
  if (!m) return null
  const kind = m[1] === 'promote' ? 'promote' : 'demote'
  return { kind, tier: Number(m[2]) }
}

/**
 * 티어 승급·강등 컷신(§4.3). "배경이 바뀌는 연출"은 registry.tsx의 makeScene이 승급/
 * 강등마다 다른 색조(초록/적갈)로 이미 그린다 — 여기서는 그 톤을 `data-tone`으로도
 * 노출해(승급="up"/강등="down") CSS가 오버레이 전체 배경까지 같은 톤으로 물들일 수
 * 있게 한다.
 *
 * MU1/MU2 — 제목은 반드시 `@bb/core`가 내보내는 `TIER_NAMES`(art/keys.ts 재수출)에서
 * 유도한다. app이 티어 이름을 로컬로 다시 적으면(1차 개발의 반복 결함) 이 파일과 core가
 * 갈라질 수 있다.
 */
export function CutsceneView() {
  const s = useGame(st => st.state)
  const clear = useGame(st => st.clearCutscene)
  const cutscene = s?.cutscene ?? null
  if (!cutscene) return null

  const parsed = parseCutscene(cutscene)
  if (!parsed) return null // 방어적: core는 이 형태가 아닌 값을 절대 만들지 않는다

  const title = TIER_NAMES[parsed.tier] ?? ''
  const tone = parsed.kind === 'promote' ? 'up' : 'down'
  const line = LINES[cutscene] ?? ''
  const artKey = cutsceneArtKey(parsed.kind, parsed.tier)

  // §6 "화면 전환 — 컷신 크로스페이드". prefers-reduced-motion이면 즉시 나타난다.
  // jsdom은 외부 CSS(@media 포함)를 읽지 않으므로(Ruling 20, ChoiceSheet.tsx와 같은 기법)
  // 인라인 style로 내려 실측 가능하게 한다.
  //
  // **이 애니메이션은 바깥 `.overlay.cutscene`(data-testid="cutscene")이 아니라 안쪽
  // `.cutscene-content` 래퍼에 건다.** 바깥 요소는 완전 불투명 장면 배경(Ruling 28 —
  // overlays.test.tsx가 알파 채널을 전혀 안 쓰는지 CSS 소스 텍스트로 고정한다)인데,
  // opacity 크로스페이드를 그 요소 자체에 걸면(과거 이 자리에 있던 코드) 배경까지
  // 함께 투명해지는 동안 뒤(홈 HUD·탭바)가 비친다 — 소스 텍스트 검사는 인라인 style을
  // 못 보므로 이 회귀를 못 잡는다(index.css의 `.cutscene-content` 주석 참고). 배경이
  // 없는 안쪽 래퍼로 옮기면 배경은 항상 즉시 불투명한 채로, 그 위 내용만 크로스페이드로
  // 나타난다 — 시각적 효과(장면이 부드럽게 드러난다)는 그대로 유지된다.
  const animation = prefersReducedMotion() ? 'none' : `cutscene-crossfade ${DUR_SLOW}ms ease-out`

  return (
    <div
      key={cutscene}
      className="overlay cutscene"
      data-testid="cutscene"
      data-tone={tone}
    >
      <div className="cutscene-content" data-testid="cutscene-content" style={{ animation }}>
        <h3 className="cutscene-title" data-testid="cutscene-title">{title}</h3>

        <div className="cutscene-stage" data-testid="cutscene-stage">
          {artKey && <Art id={artKey} size={260} />}
        </div>

        <DialogueBox speaker={null} text={line} onAdvance={clear} />

        <button
          type="button"
          className="primary"
          data-testid="cutscene-close"
          style={{ minHeight: TOUCH_TARGET_PX, minWidth: TOUCH_TARGET_PX }}
          onClick={clear}
        >
          계속
        </button>
      </div>
    </div>
  )
}

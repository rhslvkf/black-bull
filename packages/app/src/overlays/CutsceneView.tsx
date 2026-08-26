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

// art/keys.ts §5 컷신 키 계약: cutscene.promote.{1..5} + cutscene.demote.{0..4} 10종뿐이다.
// PROMOTE_TIERS/DEMOTE_TIERS에서 그대로 유도한다 — 숫자 범위를 여기 다시 적으면(1차
// 개발의 반복 결함인 상수 복제) registry.test.tsx의 'settleTier 컷신 키 정합성'과
// 어긋날 여지가 생긴다.
const CUTSCENE_ART_KEYS: ReadonlySet<string> = new Set([
  ...PROMOTE_TIERS.map(t => `cutscene.promote.${t}`),
  ...DEMOTE_TIERS.map(t => `cutscene.demote.${t}`),
])
/** `as ArtKey` 없이 string을 컷신 아트 키로 좁히는 유일한 통로(art/keys.ts NPC_ID_BY_NAME_KO의
 *  isNpcId, EventModal의 isNpcName과 같은 기법). 존재하지 않는 키(MU11)는 여기서 걸러져
 *  <Art>에 도달하지 않는다 — Art.tsx는 모르는 id에 대해 조용히 null을 반환하므로, 이
 *  가드가 없으면 "빈 화면"이 곧 폴백처럼 보이는 사고가 난다. */
function isCutsceneArtKey(x: string): x is ArtKey {
  return CUTSCENE_ART_KEYS.has(x)
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

  // §6 "화면 전환 — 컷신 크로스페이드". prefers-reduced-motion이면 즉시 나타난다.
  // jsdom은 외부 CSS(@media 포함)를 읽지 않으므로(Ruling 20, ChoiceSheet.tsx와 같은 기법)
  // 인라인 style로 내려 실측 가능하게 한다.
  const animation = prefersReducedMotion() ? 'none' : `cutscene-crossfade ${DUR_SLOW}ms ease-out`

  return (
    <div
      key={cutscene}
      className="overlay cutscene"
      data-testid="cutscene"
      data-tone={tone}
      style={{ animation }}
    >
      <h3 className="cutscene-title" data-testid="cutscene-title">{title}</h3>

      <div className="cutscene-stage" data-testid="cutscene-stage">
        {isCutsceneArtKey(cutscene) && <Art id={cutscene} size={260} />}
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
  )
}

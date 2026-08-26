import type { Mood, Tier } from '@bb/core'
import { investmentRoi, isShaken, moodOf, TIER_NAMES } from '@bb/core'
import { useGame } from '../store/store'
import { ArtSlot } from '../art/slots'
import type { ArtKey } from '../art/keys'
import { pct } from '../format'

/**
 * 스펙 §3.1 캐릭터 스테이지의 높이 예산(260px) — **정의는 여기 한 곳뿐**이다.
 * jsdom은 외부 CSS를 읽지 않으므로(테스트가 `getComputedStyle`로 이 값을 실측하려면)
 * 이 상수를 인라인 스타일로 내려써야 한다. CSS 쪽에 같은 숫자를 다시 적지 않는다 —
 * 값을 두 곳에 두면 하나만 바뀌었을 때 화면과 테스트가 서로 다른 값을 보게 된다.
 */
export const CHARACTER_STAGE_HEIGHT_PX = 260

/** 홈 화면은 항상 '집'이 배경이다. §5 bg.* 4종(office/home/street/exchange) 중 이
 *  스테이지가 그리는 장면은 하나로 고정돼 있고, 게임 상태에 따라 바뀌지 않는다. */
const HOME_BACKGROUND: ArtKey = 'bg.home'

// 템플릿 리터럴로 키를 조립하면 결과 타입이 `string`이라 `ArtKey`(리터럴 유니온)에
// 대입하려면 `as` 단언이 필요해진다(예전 HomeScreen.tsx가 그렇게 했었다 — 전역 제약
// 위반). 대신 6티어 × 3무드 = 18개 리터럴을 전부 적어 테이블로 못박는다 — 오타가 있으면
// `Record<Tier, Record<Mood, ArtKey>>` 타입 검사에서 그 자리가 바로 걸린다.
const CHAR_ART_KEYS: Record<Tier, Record<Mood, ArtKey>> = {
  0: { normal: 'char.tier0.normal', shaken: 'char.tier0.shaken', joy: 'char.tier0.joy' },
  1: { normal: 'char.tier1.normal', shaken: 'char.tier1.shaken', joy: 'char.tier1.joy' },
  2: { normal: 'char.tier2.normal', shaken: 'char.tier2.shaken', joy: 'char.tier2.joy' },
  3: { normal: 'char.tier3.normal', shaken: 'char.tier3.shaken', joy: 'char.tier3.joy' },
  4: { normal: 'char.tier4.normal', shaken: 'char.tier4.shaken', joy: 'char.tier4.joy' },
  5: { normal: 'char.tier5.normal', shaken: 'char.tier5.shaken', joy: 'char.tier5.joy' },
}

/**
 * §3.1 홈 레이아웃의 캐릭터 스테이지 — 배경 레이어 + 인물 레이어 + 티어·수익률 배지.
 *
 * 표정 구간(무드)은 core의 `moodOf`가 갖는 판정을 그대로 쓴다 — 멘탈 흔들림 문턱을
 * 여기서 다시 적지 않는다(1차 개발에서 상수 복제가 반복 결함이었다). 배경·인물 두 레이어
 * 모두 `<Art>`를 직접 쓰지 않고 Task 10의 `<ArtSlot>`을 쓴다 — 이미지가 없어도 완결된
 * 화면으로 보이는 폴백 경로가 거기 있다.
 */
export function CharacterStage() {
  const s = useGame(st => st.state)
  if (!s) return null

  const shaken = isShaken(s)
  const mood = moodOf(s)
  const charKey = CHAR_ART_KEYS[s.player.tier][mood]
  const roi = investmentRoi(s)
  // Ruling 58과 같은 삼분기: 0%는 상승도 하락도 아니다. 한국 관례(상승 빨강/하락
  // 파랑)는 CSS의 'up'/'down' 클래스가 --up/--down 토큰을 통해 이미 담보한다
  // (design/tokens.test.ts) — 여기서는 그 클래스를 실제로 옳은 부호에 붙이는 것만 책임진다.
  const direction = roi > 0 ? 'up' : roi < 0 ? 'down' : 'neutral'

  return (
    <div
      className={`char-stage${shaken ? ' char-stage-shaken' : ''}`}
      data-testid="char-stage"
      style={{ height: `${CHARACTER_STAGE_HEIGHT_PX}px` }}
    >
      <div className="char-bg-layer" data-testid="char-bg" data-art-id={HOME_BACKGROUND}>
        <ArtSlot kind="background" id={HOME_BACKGROUND} className="char-bg-art" />
      </div>
      <div className="char-fg-layer" data-testid="char-slot" data-art-id={charKey}>
        <ArtSlot kind="character" id={charKey} className="char-fg-art" />
      </div>
      <div className="char-badge">
        <span className="char-badge-tier" data-testid="char-tier">{TIER_NAMES[s.player.tier]}</span>
        <span className={`char-badge-roi ${direction}`} data-testid="char-roi">{pct(roi)}</span>
      </div>
    </div>
  )
}

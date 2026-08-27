import { Art } from './Art'
import { ART, ALL_ART_KEYS, hasImage, type ArtSource } from './registry'
import type { ArtKey } from './keys'

export type SlotKind = 'character' | 'portrait' | 'background' | 'scene'

// docs §5 아트 슬롯 규격 표의 비율 열을 그대로 옮긴 것 — 종류마다 다른 값이어야 한다.
// character(char.*)/portrait(npc.*) = 3:4, background(bg.*) = 16:9, scene(cutscene.*) = 4:3.
// (ending/sector의 1:1은 이 컴포넌트가 다루는 4종에 포함되지 않는다 — 브리프의 kind 목록대로.)
const ASPECT_RATIO: Record<SlotKind, string> = {
  character: '3 / 4',
  portrait: '3 / 4',
  background: '16 / 9',
  scene: '4 / 3',
}

// registerImage/resetImages가 실제로 무엇을 되돌려야 하는지의 기준선. registry.tsx의 모듈
// top-level 루프가 이 파일이 import되는 시점에 이미 다 돌아 ART를 채워둔 상태이므로, 여기서
// 뜨는 스냅샷은 "이미지 교체가 하나도 없었던" 순정 레지스트리와 같다. ART가 이미
// `Record<ArtKey, ArtSource>`로 타입돼 있으므로(registry.tsx) 스프레드 결과도 같은 타입을
// 그대로 물려받는다 — 캐스트가 필요 없다.
const PRISTINE_ART: Readonly<Record<ArtKey, ArtSource>> = { ...ART }

/**
 * 이미지 하나를 아트 키에 등록한다. Task 23이 실제 생성 이미지를 꽂을 때 쓰는 함수다.
 * registry.tsx의 공유 `ART` 레지스트리를 직접 갱신하므로, 이미 이 키를 쓰고 있는 `<Art>`나
 * `<ArtSlot>` 어디서든 다음 렌더부터 곧바로 이미지가 보인다 — 별도의 이미지 전용 저장소를
 * 새로 만들지 않는다(ArtSource 유니온이 이미 이 자리를 위해 설계돼 있었다).
 *
 * 리뷰 Fix Round 1 (Minor 1): Task 23은 56개 컷을 손으로 하나씩 꽂는다 — id가 컴파일
 * 타임에 리터럴로 체크되지 않는 경로(동적 문자열, 매니페스트 파일 등)로 들어오면 오타
 * 하나가 조용히 무시돼 그 컷만 영영 폴백으로 남을 수 있다. ALL_ART_KEYS(레지스트리의
 * 유일한 진짜 키 목록)에 없는 id는 조용히 삼키지 않고 던진다.
 */
export function registerImage(id: ArtKey, src: string): void {
  if (!ALL_ART_KEYS.includes(id)) {
    throw new Error(`registerImage: "${id}"는 존재하지 않는 아트 키다 (ALL_ART_KEYS에 없음) — 오타를 확인해라.`)
  }
  ART[id] = { kind: 'image', src }
}

// 리뷰 Fix Round 1 (Major 4 연장): hasImage는 더 이상 이 파일에서 직접 kind==='image'를
// 비교하지 않는다 — registry.tsx의 isImageSource를 그대로 재사용해, Art.tsx가 <img>/<svg>를
// 가르는 판정과 항상 같은 함수를 호출한다(두 경로가 어긋날 수 있는 구조 자체가 없다).
export { hasImage }

/**
 * registerImage로 등록한 이미지를 전부 걷어내고 순정(svg 폴백) 상태로 되돌린다.
 * `registerImage`는 모듈 전역인 `ART`를 변형하므로, 이 정리 없이는 한 테스트에서 등록한
 * 이미지가 다음 테스트로 새어나간다 — design/testUtils.ts의 `resetMatchMediaMock`과 같은
 * 이유로 존재한다. 테스트 파일에서 `afterEach(resetImages)`로 매 테스트 뒤 호출한다.
 *
 * 리뷰 Fix Round 1 (Minor 2): `Object.keys(PRISTINE_ART)`(string[])를 순회하며
 * `ART[key as ArtKey]`로 캐스트하던 것을, 이미 ArtKey[]로 타입된 `ALL_ART_KEYS`를
 * 순회하는 것으로 바꿔 캐스트를 없앴다.
 */
export function resetImages(): void {
  for (const key of ALL_ART_KEYS) {
    ART[key] = PRISTINE_ART[key]
  }
}

/**
 * 아트 슬롯의 제1 요건(docs §5): **이미지가 없어도 완결된 화면으로 보인다.**
 * 이미지가 등록되지 않은 동안은 registry.tsx의 svg 폴백(실루엣 + 그라디언트 + 타이포그래피,
 * 종류별로 서로 다른 형태 — Ruling 57)을 그대로 보여준다. 이미지가 registerImage로 꽂히면
 * 같은 자리에서 <img>로 바뀐다 — "2레이어"란 이 폴백 레이어와 이미지 레이어가 같은 슬롯을
 * 공유하며 하나가 준비되는 즉시 다른 하나를 대체한다는 뜻이다. alt/aria-label은 이미 있는
 * ART_ALT/MOOD_KO 기계(Art.tsx)를 그대로 물려받으므로 여기서 새로 만들지 않는다.
 */
export function ArtSlot({ kind, id, className }: { kind: SlotKind; id: ArtKey; className?: string }) {
  const filled = hasImage(id)
  return (
    <div
      className={className}
      data-fallback={filled ? 'false' : 'true'}
      style={{ aspectRatio: ASPECT_RATIO[kind], width: '100%', overflow: 'hidden' }}
    >
      <Art id={id} className="art-slot-content" />
    </div>
  )
}

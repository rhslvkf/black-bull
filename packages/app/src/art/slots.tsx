import { Art } from './Art'
import { ART, type ArtSource } from './registry'
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
// 뜨는 스냅샷은 "이미지 교체가 하나도 없었던" 순정 레지스트리와 같다.
const PRISTINE_ART: Readonly<Record<string, ArtSource>> = { ...ART }

/**
 * 이미지 하나를 아트 키에 등록한다. Task 23이 실제 생성 이미지를 꽂을 때 쓰는 함수다.
 * registry.tsx의 공유 `ART` 레지스트리를 직접 갱신하므로, 이미 이 키를 쓰고 있는 `<Art>`나
 * `<ArtSlot>` 어디서든 다음 렌더부터 곧바로 이미지가 보인다 — 별도의 이미지 전용 저장소를
 * 새로 만들지 않는다(ArtSource 유니온이 이미 이 자리를 위해 설계돼 있었다).
 */
export function registerImage(id: ArtKey, src: string): void {
  ART[id] = { kind: 'image', src }
}

/** id가 실제 이미지로 교체됐는지 여부. */
export function hasImage(id: ArtKey): boolean {
  return ART[id]?.kind === 'image'
}

/**
 * registerImage로 등록한 이미지를 전부 걷어내고 순정(svg 폴백) 상태로 되돌린다.
 * `registerImage`는 모듈 전역인 `ART`를 변형하므로, 이 정리 없이는 한 테스트에서 등록한
 * 이미지가 다음 테스트로 새어나간다 — design/testUtils.ts의 `resetMatchMediaMock`과 같은
 * 이유로 존재한다. 테스트 파일에서 `afterEach(resetImages)`로 매 테스트 뒤 호출한다.
 */
export function resetImages(): void {
  for (const key of Object.keys(PRISTINE_ART)) {
    ART[key as ArtKey] = PRISTINE_ART[key]!
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

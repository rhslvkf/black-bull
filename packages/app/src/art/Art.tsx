import { ART, ART_ALT, isImageSource } from './registry'
import type { ArtKey } from './keys'

export function Art({ id, size, className }: { id: ArtKey; size?: number; className?: string }) {
  const src = ART[id]
  if (!src) return null
  // Minor #2: alt는 내부 키 문자열이 아니라 사람이 읽는 한국어 설명이어야 한다.
  // 리뷰 Fix Round 1: 이 판정은 registry.tsx의 isImageSource 하나로 slots.tsx의
  // hasImage와 통일돼 있다 — 둘이 각자 kind==='image'를 비교하는 두 번째 경로가 없다.
  if (isImageSource(src)) return <img src={src.src} alt={ART_ALT[id] ?? id} width={size} className={className} />
  const C = src.component
  return <C size={size} className={className} />
}

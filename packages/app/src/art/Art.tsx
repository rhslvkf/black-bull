import { ART, ART_ALT } from './registry'
import type { ArtKey } from './keys'

export function Art({ id, size, className }: { id: ArtKey; size?: number; className?: string }) {
  const src = ART[id]
  if (!src) return null
  // Minor #2: alt는 내부 키 문자열이 아니라 사람이 읽는 한국어 설명이어야 한다.
  if (src.kind === 'image') return <img src={src.src} alt={ART_ALT[id] ?? id} width={size} className={className} />
  const C = src.component
  return <C size={size} className={className} />
}

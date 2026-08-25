import { ART } from './registry'
import type { ArtKey } from './keys'

export function Art({ id, size, className }: { id: ArtKey; size?: number; className?: string }) {
  const src = ART[id]
  if (!src) return null
  if (src.kind === 'image') return <img src={src.src} alt={id} width={size} className={className} />
  const C = src.component
  return <C size={size} className={className} />
}

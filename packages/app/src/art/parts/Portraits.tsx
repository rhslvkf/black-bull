import type { ArtProps } from './Character'

const PALETTE: Record<string, [string, string, string]> = {
  daebak: ['#c9a227', '#3a2f10', '박'],
  cho:    ['#5b8c5a', '#16281a', '최'],
  kim:    ['#a63d40', '#2a1113', '김'],
  mom:    ['#8a6bb8', '#231a2e', '母'],
}

export function makePortrait(id: string, label: string) {
  return function Portrait({ size = 64, className }: ArtProps) {
    const [fg, bg, glyph] = PALETTE[id] ?? ['#888', '#222', '?']
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label={label}>
        <rect width="64" height="64" rx="14" fill={bg} />
        <circle cx="32" cy="26" r="12" fill={fg} />
        <path d="M12 60 q20 -18 40 0 Z" fill={fg} opacity="0.85" />
        <text x="32" y="31" textAnchor="middle" fontSize="13" fontWeight="700" fill={bg}>{glyph}</text>
      </svg>
    )
  }
}

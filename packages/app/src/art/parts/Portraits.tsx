import type { ArtProps } from './Character'

const PALETTE: Record<string, [string, string, string]> = {
  daebak: ['#c9a227', '#3a2f10', '박'],
  cho:    ['#5b8c5a', '#16281a', '최'],
  kim:    ['#a63d40', '#2a1113', '김'],
  mom:    ['#8a6bb8', '#231a2e', '母'],
}

// Task 10: 조연 초상은 화자당 두 무드(normal/alt)로 나뉜다(docs §5). 인물 자체는 색·이니셜로
// 식별되므로 그대로 두고, 'alt'에는 얇은 링을 더해 "같은 인물의 다른 모습"임을 표시한다 —
// 링을 빼면 normal과 alt가 완전히 같은 마크업이 되어 두 슬롯을 구분할 수 없어진다.
export function makePortrait(id: string, mood: 'normal' | 'alt', label: string) {
  return function Portrait({ size = 64, className }: ArtProps) {
    const [fg, bg, glyph] = PALETTE[id] ?? ['#888', '#222', '?']
    const isAlt = mood === 'alt'
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label={label}>
        <rect width="64" height="64" rx="14" fill={bg} />
        {isAlt && <rect x="2.5" y="2.5" width="59" height="59" rx="12" fill="none" stroke={fg} strokeWidth="2" opacity="0.7" />}
        <circle cx="32" cy="26" r="12" fill={fg} opacity={isAlt ? 0.8 : 1} />
        <path d="M12 60 q20 -18 40 0 Z" fill={fg} opacity="0.85" />
        <text x="32" y="31" textAnchor="middle" fontSize="13" fontWeight="700" fill={bg}>{glyph}</text>
      </svg>
    )
  }
}

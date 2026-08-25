import type { ArtProps } from './Character'

/** 컷신·엔딩·섹터·UI를 공통 배지로 그린다. 색·기호만 달라진다. */
export function makeScene(tone: string, glyph: string, label: string) {
  return function Scene({ size = 160, className }: ArtProps) {
    return (
      <svg viewBox="0 0 160 100" width={size} height={size * 0.625} className={className} role="img" aria-label={label}>
        <defs>
          <linearGradient id={`g-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0d1117" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect width="160" height="100" rx="12" fill={`url(#g-${label})`} />
        <text x="80" y="52" textAnchor="middle" fontSize="30">{glyph}</text>
        <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#e6edf3" opacity="0.9">{label}</text>
      </svg>
    )
  }
}

export function makeIcon(glyph: string, label: string) {
  return function Icon({ size = 20, className }: ArtProps) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} role="img" aria-label={label}>
        <text x="12" y="18" textAnchor="middle" fontSize="16">{glyph}</text>
      </svg>
    )
  }
}

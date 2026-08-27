import { useId } from 'react'
import type { ArtProps } from './Character'

// Minor #1: id를 텍스트 라벨에서 파생시키면, 같은 아트 키가 한 화면에 두 번 렌더될 때
// (예: 도감 목록 + 상세 패널 동시 표시) <linearGradient id>가 DOM에 중복돼 유효하지 않은
// HTML이 된다. React useId()는 렌더 인스턴스마다 고유하므로 같은 키를 몇 번 렌더해도
// 절대 충돌하지 않는다.
/** 컷신·엔딩·섹터·UI를 공통 배지로 그린다. 색·기호만 달라진다. */
export function makeScene(tone: string, glyph: string, label: string) {
  return function Scene({ size = 160, className }: ArtProps) {
    const gradientId = `art-scene-gradient-${useId()}`
    return (
      <svg viewBox="0 0 160 100" width={size} height={size * 0.625} className={className} role="img" aria-label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={tone} stopOpacity="0.85" />
            <stop offset="100%" stopColor="#0d1117" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <rect width="160" height="100" rx="12" fill={`url(#${gradientId})`} />
        {/* data-role: 리뷰 Fix Round 1(Major 2) — glyph(시각 정체성)와 label(한국어 설명)을
            구분해야, 엔딩 8종의 "실제로 다르게 보이는가" 테스트가 이미 다른 테스트가 보장하는
            label 텍스트에 기대지 않고 tone/glyph만으로 판정할 수 있다. */}
        <text data-role="glyph" x="80" y="52" textAnchor="middle" fontSize="30">{glyph}</text>
        <text data-role="label" x="80" y="76" textAnchor="middle" fontSize="11" fill="#e6edf3" opacity="0.9">{label}</text>
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

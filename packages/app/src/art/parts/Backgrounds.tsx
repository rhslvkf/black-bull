import { useId } from 'react'
import type { ArtProps } from './Character'
import type { BACKGROUNDS } from '../keys'

type Place = (typeof BACKGROUNDS)[number]

// Task 10 / docs §5: 배경 4장(사무실·집·거리·거래소)은 16:9 전면 배경이라, makeScene의
// 작은 배지 스타일(160x100 둥근 사각형 + 이모지)을 그대로 쓰면 화면을 꽉 채웠을 때 휑해
// 보인다. Ruling 57과 같은 원칙 — 장소마다 실제로 다른 실루엣(스카이라인/지붕/도로/
// 캔들차트)을 그려서, 색만 다른 같은 사각형이 되지 않게 한다.
const BG_META: Record<Place, { top: string; bottom: string; label: string }> = {
  office: { top: '#2c3a52', bottom: '#0a0d12', label: '사무실' },
  home: { top: '#5a4326', bottom: '#150f08', label: '집' },
  street: { top: '#332a52', bottom: '#0a0d12', label: '거리' },
  exchange: { top: '#4a2e18', bottom: '#0a0d12', label: '거래소' },
}

function Silhouette({ place }: { place: Place }) {
  switch (place) {
    case 'office':
      return (
        <g className="art-silhouette" fill="#05070a">
          <path d="M12 90 L12 42 L34 42 L34 58 L56 58 L56 22 L78 22 L78 90 Z" />
          <path d="M90 90 L90 50 L110 50 L110 90 Z" />
          {[18, 40, 62, 96].map(x => (
            <rect key={x} x={x} y={70} width="5" height="6" fill="#e8c15c" opacity="0.85" />
          ))}
        </g>
      )
    case 'home':
      return (
        <g className="art-silhouette" fill="#05070a">
          <path d="M28 90 L28 54 L60 32 L92 54 L92 90 Z" />
          <rect x="74" y="18" width="7" height="18" />
          <rect x="50" y="64" width="18" height="26" fill="#e8c15c" opacity="0.6" />
        </g>
      )
    case 'street':
      return (
        <g className="art-silhouette" fill="#05070a">
          <path d="M0 90 L160 90 L98 38 L62 38 Z" opacity="0.92" />
          <rect x="16" y="28" width="4" height="62" />
          <circle cx="18" cy="26" r="5" fill="#c94b4b" />
          <rect x="136" y="28" width="4" height="62" />
          <circle cx="138" cy="26" r="5" fill="#4b7dc9" />
        </g>
      )
    case 'exchange':
      // 한국식 상승(빨강)·하락(파랑) 캔들이 뒤섞인 시황판 실루엣.
      return (
        <g className="art-silhouette">
          <rect x="22" y="58" width="12" height="32" fill="#c94b4b" />
          <rect x="42" y="38" width="12" height="52" fill="#c94b4b" />
          <rect x="62" y="66" width="12" height="24" fill="#4b7dc9" />
          <rect x="82" y="28" width="12" height="62" fill="#c94b4b" />
          <rect x="102" y="50" width="12" height="40" fill="#4b7dc9" />
          <rect x="122" y="70" width="12" height="20" fill="#4b7dc9" />
        </g>
      )
  }
}

/** label: 스크린리더용 한국어 설명(예: "배경: 사무실"). registry.tsx가 ART_ALT와 같은
 *  문자열을 넘긴다 — Minor #2/M-2와 동일한 원칙을 배경 4종에도 적용한다. */
export function makeBackground(place: Place, label: string) {
  return function Background({ size = 320, className }: ArtProps) {
    const gradientId = `art-bg-gradient-${useId()}`
    const meta = BG_META[place]
    return (
      <svg
        viewBox="0 0 160 90"
        width={size}
        height={size * (9 / 16)}
        className={className}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={meta.top} />
            <stop offset="100%" stopColor={meta.bottom} />
          </linearGradient>
        </defs>
        <rect width="160" height="90" fill={`url(#${gradientId})`} />
        <Silhouette place={place} />
        <text x="150" y="82" textAnchor="end" fontSize="10" fill="#e6edf3" opacity="0.8">
          {meta.label}
        </text>
      </svg>
    )
  }
}

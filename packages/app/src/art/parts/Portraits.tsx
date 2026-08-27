import type { ArtProps } from './Character'

const PALETTE: Record<string, [string, string, string]> = {
  daebak: ['#c9a227', '#3a2f10', '박'],
  cho:    ['#5b8c5a', '#16281a', '최'],
  kim:    ['#a63d40', '#2a1113', '김'],
  mom:    ['#8a6bb8', '#231a2e', '母'],
}

// Fix Round 1(Major) — 옛 버전은 64×64 정사각 뷰박스에 rx=14 배경판을 깔고 있었다.
// EventModal(§4.1)이 이 초상을 무대 위에 3:4 비율로 세우면서, 그 배경판이 그대로
// "장면에 붙은 둥근 카드 스티커"처럼 보인다는 리뷰 지적(실제 스크린샷으로 확인)을
// 받았다. 배경판을 걷어내고 뷰박스를 초상 슬롯의 실제 비율(3:4, art/slots.tsx의
// ASPECT_RATIO.portrait)에 맞춰, 머리·어깨·몸통 실루엣이 투명 배경 위에 곧바로
// 서게 했다 — 나중에 Task 23이 알파(투명 배경) 인물 이미지로 교체해도 같은 자리에
// 자연스럽게 설 수 있도록, 폴백부터 "배경 카드가 아니라 장면에 선 실루엣"으로
// 맞춰 둔다(§5 "폴백도 완결된 화면으로 보여야 한다"). 발밑의 옅은 접지 그림자
// (ellipse)만 남겨 "카드"가 아니라 "바닥에 선 인물"이라는 신호를 준다.
//
// 무드(normal/alt) 구분: 조연 자체는 색·이니셜로 식별되므로 그대로 두고, 'alt'에는
// 머리 둘레에 얇은 링을 더해 "같은 인물의 다른 모습"임을 표시한다 — 링을 빼면
// normal과 alt가 완전히 같은 마크업이 되어 두 슬롯을 구분할 수 없어진다.
export function makePortrait(id: string, mood: 'normal' | 'alt', label: string) {
  return function Portrait({ size = 48, className }: ArtProps) {
    const [fg, bg, glyph] = PALETTE[id] ?? ['#888', '#222', '?']
    const isAlt = mood === 'alt'
    return (
      <svg viewBox="0 0 48 64" width={size} height={size * (64 / 48)} className={className} role="img" aria-label={label}>
        <ellipse cx="24" cy="60.5" rx="15" ry="3" fill="#000" opacity="0.32" />
        <path d="M9 64 L9 39 Q24 24 39 39 L39 64 Z" fill={fg} opacity="0.85" />
        <circle cx="24" cy="19" r="13" fill={fg} opacity={isAlt ? 0.8 : 1} />
        {isAlt && <circle cx="24" cy="19" r="15.5" fill="none" stroke={fg} strokeWidth="2" opacity="0.7" />}
        <text x="24" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill={bg}>{glyph}</text>
      </svg>
    )
  }
}

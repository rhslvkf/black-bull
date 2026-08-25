export interface ArtProps { size?: number; className?: string }

const SKIN = '#f3d3b5'
/** 티어가 오를수록 옷이 나아진다. */
const OUTFIT = ['#5b6570', '#4a6fa5', '#3f7d6b', '#8a6b3f', '#6b4a8a', '#a58a3f']

// Ruling 57: 티어 승급이 색상 교체로만 보이면 게임의 핵심 성장 루프가 전달되지 않는다.
// 그래서 옷 색뿐 아니라 실루엣(소품)도 티어마다 실제로 달라지게 한다 — 편의점 알바
// 앞치마(0)에서 시작해 넥타이(1) → 사원증(2) → 안경(3) → 포켓스퀘어·라펠(4) →
// 보타이·톱햇·금줄(5)로 소품이 누적된다. mood(normal/shaken/joy) 분기는 그대로 유지한다.
function TierAccessories({ tier }: { tier: number }) {
  if (tier <= 0) {
    // 티어 0: 알바생 앞치마 비브
    return (
      <path d="M42 70 L50 96 L58 70 Q50 76 42 70 Z" fill="#d9d9d9" opacity="0.9" />
    )
  }

  const badge = tier >= 2 ? (
    <>
      <rect x="38" y="80" width="10" height="14" rx="2" fill="#e8e8e8" stroke="#2b2118" strokeWidth="1" />
      <circle cx="43" cy="86" r="2.6" fill="#9aa0a6" />
    </>
  ) : null

  const glasses = tier >= 3 ? (
    <>
      <rect x="35" y="36" width="13" height="10" rx="3" fill="none" stroke="#1c1c1c" strokeWidth="1.6" />
      <rect x="52" y="36" width="13" height="10" rx="3" fill="none" stroke="#1c1c1c" strokeWidth="1.6" />
      <path d="M48 41 L52 41" stroke="#1c1c1c" strokeWidth="1.6" />
    </>
  ) : null

  const pocketAndLapel = tier >= 4 ? (
    <>
      <path d="M30 90 L37 90 L34 83 Z" fill="#e6d9b8" />
      <path d="M32 70 L42 84 M68 70 L58 84" stroke="#1c1c1c" strokeWidth="1.4" fill="none" />
    </>
  ) : null

  const neckwear = tier >= 5 ? (
    <>
      <path d="M43 70 L50 75 L43 80 Z M57 70 L50 75 L57 80 Z" fill="#c9a227" />
      <path d="M32 96 Q50 108 68 96" stroke="#c9a227" strokeWidth="1.6" fill="none" />
      <path d="M37 14 L63 14 L60 1 L40 1 Z" fill="#111318" />
      <rect x="33" y="12" width="34" height="4" rx="2" fill="#111318" />
    </>
  ) : (
    <path d="M47 70 L53 70 L51 100 L50 106 L49 100 Z" fill="#2b2118" />
  )

  return (
    <>
      {neckwear}
      {badge}
      {glasses}
      {pocketAndLapel}
    </>
  )
}

export function makeCharacter(tier: number, mood: 'normal' | 'shaken' | 'joy') {
  return function Character({ size = 120, className }: ArtProps) {
    const shake = mood === 'shaken'
    const joy = mood === 'joy'
    return (
      <svg viewBox="0 0 100 120" width={size} height={size * 1.2} className={className} role="img" aria-label="캐릭터">
        <ellipse cx="50" cy="114" rx="26" ry="5" fill="#000" opacity="0.25" />
        <path d={`M28 112 L32 70 Q50 62 68 70 L72 112 Z`} fill={OUTFIT[tier] ?? OUTFIT[0]} />
        <circle cx="50" cy="42" r="24" fill={SKIN} />
        <path d="M26 34 Q50 12 74 34 Q62 26 50 27 Q38 26 26 34 Z" fill="#2b2118" />
        <TierAccessories tier={tier} />
        {shake ? (
          <>
            <path d="M38 40 l8 6 M46 40 l-8 6" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            <path d="M54 40 l8 6 M62 40 l-8 6" stroke="#333" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="50" cy="55" rx="6" ry="7" fill="#5c2b2b" />
            <path d="M70 34 q6 10 2 18" stroke="#7fb3ff" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : joy ? (
          <>
            <path d="M38 42 q5 -6 10 0" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M54 42 q5 -6 10 0" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M38 54 q12 12 24 0" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="42" cy="42" r="2.6" fill="#333" />
            <circle cx="60" cy="42" r="2.6" fill="#333" />
            <path d="M42 55 q8 4 16 0" stroke="#333" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </>
        )}
      </svg>
    )
  }
}

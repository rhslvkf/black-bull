export interface ArtProps { size?: number; className?: string }

const SKIN = '#f3d3b5'
/** 티어가 오를수록 옷이 나아진다. */
const OUTFIT = ['#5b6570', '#4a6fa5', '#3f7d6b', '#8a6b3f', '#6b4a8a', '#a58a3f']

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

export interface Slice { label: string; value: number; color: string }

export function Donut({ slices, size = 140 }: { slices: Slice[]; size?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  if (total <= 0) return null
  const r = 50, c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} role="img" aria-label="비중">
      <g transform="translate(70,70) rotate(-90)">
        {slices.map(s => {
          const len = (s.value / total) * c
          const el = (
            <circle
              key={s.label} r={r} fill="none" stroke={s.color} strokeWidth="20"
              strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </g>
    </svg>
  )
}

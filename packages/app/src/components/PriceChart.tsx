export function PriceChart({ history, width = 320, height = 120 }: { history: number[]; width?: number; height?: number }) {
  if (history.length === 0) return <svg width={width} height={height} role="img" aria-label="차트" />
  const min = Math.min(...history), max = Math.max(...history)
  const span = max - min || 1
  const dx = history.length > 1 ? width / (history.length - 1) : width
  const points = history.map((v, i) => `${(i * dx).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`).join(' ')
  const first = history[0]!
  const last = history[history.length - 1]!
  // Ruling 58과 동일한 원칙: 등락이 없으면 상승도 하락도 아닌 중립(회색)이어야 한다.
  // 상승 빨강 / 하락 파랑(한국 증시 관례), 보합은 회색.
  const stroke = last > first ? '#f0616d' : last < first ? '#4f8ff7' : '#8892a0'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="차트">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

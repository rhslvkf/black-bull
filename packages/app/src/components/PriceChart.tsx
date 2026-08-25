export function PriceChart({ history, width = 320, height = 120 }: { history: number[]; width?: number; height?: number }) {
  if (history.length === 0) return <svg width={width} height={height} role="img" aria-label="차트" />
  // 히스토리가 1개뿐이면(1턴차) 좌표쌍도 1개라 <polyline>이 그릴 선분이 없어 완전히
  // 빈 상자로 렌더된다 — 리뷰 M1. 추세를 알 수 없는 상태이므로 점선 기준선으로
  // "데이터는 있지만 아직 추세를 보여줄 게 없다"를 나타낸다(중립 회색, Ruling 58과 동일 원칙).
  if (history.length === 1) {
    const y = height / 2
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="차트">
        <line x1={0} y1={y} x2={width} y2={y} stroke="#8892a0" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    )
  }
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

import { holdingValue, priceOf } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { Donut } from '../components/Donut'

const COLORS = ['#58a6ff', '#f0616d', '#3fb950', '#e6b45a', '#d2a8ff', '#79c0ff', '#ff9b72', '#7ee787', '#ffa198', '#a5d6ff']

export function AccountScreen() {
  const s = useGame(st => st.state)
  if (!s) return null
  const { holdings } = s.player

  if (holdings.length === 0) {
    return (
      <section className="screen account">
        <p data-testid="empty-holdings" className="empty">아직 아무것도 없다. 예수금 {won(s.player.cash)}.</p>
      </section>
    )
  }

  const slices = holdings.map((h, i) => ({
    label: s.stockDefs.find(d => d.id === h.stockId)!.name,
    value: h.qty * priceOf(s, h.stockId),
    color: COLORS[i % COLORS.length]!,
  }))
  slices.push({ label: '현금', value: s.player.cash, color: '#484f58' })

  return (
    <section className="screen account">
      <div className="donut-wrap">
        <Donut slices={slices} />
        <div className="donut-legend">
          {slices.map(sl => (
            <span key={sl.label}><i style={{ background: sl.color }} />{sl.label}</span>
          ))}
        </div>
      </div>
      <p className="sum">평가액 {won(holdingValue(s))} · 예수금 {won(s.player.cash)}</p>
      <ul className="holdings">
        {holdings.map(h => {
          const def = s.stockDefs.find(d => d.id === h.stockId)!
          const p = priceOf(s, h.stockId)
          const roi = h.avgCost === 0 ? 0 : ((p - h.avgCost) / h.avgCost) * 100
          const direction = roi > 0 ? 'up' : roi < 0 ? 'down' : 'neutral'
          return (
            <li key={h.stockId} data-testid={`holding-${h.stockId}`}>
              <span className="h-name">{def.name}</span>
              <span className="h-qty">{h.qty}주 · {h.heldTurns}주차</span>
              <span className="h-avg">평단 {won(h.avgCost)}</span>
              <span className={direction}>{pct(roi)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

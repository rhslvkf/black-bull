import { useState } from 'react'
import { canBuy } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { Art } from '../art/Art'
import { StockDetail } from './StockDetail'
import type { ArtKey } from '../art/keys'

export function MarketScreen() {
  const s = useGame(st => st.state)
  const selected = useGame(st => st.selectedStock)
  const selectStock = useGame(st => st.selectStock)
  const [sector, setSector] = useState<string | null>(null)
  if (!s) return null
  if (selected) return <StockDetail />

  const sectors = [...new Set(s.stockDefs.map(d => d.sector))]
  const rows = s.stockDefs.filter(d => !sector || d.sector === sector)

  return (
    <section className="screen market">
      <div className="filters">
        <button className={!sector ? 'on' : ''} data-testid="filter-all" onClick={() => setSector(null)}>
          전체
        </button>
        {sectors.map(x => (
          <button key={x} className={sector === x ? 'on' : ''} data-testid={`filter-${x}`} onClick={() => setSector(x)}>
            <Art id={`sector.${x}` as ArtKey} size={13} /> {x}
          </button>
        ))}
      </div>
      <ul className="stock-list">
        {rows.map(d => {
          const st = s.stocks.find(x => x.id === d.id)!
          const prev = st.history[st.history.length - 2] ?? st.price
          const chg = prev === 0 ? 0 : ((st.price - prev) / prev) * 100
          const direction = chg > 0 ? 'up' : chg < 0 ? 'down' : 'neutral'
          const locked = !canBuy(s, d.id).ok
          return (
            <li key={d.id}>
              <button
                className={`stock-row${locked ? ' locked' : ''}`}
                data-testid={`stock-row-${d.id}`} disabled={locked} onClick={() => selectStock(d.id)}
              >
                <span className="s-icon"><Art id={`sector.${d.sector}` as ArtKey} size={20} /></span>
                <span className="s-main">
                  <span className="s-name">{d.name}{locked && <Art id="ui.lock" size={11} />}</span>
                  <span className="s-sector">{d.sector}</span>
                </span>
                <span className="s-quote">
                  <span className="s-price">{won(st.price)}</span>
                  <span className={direction}>{pct(chg)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

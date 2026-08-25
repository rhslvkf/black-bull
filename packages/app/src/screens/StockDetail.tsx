import { useState } from 'react'
import { analyzeStock, canSell, maxBuyQty, priceOf } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { PriceChart } from '../components/PriceChart'
import { Art } from '../art/Art'
import type { ArtKey } from '../art/keys'

const REASON: Record<string, string> = {
  SELL_BLOCKED: '손절 봉인 — 흔들려서 손이 안 나간다',
  NO_QTY: '보유 수량이 없다',
  NOT_PLAYING: '게임이 끝났다',
}

const RISK_TONE: Record<string, string> = {
  '낮음': '#3fb950', '보통': '#e6b45a', '높음': '#f0616d', '매우 높음': '#e05252',
}

export function StockDetail() {
  const s = useGame(st => st.state)
  const id = useGame(st => st.selectedStock)
  const selectStock = useGame(st => st.selectStock)
  const doBuy = useGame(st => st.doBuy)
  const doSell = useGame(st => st.doSell)
  const [qty, setQty] = useState(1)
  if (!s || !id) return null

  const def = s.stockDefs.find(d => d.id === id)!
  const stock = s.stocks.find(x => x.id === id)!
  const a = analyzeStock(s, id)
  const held = s.player.holdings.find(h => h.stockId === id)
  const sellChk = canSell(s, id)
  const price = priceOf(s, id)
  const max = maxBuyQty(s, id)
  const canAfford = qty > 0 && qty <= max
  const canSellQty = !!held && held.qty >= qty
  const sellDisabled = !sellChk.ok || !canSellQty

  return (
    <section className="screen detail">
      <button className="back" data-testid="back" onClick={() => selectStock(null)}>← 목록</button>
      <div className="detail-head">
        <Art id={`sector.${def.sector}` as ArtKey} size={24} />
        <div>
          <h2>{def.name}</h2>
          <small>{def.sector}</small>
        </div>
      </div>
      <p className="price-now">{won(price)}</p>
      <PriceChart history={stock.history} width={320} height={110} />

      <dl className="analysis">
        <div>
          <dt>적정가 밴드</dt>
          <dd data-testid="fair-band">{won(a.fairLow)} ~ {won(a.fairHigh)}</dd>
        </div>
        <div>
          <dt>리스크</dt>
          <dd data-testid="risk-grade" style={{ color: RISK_TONE[a.risk] }}>{a.risk}</dd>
        </div>
        <div>
          <dt>분석 신뢰도</dt>
          <dd>{Math.round(a.confidence * 100)}%</dd>
        </div>
      </dl>
      {a.confidence < 0.4 && <p className="warn">분석력이 낮다. 이 수치를 믿어도 될지 모르겠다.</p>}

      {held && (
        <p className="held">
          {held.qty}주 보유 · 평단 {won(held.avgCost)} ·{' '}
          <span className={price > held.avgCost ? 'up' : price < held.avgCost ? 'down' : 'neutral'}>
            {pct(held.avgCost === 0 ? 0 : ((price - held.avgCost) / held.avgCost) * 100)}
          </span>
        </p>
      )}

      <div className="trade">
        <div className="trade-row">
          <label htmlFor="qty-input">수량</label>
          <input
            id="qty-input" data-testid="qty" type="number" min={1} value={qty}
            onChange={e => setQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
          />
        </div>
        <p className="trade-amount">
          예상 금액 <strong>{won(price * qty)}</strong>
          <span className="trade-hint"> · 최대 {max}주</span>
        </p>
        <div className="trade-buttons">
          <button data-testid="buy" className="buy" disabled={!canAfford} onClick={() => doBuy(id, qty)}>매수</button>
          <button data-testid="sell" className="sell" disabled={sellDisabled} onClick={() => doSell(id, qty)}>매도</button>
        </div>
        {!sellChk.ok && held && <p className="warn" data-testid="sell-block-reason">{REASON[sellChk.reason!] ?? sellChk.reason}</p>}
        {sellChk.ok && held && held.qty < qty && <p className="warn">보유 수량({held.qty}주)보다 많이 팔 수 없다.</p>}
      </div>
    </section>
  )
}

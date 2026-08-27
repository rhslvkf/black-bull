import { useState } from 'react'
import { analyzeStock, canAverageDown, canSell, fee, maxBuyQty, priceOf } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct } from '../format'
import { PriceChart } from '../components/PriceChart'
import { Art } from '../art/Art'
import { TOUCH_TARGET_PX } from '../design/layout'
import { useShake } from '../design/motion'
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
  const doAverageDown = useGame(st => st.doAverageDown)
  const [qty, setQty] = useState(1)
  // 훅은 이른 리턴(아래) 전에 항상 같은 순서로 호출해야 한다(React 규칙) — 손절
  // 봉인 흔들림(§6 "타격감") 상태도 다른 훅과 마찬가지로 여기서 미리 호출해 둔다.
  const [sellShaking, triggerSellShake] = useShake()
  if (!s || !id) return null

  const def = s.stockDefs.find(d => d.id === id)!
  const stock = s.stocks.find(x => x.id === id)!
  const a = analyzeStock(s, id)
  const held = s.player.holdings.find(h => h.stockId === id)
  const sellChk = canSell(s, id)
  // 물타기는 보유 중일 때만 뜻이 있다 — 보유하지 않은 종목에는 버튼 자체를 렌더하지
  // 않는다(canAverageDown도 held 없으면 reason을 주지만, 그 사유를 화면에 보일 필요가
  // 없는 케이스라 아예 숨긴다).
  const adChk = held ? canAverageDown(s, id) : null
  const price = priceOf(s, id)
  const max = maxBuyQty(s, id)
  const canAfford = qty > 0 && qty <= max
  // Fix Round 2 #1 — 리뷰가 발견: 클램프(입력 onChange의 Math.max(0, ...))가 뚫리면
  // (예: 다음 사람이 qty를 세팅하는 또 다른 입력 경로를 추가하면서 클램프를 안 거치면)
  // held.qty(항상 양수) >= qty가 음수 qty에서는 늘 참이 되어 매도 버튼이 활성인 채로
  // 남는다 — 클릭하면 core의 sell()이 BAD_QTY를 던지고 guard()가 삼켜 조용히
  // 무반응이 되지만, 버튼 자체는 눌러도 되는 것처럼 거짓말을 한다. 클램프 하나에
  // 기대지 않고 조건 자체가 음수를 거부하게 한다(canAfford는 원래부터 qty > 0을
  // 요구해 이 문제가 없었다 — averageDownDisabled의 qty < 1도 마찬가지다).
  const canSellQty = !!held && qty > 0 && held.qty >= qty
  // §6 "타격감 — 막힌 동작(손절 봉인)의 짧은 흔들림". 전역 제약이 정의하는 "손절
  // 봉인"은 core의 SELL_BLOCKED(흔들림 + 손실 20% 이상, canSell 참고)와 정확히 같은
  // 조건이다. 이 케이스만 버튼을 진짜 HTML disabled로 두지 않는다 — disabled 버튼은
  // 클릭 이벤트 자체를 받지 못해(브라우저·jsdom 둘 다 마찬가지로 실측 확인됨) 흔들림
  // 피드백을 낼 방법이 없어진다. 그 외 사유(보유 없음·게임 종료·수량 미입력)는 정말로
  // "누를 이유가 없는" 상태라 기존처럼 진짜 disabled로 남긴다.
  const sellLocked = !sellChk.ok && sellChk.reason === 'SELL_BLOCKED'
  const sellDisabled = (!sellChk.ok && !sellLocked) || !canSellQty
  // Fix Round 1 Major 1 — 물타기 예산은 항상 현금 전액이 아니라, 화면에 이미 있는 수량
  // 입력을 그대로 재사용한다. Task 2가 averageDownPct(고정 20%)를 지우고 budget을
  // 매개변수화한 취지가 "얼마를 넣을지 매매 화면에서 사용자가 정한다"였는데, 원탭으로
  // 항상 현금 100%를 넣으면 그 취지가 무의미해진다.
  //
  // budget을 정확히 price*qty로만 넘기면 안 된다 — averageDown은 그 budget을 다시
  // maxBuyQty로 나눠 "몇 주를 살 수 있는가"를 계산하는데, 수수료(0.015%)가 항상 최소
  // 1원 이상 붙어 gross(price*qty)보다 총비용이 더 크다. 그러면 딱 qty주를 살 만큼의
  // budget이 "qty주 사기엔 1원 부족"이 되어 core가 qty-1주만 사고(qty=1일 땐 0주 —
  // 클릭해도 조용히 아무 일도 안 일어나는 숨은 결함), 화면에 표시된 수량과 실제로
  // 사들이는 수량이 항상 어긋난다. 그래서 그 수수료만큼 여유를 더해(price*qty +
  // fee(price*qty)) "qty주를 사기에 정확히 충분한" budget을 넘긴다 — 현금이 모자라면
  // averageDown/maxBuyQty가 그 안에서 알아서 더 적은 수량으로 잘라낸다(경계는 아래
  // 테스트에서 고정).
  const budget = qty > 0 ? price * qty + fee(price * qty) : 0
  const averageDownDisabled = !adChk?.ok || qty < 1

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
          {held.qty}주 보유 · 평단{' '}
          <span data-testid="avg-cost" data-value={held.avgCost}>{won(held.avgCost)}</span> ·{' '}
          <span className={price > held.avgCost ? 'up' : price < held.avgCost ? 'down' : 'neutral'}>
            {pct(held.avgCost === 0 ? 0 : ((price - held.avgCost) / held.avgCost) * 100)}
          </span>
        </p>
      )}

      <div className="trade">
        <div className="trade-row">
          <label htmlFor="qty-input">수량</label>
          <input
            id="qty-input" data-testid="qty" type="number" min={0} value={qty}
            onChange={e => {
              const n = Math.floor(Number(e.target.value))
              setQty(Number.isFinite(n) ? Math.max(0, n) : 0)
            }}
          />
        </div>
        <p className="trade-amount">
          예상 금액 <strong>{won(price * qty)}</strong>
          <span className="trade-hint"> · 최대 {max}주</span>
        </p>

        {adChk && (
          <div className="average-down">
            <button
              data-testid="average-down"
              className="average-down-btn"
              style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
              disabled={averageDownDisabled}
              onClick={() => doAverageDown(id, budget)}
            >
              물타기
            </button>
            {!adChk.ok && (
              <p className="warn" data-testid="average-down-reason">{adChk.reason}</p>
            )}
            {adChk.ok && qty < 1 && (
              <p className="warn" data-testid="average-down-reason">수량을 입력해야 물탈 수 있다.</p>
            )}
          </div>
        )}

        <div className="trade-buttons">
          <button data-testid="buy" className="buy" disabled={!canAfford} onClick={() => doBuy(id, qty)}>매수</button>
          <button
            data-testid="sell"
            className={`sell${sellLocked ? ' locked' : ''}${sellShaking ? ' shake' : ''}`}
            disabled={sellDisabled}
            aria-disabled={sellLocked || sellDisabled}
            onClick={() => {
              if (sellLocked) { triggerSellShake(); return }
              doSell(id, qty)
            }}
          >
            매도
          </button>
        </div>
        {!sellChk.ok && held && <p className="warn" data-testid="sell-block-reason">{REASON[sellChk.reason!] ?? sellChk.reason}</p>}
        {sellChk.ok && held && held.qty < qty && <p className="warn">보유 수량({held.qty}주)보다 많이 팔 수 없다.</p>}
      </div>
    </section>
  )
}

import { holdingValue, priceOf, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { won } from '../format'
import { Donut } from '../components/Donut'
import { TOUCH_TARGET_PX } from '../design/layout'

const COLORS = ['#58a6ff', '#f0616d', '#3fb950', '#e6b45a', '#d2a8ff', '#79c0ff', '#ff9b72', '#7ee787', '#ffa198', '#a5d6ff']

/** 수익률 표기 — 부호를 붙인다(0은 부호 없이 0.0%). `pct`(format.ts)와 같은 규칙이지만
 *  종목 상세(StockDetail)가 이미 같은 자리에서 직접 계산·표기하는 것과 모양을 맞춘다.
 *  core에는 이 방향(부호가 있는 개별 종목 수익률)의 함수가 없다 — `positionLossPct`는
 *  손실 쪽만(0~100, 항상 양수) 계산하는 함수라 상승분을 표현하지 못한다. */
function roiText(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

/** 등락 방향 → 색 클래스. 상승(빨강)/하락(파랑)은 index.css의 .up/.down/.neutral이
 *  --bull(빨강)/--bear(파랑)/--muted로 이미 고정해 둔 전역 관례를 그대로 물려받는다. */
function directionOf(n: number): 'up' | 'down' | 'neutral' {
  return n > 0 ? 'up' : n < 0 ? 'down' : 'neutral'
}

/** 비중 표기 — 항상 0 이상이라 부호를 붙이지 않는다. */
function weightText(n: number): string {
  return `${n.toFixed(1)}%`
}

export function AccountScreen() {
  const s = useGame(st => st.state)
  const setTab = useGame(st => st.setTab)
  const selectStock = useGame(st => st.selectStock)
  if (!s) return null
  const { holdings, cash } = s.player

  // 총자산(현금 + 평가액 - 대출)을 분모로 써서 "종목당 비중"을 계산한다. 각 종목의
  // 비중 = 그 종목 평가액 / 총자산 × 100 — 분모가 하나로 고정돼 있어 종목이 몇 개든
  // 비중을 다 더해도(현금 몫까지 포함하면) 100%를 넘지 않는다(대출이 없는 한).
  // core의 totalAssets을 그대로 쓴다 — 화면이 직접 cash+holdingValue를 계산하면 대출을
  // 빼먹어 core와 다른 분모를 쓰게 될 수 있다(단일 출처 원칙).
  const total = totalAssets(s)
  const costTotal = s.trackers.feesPaid + s.trackers.taxPaid

  const goToDetail = (stockId: string) => {
    setTab('market')
    selectStock(stockId)
  }

  return (
    <section className="screen account">
      <p className="cost-total" data-testid="cost-total">누적 수수료·세금 {won(costTotal)}</p>

      {holdings.length === 0 ? (
        <p data-testid="empty-holdings" className="empty">아직 아무것도 없다. 예수금 {won(cash)}.</p>
      ) : (
        <>
          {(() => {
            const slices = holdings.map((h, i) => ({
              label: s.stockDefs.find(d => d.id === h.stockId)!.name,
              value: h.qty * priceOf(s, h.stockId),
              color: COLORS[i % COLORS.length]!,
            }))
            slices.push({ label: '현금', value: cash, color: '#484f58' })
            return (
              <div className="donut-wrap">
                <Donut slices={slices} />
                <div className="donut-legend">
                  {slices.map(sl => (
                    <span key={sl.label}><i style={{ background: sl.color }} />{sl.label}</span>
                  ))}
                </div>
              </div>
            )
          })()}
          <p className="sum">평가액 {won(holdingValue(s))} · 예수금 {won(cash)}</p>
          <ul className="holdings">
            {holdings.map(h => {
              const def = s.stockDefs.find(d => d.id === h.stockId)!
              const p = priceOf(s, h.stockId)
              const value = h.qty * p
              const roi = h.avgCost === 0 ? 0 : ((p - h.avgCost) / h.avgCost) * 100
              const weight = total > 0 ? (value / total) * 100 : 0
              const direction = directionOf(roi)
              return (
                <li key={h.stockId}>
                  <button
                    type="button"
                    className="holding-row"
                    data-testid={`holding-${h.stockId}`}
                    style={{ minHeight: TOUCH_TARGET_PX }}
                    onClick={() => goToDetail(h.stockId)}
                  >
                    <span className="h-top">
                      <span className="h-name">{def.name}</span>
                      <span className={direction} data-testid="roi">{roiText(roi)}</span>
                    </span>
                    <span className="h-bottom">
                      <span className="h-qty">{h.qty}주 · {h.heldTurns}주차</span>
                      <span className="h-avg">평단 {won(h.avgCost)}</span>
                      <span className="h-weight" data-testid="weight">비중 {weightText(weight)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

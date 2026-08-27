import { useState } from 'react'
import { BALANCE, holdingValue, marginShortfall, maxLoan, priceOf, totalAssets } from '@bb/core'
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

/** 담보비율 = (현금 + 평가액) / 빚 × 100. 빚이 없으면 비율 자체가 정의되지 않으므로 null.
 *  core의 checkMarginCall이 보는 담보(`cash + holdingValue`)와 **같은 분자**를 쓴다 —
 *  현금만 세거나 평가액만 세면 화면이 말하는 안전도와 실제 청산 판정이 어긋난다. */
function collateralRatioOf(cash: number, holdings: number, loan: number): number | null {
  return loan > 0 ? ((cash + holdings) / loan) * 100 : null
}

/**
 * 신용 창구(§2.5 신용거래). core의 `maxLoan`/`takeLoan`/`repayLoan`/`marginShortfall`를
 * 부르는 **유일한 화면**이다 — 1차 슬라이스에서는 이 섹션이 없어 플레이어가 스스로 빚을
 * 질 수 없었고, 그 탓에 신용을 전제로 한 엔딩·칭호·멘탈 항이 사실상 도달 불가능이었다.
 *
 * **문 열기**: 티어 3(BALANCE.loan.minTier) 미만에는 섹션 자체를 렌더하지 않는다.
 * 신용의 존재를 알리는 연출은 김실장 이벤트(`st_kim_credit`, tierMin 3)의 몫이라,
 * 그 전에 창구가 보이면 연출이 김샌다.
 *
 * **다만 빚이 남아 있으면 티어가 떨어져도 계속 보인다.** 티어는 강등된다
 * (BALANCE.tierDemoteRatio) — 빚을 진 채 자산이 줄어 티어 2로 내려간 플레이어에게
 * 티어만으로 창구를 닫으면, 상환 버튼도 마진콜 경고 배너도 함께 사라져 **갚을 방법도
 * 위험을 알 방법도 없는 상태**로 청산까지 끌려간다. 티어 게이트의 목적은 '아직 못 쓰는
 * 기능을 미리 보여주지 않는 것'이지 '이미 진 빚을 숨기는 것'이 아니다.
 * (이 상태에서 `maxLoan`은 0이라 신규 대출은 자연히 막힌다 — 아래 버튼도 그걸 따른다.)
 */
export function CreditSection() {
  const s = useGame(st => st.state)
  const doTakeLoan = useGame(st => st.doTakeLoan)
  const doRepayLoan = useGame(st => st.doRepayLoan)
  const [amount, setAmount] = useState(0)
  if (!s) return null

  const { cash, loan, tier, marginCallDueTurn } = s.player
  const unlocked = tier >= BALANCE.loan.minTier || loan > 0
  if (!unlocked) return null

  const limit = maxLoan(s)
  // 주 이자 — core의 accrueInterest(turn/margin.ts)가 매 턴 물리는 식과 같다
  // (`Math.round(loan × BALANCE.loan.rate)`). 비율은 BALANCE에서만 읽는다.
  const weeklyInterest = Math.round(loan * BALANCE.loan.rate)
  const collateralRatio = collateralRatioOf(cash, holdingValue(s), loan)
  // 부족액은 **core가 계산해서 준다**. 화면이 `loan × callRatio − 담보`를 다시 적으면
  // 청산 판정과 배너가 서로 다른 식을 갖게 된다 — marginShortfall이 그러라고 있는 함수다.
  const shortfall = marginShortfall(s)
  const warned = marginCallDueTurn !== null

  // 버튼이 core의 throw를 대신 막는다(BAD_AMOUNT / TIER_LOCKED / LOAN_LIMIT).
  const overLimit = amount > limit
  const overLoan = amount > loan
  const overCash = amount > cash
  const takeDisabled = amount < 1 || overLimit
  const repayDisabled = amount < 1 || overLoan || overCash

  return (
    <section className="credit" data-testid="credit-section">
      {warned && (
        <p className="margin-banner" data-testid="margin-banner">
          <strong>마진콜</strong> 다음 주까지 담보를 못 채우면 전량 청산됩니다.
          <span data-testid="margin-shortfall"> 부족액 {won(shortfall)}</span>
        </p>
      )}
      <h3 className="credit-title">신용 창구</h3>
      <dl className="credit-stats">
        <div>
          <dt>한도</dt>
          <dd data-testid="credit-limit">{won(limit)}</dd>
        </div>
        <div>
          <dt>현재 빚</dt>
          <dd data-testid="credit-loan">{won(loan)}</dd>
        </div>
        <div>
          <dt>주 이자</dt>
          <dd data-testid="credit-interest">{won(weeklyInterest)}</dd>
        </div>
        <div>
          <dt>담보비율</dt>
          <dd
            data-testid="credit-collateral"
            /* 청산선 아래면 하락색(파랑)으로 읽힌다. 그 외에는 다른 수치와 같은 평범한
               흰색이다 — 위험할 때만 색이 붙는다. */
            className={collateralRatio !== null && collateralRatio < BALANCE.loan.callRatio * 100 ? 'down' : ''}
          >
            {collateralRatio === null ? '—' : `${collateralRatio.toFixed(1)}%`}
          </dd>
        </div>
      </dl>
      <p className="credit-hint">
        유지 {(BALANCE.loan.callRatio * 100).toFixed(0)}% 미만이면 다음 주에 청산된다 ·
        주 이자율 {(BALANCE.loan.rate * 100).toFixed(2)}%
      </p>

      <div className="credit-row">
        <label htmlFor="credit-amount">금액</label>
        <input
          id="credit-amount" data-testid="credit-amount" type="number" min={0} value={amount}
          style={{ minHeight: TOUCH_TARGET_PX }}
          onChange={e => {
            const n = Math.floor(Number(e.target.value))
            setAmount(Number.isFinite(n) ? Math.max(0, n) : 0)
          }}
        />
      </div>
      <div className="credit-fills">
        <button
          type="button" data-testid="fill-limit" style={{ minHeight: TOUCH_TARGET_PX }}
          disabled={limit < 1} onClick={() => setAmount(limit)}
        >
          한도 전액
        </button>
        <button
          type="button" data-testid="fill-repay" style={{ minHeight: TOUCH_TARGET_PX }}
          disabled={Math.min(loan, cash) < 1} onClick={() => setAmount(Math.min(loan, cash))}
        >
          갚을 수 있는 만큼
        </button>
      </div>
      <div className="credit-buttons">
        <button
          data-testid="take-loan" className="take-loan" disabled={takeDisabled}
          style={{ minHeight: TOUCH_TARGET_PX }}
          onClick={() => doTakeLoan(amount)}
        >
          대출
        </button>
        <button
          data-testid="repay-loan" className="repay-loan" disabled={repayDisabled}
          style={{ minHeight: TOUCH_TARGET_PX }}
          onClick={() => doRepayLoan(amount)}
        >
          상환
        </button>
      </div>
      {/* 막힌 이유는 **막힌 쪽 버튼에만** 붙인다. 하나로 합치면 빚이 없는(=상환할 게
          없는 것이 당연한) 상태에서 대출 금액만 입력해도 상환 쪽 경고가 뜬다. */}
      {amount >= 1 && overLimit && (
        <p className="warn" data-testid="take-reason">
          {limit === 0
            ? tier < BALANCE.loan.minTier
              ? `신용은 티어 ${BALANCE.loan.minTier}부터다. 지금은 갚는 것만 된다.`
              : '지금은 더 빌릴 수 없다.'
            : `한도(${won(limit)})를 넘었다.`}
        </p>
      )}
      {amount >= 1 && loan > 0 && (overLoan || overCash) && (
        <p className="warn" data-testid="repay-reason">
          {overLoan ? `빚(${won(loan)})보다 많이 갚을 수 없다.` : `예수금(${won(cash)})이 모자란다.`}
        </p>
      )}
    </section>
  )
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

      <CreditSection />

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

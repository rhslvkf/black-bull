import { ENDINGS, holdingValue } from '@bb/core'
import { useGame } from '../store/store'
import { won, yearWeek } from '../format'
import { Art } from '../art/Art'
import { TOUCH_TARGET_PX } from '../design/layout'

/**
 * §4.4 — 엔딩을 "이모지 배지 + 숫자" 카드가 아니라 증권사 잔고증명서 형식으로
 * 보여준다. 156턴(3년)의 결과를 실물 문서 흉내로 요약하는 것이 이 화면의 전부다.
 *
 * **법적 제약(계획서 §4.4·§7과 같은 원칙)**: 실존 증권사의 상호·로고·서식을 쓰지
 * 않는다. 발행처는 가상의 이름, 계좌번호는 마스킹된 형태로 고정한다.
 * `EndingView.legal.test.tsx`가 `packages/core/data/listed-companies.json`
 * (2,761개 KRX 상장사)과 브랜드 어근 목록에 대조해 이 이름을 계속 고정한다.
 */
const ISSUER_NAME = '새벽증권'
/** 계좌번호는 절대 실제 숫자를 담지 않는다 — 자릿수 형태만 보여주는 완전 마스킹. */
const MASKED_ACCOUNT = '000-00-000000'
/** 예금주는 게임이 플레이어를 부르는 호칭('흑우') 그대로 쓴다 — 실명을 지어내
 *  붙이지 않는다. */
const ACCOUNT_HOLDER = '흑우'

export function EndingView() {
  const s = useGame(st => st.state)
  const newGame = useGame(st => st.newGame)
  if (!s || s.status !== 'ended' || !s.ending) return null

  const { endingId, endingName, titles } = s.ending
  // desc는 EndingResult에 없어 core의 ENDINGS에서 가져온다 — endingName 자체는
  // 이미 core가 계산해 s.ending에 실어 보낸 값을 그대로 쓴다(app에서 다시 적지
  // 않는다 — 1차 개발에서 도감이 엔딩 id를 그대로 찍은 결함의 재발 방지).
  const desc = ENDINGS.find(e => e.id === endingId)?.desc ?? ''

  const cash = s.player.cash
  const stockValue = holdingValue(s)
  const total = cash + stockValue
  const cost = s.trackers.feesPaid + s.trackers.taxPaid
  const drawdown = s.trackers.maxDrawdownPct

  return (
    <div className="overlay ending" data-testid="ending">
      <div className="doc" data-testid="ending-doc">
        <p className="doc-issuer" data-testid="doc-issuer">{ISSUER_NAME}</p>
        <h2 className="doc-title">잔&nbsp;고&nbsp;증&nbsp;명&nbsp;서</h2>

        <div className="doc-row">
          <span>계좌번호</span>
          <span data-testid="doc-account">{MASKED_ACCOUNT}</span>
        </div>
        <div className="doc-row">
          <span>예금주</span>
          <span>{ACCOUNT_HOLDER}</span>
        </div>

        <hr className="doc-rule" />

        <div className="doc-row">
          <span>예수금</span>
          <span data-testid="doc-cash">{won(cash)}</span>
        </div>
        <div className="doc-row">
          <span>주식평가금액</span>
          <span data-testid="doc-stock">{won(stockValue)}</span>
        </div>
        <div className="doc-row doc-total">
          <span>평가금액 합계</span>
          <span data-testid="doc-total">{won(total)}</span>
        </div>

        <hr className="doc-rule" />

        <p className="doc-section">3년 요약</p>
        <div className="doc-row doc-sub">
          <span>최고 자산</span>
          <span data-testid="doc-peak">{won(s.trackers.peakAssets)}</span>
        </div>
        <div className="doc-row doc-sub">
          <span>최대 낙폭</span>
          <span data-testid="doc-drawdown">{drawdown > 0 ? '−' : ''}{drawdown.toFixed(1)}%</span>
        </div>
        <div className="doc-row doc-sub">
          <span>총 거래 횟수</span>
          <span data-testid="doc-trades">{s.trackers.tradeCount.toLocaleString('ko-KR')}회</span>
        </div>
        <div className="doc-row doc-sub">
          <span>낸 수수료·세금</span>
          <span data-testid="doc-cost">{won(cost)}</span>
        </div>

        <hr className="doc-rule" />

        <div className="doc-footer">
          <span className="doc-date">{yearWeek(s.turn)} 발행</span>
          <span className="doc-stamp-wrap">
            <Art id={`ending.${endingId}`} size={68} className="doc-stamp" />
          </span>
        </div>

        <h3 className="doc-ending-name" data-testid="ending-name">{endingName}</h3>
        <p className="doc-ending-desc">{desc}</p>

        {titles.length > 0 && (
          <ul className="doc-titles">
            {titles.map((t, i) => (
              <li key={t} className="doc-title-chip" data-testid={`title-${i}`}>{t}</li>
            ))}
          </ul>
        )}
      </div>

      <button
        className="primary"
        data-testid="restart"
        style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
        onClick={() => newGame()}
      >
        다시 하기
      </button>
    </div>
  )
}

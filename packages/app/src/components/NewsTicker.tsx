import { useState } from 'react'
import type { NewsItem } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import { TOUCH_TARGET_PX } from '../design/layout'

/** §3 레이아웃 예산 — 뉴스 티커 한 줄 32px(§3.1). 정의는 여기 한 곳뿐이다. jsdom은
 *  외부 CSS를 읽지 않으므로(Ruling 20, TopBar의 TOPBAR_HEIGHT_PX와 같은 방식) 인라인
 *  스타일로 내려 getComputedStyle로 실측 가능하게 한다.
 *
 *  이 값(32)은 전역 제약의 터치 타깃 최소값(44, TOUCH_TARGET_PX)보다 작다 — 줄 전체가
 *  탭 대상이므로 실제 렌더 높이는 `min-height: 44px`가 `height: 32px`를 덮어써 44가
 *  된다(CSS는 min-height가 height보다 크면 항상 min-height를 쓴다). §3.1의 32px는
 *  "이 정도로 보이길" 바라는 시각적 예산이고, 접근성 하한이 그보다 우선한다 —
 *  TopBar 주석이 남긴 것과 같은 원칙("패딩 포함 ≥40px을 44px로 잘못 보고했던 사고")이다. */
export const TICKER_HEIGHT_PX = 32

/** 시트에 띄우는 최근 소식 개수. 1차 NewsFeed가 쓰던 값(8)을 그대로 물려받는다 —
 *  '최근 8건'이라는 표현이 스펙 §3.1과 브리프 양쪽에 못박혀 있다. */
const SHEET_RECENT_COUNT = 8

/** 뉴스가 없을 때 티커 한 줄에 뜨는 안내 문구. 시트에도 같은 문구를 쓴다. */
const EMPTY_NOTICE = '아직 아무 소식도 없다.'

/**
 * 루머 판별은 core의 `NewsItem.kind`(`'news' | 'rumor'`)를 그대로 쓴다 — 문자열
 * 접두사(`[루머] `)를 app이 따로 파싱하지 않는다.
 *
 * engine.ts의 `revealRumors`가 `kind: 'rumor'`와 `title: '[루머] ' + ...`를 함께
 * 만들지만(events/engine.ts), `kind`가 이미 판별 그 자체이고 접두사는 사람이 읽는
 * 텍스트 장식일 뿐이다 — 접두사 문자열을 여기서도 하드코딩하면 core가 그 접두사를
 * 바꾸는 순간(예: 이모지로 교체) app이 조용히 어긋난다. `kind`는 타입이 좁혀 주므로
 * 그 사고 자체가 날 수 없다.
 */
const isRumor = (item: NewsItem): boolean => item.kind === 'rumor'

/**
 * §3.1 홈 레이아웃의 뉴스 티커 — 최근 뉴스 한 건만 한 줄로 보여주고, 탭하면 최근 8건이
 * 바텀 시트로 올라온다.
 *
 * 1차 NewsFeed는 최근 8건을 세로로 쌓아 화면을 먹었다(스펙 §3.1) — 156턴 동안
 * 최대 312건(턴당 최대 2건, `BALANCE.maxEventsPerTurn`)이 쌓이므로 목록으로는
 * 소화되지 않는다. 흐르는 애니메이션은 넣지 않았다 — 말줄임(ellipsis)으로 한 줄을
 * 지키는 정적 텍스트가 증권 앱 티커로도 흔한 형태이고, 움직이는 텍스트는 모션
 * 민감도·읽기 속도 문제를 새로 만든다. 애니메이션이 없으므로
 * `prefers-reduced-motion`을 어길 여지 자체가 없다.
 */
export function NewsTicker() {
  const news = useGame(st => st.state?.news)
  const [open, setOpen] = useState(false)

  if (!news) return null

  const latest = news.length > 0 ? news[news.length - 1] : undefined
  const rumor = latest !== undefined && isRumor(latest)
  // 최근 SHEET_RECENT_COUNT건, 최신이 먼저 오도록 뒤집는다(1차 NewsFeed와 같은 순서).
  const recent = news.slice(-SHEET_RECENT_COUNT).reverse()

  return (
    <div className="news-ticker-wrap">
      <button
        type="button"
        className={`ticker-line${rumor ? ' rumor' : ''}`}
        data-testid="ticker-line"
        data-rumor={rumor ? 'true' : 'false'}
        aria-label="최근 소식 전체 보기"
        style={{ minHeight: TOUCH_TARGET_PX, height: TICKER_HEIGHT_PX }}
        onClick={() => setOpen(true)}
      >
        <Art id={rumor ? 'ui.rumor' : 'ui.news'} size={14} />
        {/* white-space/overflow/text-overflow는 인라인으로 내린다 — jsdom은 index.css의
         *  같은 규칙을 적용하지 않으므로(Ruling 20), 긴 뉴스 문자열이 한 줄을 지키는지를
         *  테스트가 실측하려면 이 세 속성이 인라인이어야 한다. */
        }
        <span
          className="ticker-text"
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {latest ? latest.title : EMPTY_NOTICE}
        </span>
        <span className="ticker-chevron" aria-hidden="true">▸</span>
      </button>

      {open && (
        <div
          className="news-sheet-backdrop"
          data-testid="news-sheet-backdrop"
          onClick={() => setOpen(false)}
        >
          <div className="news-sheet" data-testid="news-sheet" onClick={e => e.stopPropagation()}>
            <div className="news-sheet-head">
              <h3>최근 소식</h3>
              <button
                type="button"
                className="news-sheet-close"
                data-testid="news-sheet-close"
                aria-label="닫기"
                style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
                onClick={() => setOpen(false)}
              >
                ✕
              </button>
            </div>
            {recent.length === 0 ? (
              <p className="news-empty">{EMPTY_NOTICE}</p>
            ) : (
              <ul className="news-sheet-list">
                {recent.map((n, i) => {
                  const r = isRumor(n)
                  return (
                    <li
                      key={`${n.turn}-${i}`}
                      data-testid={`news-item-${i}`}
                      className={n.kind}
                      data-rumor={r ? 'true' : 'false'}
                    >
                      <Art id={r ? 'ui.rumor' : 'ui.news'} size={14} />
                      <span>{n.title}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

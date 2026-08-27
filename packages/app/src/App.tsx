import { useEffect, useRef } from 'react'
import { isShaken } from '@bb/core'
import { useGame } from './store/store'
import { Hud } from './components/Hud'
import { TabBar, TAB_ORDER } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { MarketScreen } from './screens/MarketScreen'
import { AccountScreen } from './screens/AccountScreen'
import { CodexScreen } from './screens/CodexScreen'
import { EventModal } from './overlays/EventModal'
import { CutsceneView } from './overlays/CutsceneView'
import { EndingView } from './overlays/EndingView'
import { PrologueView } from './overlays/PrologueView'
import { DUR_BASE, DUR_SLOW, prefersReducedMotion, useShakePulse } from './design/motion'
import { seedFromLocation } from './seedParam'

/** §6 "탭 전환 슬라이드" — 슬라이드가 시작되는 지점의 가로 오프셋(px). 탭이 오른쪽으로
 *  이동하면(TAB_ORDER 기준 인덱스 증가) 오른쪽에서, 왼쪽으로 이동하면 왼쪽에서 들어와야
 *  화면이 실제로 이동한 방향과 슬라이드 방향이 맞는다(Fix Round 1 Minor 2, 리뷰가
 *  실측한 "방향 미검증" 구멍 — 좌우를 뒤집어도 이전엔 어떤 테스트도 못 잡았다). */
const TAB_SLIDE_OFFSET_PX = 12

export default function App() {
  const state = useGame(s => s.state)
  const tab = useGame(s => s.tab)
  const newGame = useGame(s => s.newGame)

  // §6 "탭 전환 슬라이드" 방향. `prevTabIndexRef`는 커밋된(그린) 렌더 뒤에만
  // effect로 갱신되므로, 이번 렌더 본문에서 읽는 값은 항상 "직전 렌더의 탭"이다 —
  // 그래서 이번 tab과 비교하면 정확히 "이번에 어느 쪽으로 옮겼는가"가 나온다.
  const tabIndex = TAB_ORDER.indexOf(tab)
  const prevTabIndexRef = useRef(tabIndex)
  const tabDirection = Math.sign(tabIndex - prevTabIndexRef.current) // -1|0|1
  useEffect(() => { prevTabIndexRef.current = tabIndex }, [tabIndex])

  // §6 "타격감 — 흔들림 진입 시 화면 가장자리 맥동". 게임이 없는 시작 화면에서는
  // 흔들림이라는 개념 자체가 없으니 항상 false를 먹인다 — 훅은 조건부로 부를 수
  // 없으므로(React 규칙) 이 컴포넌트의 이른 리턴(`if (!state)`)보다 먼저 호출한다.
  // useShakePulse의 기본 duration과 값을 맞춘다(단일 출처) — 훅 호출과 인라인
  // 애니메이션이 서로 다른 숫자를 쓰면 펄스가 CSS 애니메이션 길이보다 먼저 꺼지거나
  // 애니메이션이 끝난 뒤에도 data-pulse가 남는 어긋남이 생긴다.
  const PULSE_DURATION_MS = DUR_SLOW * 2
  const shaken = state !== null && isShaken(state)
  const pulsing = useShakePulse(shaken, PULSE_DURATION_MS)
  // §6 "화면 전환 — 탭 전환 슬라이드". prefersReducedMotion이면 애니메이션을 아예
  // 걸지 않는다(Ruling 20과 같은 기법 — jsdom은 외부 CSS를 안 읽으므로 인라인으로
  // 내려야 실측 가능하다).
  const tabAnimation = prefersReducedMotion() ? undefined : `tab-slide ${DUR_BASE}ms var(--ease-standard)`
  const pulseAnimation = pulsing ? `edge-pulse ${PULSE_DURATION_MS}ms var(--ease-standard)` : undefined
  // 방향이 0(마운트 시점 — 옮긴 게 아니다)이어도 오른쪽 기본값을 준다. 그 경우
  // tabAnimation 자체가 재생되는 순간은 최초 마운트뿐이라 방향성이 중요하지 않다.
  const tabSlideOffsetPx = tabDirection < 0 ? -TAB_SLIDE_OFFSET_PX : TAB_SLIDE_OFFSET_PX

  if (!state) {
    return (
      <main className="app start" data-testid="app-root">
        <h1>흑우키우기</h1>
        <p>3년 뒤, 당신의 계좌는 어떻게 되어 있을까.</p>
        {/* `?seed=123`이 있으면 그 시드로 시작한다 — 감사 스크립트가 같은 판을 재현하는
            유일한 입구다(seedParam.ts 주석 참고). 없으면 평소대로 무작위 시드다. */}
        <button className="primary" data-testid="start" onClick={() => newGame(seedFromLocation())}>시작하기</button>
      </main>
    )
  }

  return (
    <main
      className="app"
      data-testid="app-root"
      data-pulse={pulsing ? 'shaken' : undefined}
      style={{ animation: pulseAnimation }}
    >
      <Hud />
      <div
        className="body"
        key={tab}
        data-testid="tab-body"
        style={{ animation: tabAnimation, '--tab-slide-x': `${tabSlideOffsetPx}px` }}
      >
        {tab === 'home' && <HomeScreen />}
        {tab === 'market' && <MarketScreen />}
        {tab === 'account' && <AccountScreen />}
        {tab === 'codex' && <CodexScreen />}
      </div>
      <TabBar />
      <EventModal />
      <CutsceneView />
      <EndingView />
      {/* PrologueView는 이제 스스로 "떠야 하는가"를 스토어에서 판단한다(Task 20) —
          다른 오버레이(EventModal·CutsceneView·EndingView)와 같은 문법이다. */}
      <PrologueView />
    </main>
  )
}

import { useGame, type TabKey } from '../store/store'

const TABS: [TabKey, string, string][] = [
  ['home', '홈', '🏠'],
  ['market', '시세', '📊'],
  ['account', '계좌', '👛'],
  ['codex', '도감', '📖'],
]

/** 탭 순서(왼쪽→오른쪽) 단일 출처. App.tsx가 §6 "탭 전환 슬라이드"의 방향(뒤로/앞으로
 *  이동했는지)을 계산하는 데 이 순서를 그대로 재사용한다 — TabBar가 그리는 실제 화면
 *  순서와 어긋나면 "오른쪽 탭으로 갔는데 왼쪽에서 슬라이드해 들어오는" 것처럼 보이는
 *  결함이 생긴다(Fix Round 1 Minor 2, 리뷰가 지적한 "방향 미검증" 구멍). */
export const TAB_ORDER: readonly TabKey[] = TABS.map(([k]) => k)

export function TabBar() {
  const tab = useGame(s => s.tab)
  const setTab = useGame(s => s.setTab)
  return (
    <nav className="tabbar">
      {TABS.map(([k, label, glyph]) => (
        <button key={k} data-testid={`tab-${k}`} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
          <span className="tabbar-glyph" aria-hidden="true">{glyph}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  )
}

import { useGame, type TabKey } from '../store/store'

const TABS: [TabKey, string, string][] = [
  ['home', '홈', '🏠'],
  ['market', '시세', '📊'],
  ['account', '계좌', '👛'],
  ['codex', '도감', '📖'],
]

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

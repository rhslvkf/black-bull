import { useGame } from './store/store'
import { Hud } from './components/Hud'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { MarketScreen } from './screens/MarketScreen'
import { AccountScreen } from './screens/AccountScreen'
import { CodexScreen } from './screens/CodexScreen'
import { EventModal } from './overlays/EventModal'
import { CutsceneView } from './overlays/CutsceneView'
import { EndingView } from './overlays/EndingView'
import { PrologueView } from './overlays/PrologueView'

export default function App() {
  const state = useGame(s => s.state)
  const tab = useGame(s => s.tab)
  const newGame = useGame(s => s.newGame)

  if (!state) {
    return (
      <main className="app start">
        <h1>흑우키우기</h1>
        <p>3년 뒤, 당신의 계좌는 어떻게 되어 있을까.</p>
        <button className="primary" data-testid="start" onClick={() => newGame()}>시작하기</button>
      </main>
    )
  }

  return (
    <main className="app">
      <Hud />
      <div className="body">
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

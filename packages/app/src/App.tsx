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
  const codex = useGame(s => s.codex)
  const newGame = useGame(s => s.newGame)
  // 새로고침해도 프롤로그가 다시 뜨지 않도록 스토어(localStorage)가 들고 있다(최종 리뷰 Minor 9).
  const prologueDone = useGame(s => s.prologueDone)
  const finishPrologue = useGame(s => s.finishPrologue)

  if (!state) {
    return (
      <main className="app start">
        <h1>흑우키우기</h1>
        <p>3년 뒤, 당신의 계좌는 어떻게 되어 있을까.</p>
        <button className="primary" data-testid="start" onClick={() => newGame()}>시작하기</button>
      </main>
    )
  }

  const needPrologue = codex.runs === 0 && state.turn === 1 && !prologueDone
  if (needPrologue) return <PrologueView onDone={finishPrologue} />

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
    </main>
  )
}

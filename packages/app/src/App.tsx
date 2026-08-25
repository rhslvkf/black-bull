import { useGame } from './store/store'
import { Hud } from './components/Hud'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'

export default function App() {
  const state = useGame(s => s.state)
  const tab = useGame(s => s.tab)
  const newGame = useGame(s => s.newGame)

  if (!state) {
    return (
      <main className="app start">
        <h1>흑우키우기</h1>
        <p>3년 뒤, 당신의 계좌는 어떻게 되어 있을까.</p>
        <button data-testid="start" onClick={() => newGame()}>시작하기</button>
      </main>
    )
  }
  return (
    <main className="app">
      <Hud />
      <div className="body">{tab === 'home' && <HomeScreen />}</div>
      <TabBar />
    </main>
  )
}

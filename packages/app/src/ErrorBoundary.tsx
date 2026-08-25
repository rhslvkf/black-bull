import { Component, type ErrorInfo, type ReactNode } from 'react'
import { SAVE_KEY, useGame } from './store/store'

interface Props { children: ReactNode }
interface State { error: Error | null }

/**
 * 최상위 에러 바운더리.
 *
 * 스토어의 guard는 GameError(규칙 위반)만 삼키고 나머지는 다시 던진다(Ruling 55).
 * 게다가 렌더 경로(Hud → totalAssets → priceOf)는 guard를 거치지 않으므로, 손상된
 * 저장(예: holdings가 사라진 종목을 가리킴)을 읽으면 렌더 도중 예외가 나고 React가
 * 트리를 통째로 언마운트해 **흰 화면**이 된다. 그 상태에선 새 판을 시작할 버튼조차
 * 없으므로, 여기서 잡아 복구 경로를 준다.
 *
 * 도감(CODEX_KEY)은 회차 기록이라 지우지 않는다. 지우는 건 손상 의심 대상인 세이브뿐이다.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State { return { error } }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // 콘솔에는 남긴다 — 조용히 삼키면 디버깅 정보가 사라진다.
    console.error('[흑우키우기] 렌더 중 오류', error, info.componentStack)
  }

  private recover = () => {
    try { localStorage.removeItem(SAVE_KEY) } catch { /* 스토리지 접근 불가 시 무시 */ }
    useGame.getState().newGame()
    this.setState({ error: null })
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="app start" data-testid="error-boundary">
        <h1>화면이 멈췄다</h1>
        <p>저장된 판을 불러오다 문제가 생겼다. 새 판으로 다시 시작할 수 있다.</p>
        <p className="error-detail">{this.state.error.message}</p>
        <button className="primary" data-testid="error-recover" onClick={this.recover}>
          새 판으로 시작하기
        </button>
      </main>
    )
  }
}

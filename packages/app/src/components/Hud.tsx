import { BALANCE, isShaken } from '@bb/core'
import { useGame } from '../store/store'

function Gauge({ id, label, value, tone, critical }: { id: string; label: string; value: number; tone: string; critical?: boolean }) {
  return (
    <div className={`gauge${critical ? ' gauge-critical' : ''}`} data-testid={`gauge-${id}`}>
      <span className="gauge-label">{label}</span>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${value}%`, background: tone }} /></div>
      <span className="gauge-num">{value}</span>
    </div>
  )
}

/**
 * Task 12 — 연차·주차/티어명/총자산/투자수익률 네 항목은 이미 `TopBar`(연차·주차·
 * D-day·총자산)와 `CharacterStage`(티어·투자수익률)가 그린다. 예전 `Hud`가 같은
 * 정보를 다시 그려 화면에 HUD가 두 벌 겹쳐 보였다 — 그 네 항목과, 그 항목들에
 * 딸려 있던 예수금·무매매 기준선 텍스트·턴 진행바를 여기서 걷어낸다(각각
 * `hud-row`/`hud-assets`/`hud-cash`/`hud-baseline`/`hud-bar`였다). 예수금은
 * `AccountScreen`이 이미 보여준다.
 *
 * 남기는 것: 멘탈·컨디션 **게이지 자체**와, 그 게이지가 위험 구간일 때를 알리는
 * 배지 둘(흔들림·번아웃/컨디션 바닥) — 배지는 다른 화면에 없는 정보이고 게이지의
 * 위험색(critical)과 같은 판정에서 나오므로 게이지 표시의 일부로 본다.
 * `Hud`는 App.tsx에서 탭 전환과 무관하게 전 화면에 걸쳐 렌더되므로(App.tsx 확인
 * 완료 — 다른 탭에서 이 컴포넌트를 따로 쓰는 곳은 없다), 게이지는 홈뿐 아니라
 * 시세·계좌·도감 탭에서도 계속 보인다 — 정보가 사라지지 않는다.
 */
export function Hud() {
  const s = useGame(st => st.state)
  if (!s) return null
  const shaken = isShaken(s) // Ruling: core의 흔들림 판정을 재구현하지 않고 그대로 재사용한다
  // 강제 스킵 위험 구간(스펙 §2.5 '야근으로 장 못 봄'). 번아웃 중이면 확정이다.
  const tired = s.player.burnoutTurns > 0 || s.player.condition < BALANCE.condition.forcedSkipBelow

  return (
    <header className={`hud${shaken ? ' hud-shaken' : ''}`}>
      <div className="hud-gauges">
        <Gauge id="mental" label="멘탈" value={s.player.mental} tone={shaken ? '#e05252' : '#5aa9e6'} critical={shaken} />
        <Gauge id="condition" label="컨디션" value={s.player.condition} tone={tired ? '#e05252' : '#e6b45a'} critical={tired} />
      </div>
      {shaken && <div className="hud-shaken-badge">멘탈이 흔들리고 있다</div>}
      {/* 최종 리뷰 M4: 컨디션 위험 구간은 '고른 카드가 통째로 날아갈 수 있는' 상태인데
          화면 어디에도 표시가 없었다. 멘탈과 같은 방식으로 알린다. */}
      {tired && (
        <div className="hud-shaken-badge" data-testid="hud-tired-badge">
          {s.player.burnoutTurns > 0
            ? `번아웃 ${s.player.burnoutTurns}주 남음 — 이번 주는 장을 못 본다`
            : '컨디션이 바닥이다 — 야근으로 장을 못 볼 수 있다'}
        </div>
      )}
    </header>
  )
}

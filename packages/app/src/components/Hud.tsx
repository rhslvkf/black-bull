import { BALANCE, TIER_NAMES, isShaken, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { won, pct, yearWeek } from '../format'
import { Art } from '../art/Art'

function Gauge({ id, label, value, tone, critical }: { id: string; label: string; value: number; tone: string; critical?: boolean }) {
  return (
    <div className={`gauge${critical ? ' gauge-critical' : ''}`} data-testid={`gauge-${id}`}>
      <span className="gauge-label">{label}</span>
      <div className="gauge-track"><div className="gauge-fill" style={{ width: `${value}%`, background: tone }} /></div>
      <span className="gauge-num">{value}</span>
    </div>
  )
}

export function Hud() {
  const s = useGame(st => st.state)
  if (!s) return null
  const assets = totalAssets(s)
  const roi = ((assets - BALANCE.seedMoney) / BALANCE.seedMoney) * 100
  // Ruling 58: 0%는 상승도 하락도 아니다 — 중립으로 표시한다. (거래가 없던 턴 1부터
  // "오르고 있다"로 오독되는 걸 막는다. 부호는 pct()가 이미 맞게 만들지만 색·아이콘은
  // 여기서 별도로 삼분기해야 한다.)
  const direction = roi > 0 ? 'up' : roi < 0 ? 'down' : 'neutral'
  const shaken = isShaken(s) // Ruling: core의 흔들림 판정을 재구현하지 않고 그대로 재사용한다

  return (
    <header className={`hud${shaken ? ' hud-shaken' : ''}`}>
      <div className="hud-row">
        <span className="hud-turn"><Art id="ui.calendar" size={14} /><span>{yearWeek(s.turn)}</span></span>
        <span className="hud-tier"><Art id="ui.tier" size={13} /><span>{TIER_NAMES[s.player.tier]}</span></span>
      </div>
      <div className="hud-bar"><div style={{ width: `${(s.turn / BALANCE.totalTurns) * 100}%` }} /></div>
      <div className="hud-assets">
        <strong>{won(assets)}</strong>
        <span className={direction} data-testid="hud-roi">
          {direction === 'neutral'
            ? <span className="roi-dash" aria-hidden="true">–</span>
            : <Art id={direction === 'up' ? 'ui.up' : 'ui.down'} size={11} />}
          {' '}{pct(roi)}
        </span>
      </div>
      <div className="hud-cash">
        <Art id="ui.cash" size={12} /> 예수금 {won(s.player.cash)}
        {s.player.loan > 0 && ` · 대출 ${won(s.player.loan)}`}
      </div>
      <div className="hud-gauges">
        <Gauge id="mental" label="멘탈" value={s.player.mental} tone={shaken ? '#e05252' : '#5aa9e6'} critical={shaken} />
        <Gauge id="condition" label="컨디션" value={s.player.condition} tone="#e6b45a" />
      </div>
      {shaken && <div className="hud-shaken-badge">멘탈이 흔들리고 있다</div>}
    </header>
  )
}

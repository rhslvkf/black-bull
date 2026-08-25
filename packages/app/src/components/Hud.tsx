import { BALANCE, TIER_NAMES, totalAssets } from '@bb/core'
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
  const shaken = s.player.mental <= BALANCE.mental.shakenMax

  return (
    <header className={`hud${shaken ? ' hud-shaken' : ''}`}>
      <div className="hud-row">
        <span className="hud-turn"><Art id="ui.calendar" size={14} /><span>{yearWeek(s.turn)}</span></span>
        <span className="hud-tier"><Art id="ui.tier" size={13} /><span>{TIER_NAMES[s.player.tier]}</span></span>
      </div>
      <div className="hud-bar"><div style={{ width: `${(s.turn / BALANCE.totalTurns) * 100}%` }} /></div>
      <div className="hud-assets">
        <strong>{won(assets)}</strong>
        <span className={roi >= 0 ? 'up' : 'down'}>
          <Art id={roi >= 0 ? 'ui.up' : 'ui.down'} size={11} /> {pct(roi)}
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

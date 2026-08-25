import { BALANCE, TIER_NAMES, investmentRoi, isShaken, noTradeBaseline, totalAssets } from '@bb/core'
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
  // 최종 리뷰 C1: 기준선은 시드머니가 아니라 **무매매 기준선**(시드 + 지금까지 받은
  // 순월급)이다. 시드머니 기준으로 재면 3년치 월급 약 2,850만원이 통째로 '투자 수익'이
  // 되어, 주식을 한 주도 안 산 판이 최종턴에 +1,000%를 넘게 표시된다. 엔딩 경계도 같은
  // 기준선에 정박해 있으므로(BALANCE.endings) 이제 화면과 엔딩이 같은 잣대를 쓴다.
  const roi = investmentRoi(s)
  // Ruling 58: 0%는 상승도 하락도 아니다 — 중립으로 표시한다. (거래가 없던 턴 1부터
  // "오르고 있다"로 오독되는 걸 막는다. 부호는 pct()가 이미 맞게 만들지만 색·아이콘은
  // 여기서 별도로 삼분기해야 한다.)
  const direction = roi > 0 ? 'up' : roi < 0 ? 'down' : 'neutral'
  const shaken = isShaken(s) // Ruling: core의 흔들림 판정을 재구현하지 않고 그대로 재사용한다
  // 강제 스킵 위험 구간(스펙 §2.5 '야근으로 장 못 봄'). 번아웃 중이면 확정이다.
  const tired = s.player.burnoutTurns > 0 || s.player.condition < BALANCE.condition.forcedSkipBelow

  return (
    <header className={`hud${shaken ? ' hud-shaken' : ''}`}>
      <div className="hud-row">
        <span className="hud-turn"><Art id="ui.calendar" size={14} /><span>{yearWeek(s.turn)}</span></span>
        <span className="hud-tier"><Art id="ui.tier" size={13} /><span>{TIER_NAMES[s.player.tier]}</span></span>
      </div>
      <div className="hud-bar"><div style={{ width: `${(s.turn / BALANCE.totalTurns) * 100}%` }} /></div>
      <div className="hud-assets">
        <strong>{won(assets)}</strong>
        <span className={direction} data-testid="hud-roi" title="아무 매매도 하지 않았을 때 대비">
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
      <div className="hud-baseline" data-testid="hud-baseline">무매매 기준선 {won(noTradeBaseline(s))}</div>
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

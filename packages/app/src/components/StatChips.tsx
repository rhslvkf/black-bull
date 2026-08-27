import { useEffect, useRef, useState } from 'react'
import type { Stats } from '@bb/core'
import { useGame } from '../store/store'
import { prefersReducedMotion } from '../design/motion'
import { STAT_META } from '../design/stats'

// STAT_META는 design/stats.ts로 옮겼다(Fix Round 1 Minor 3) — CardTile이 이 파일을
// 상수 창고로 끌어다 쓰던 구조를 없애고, 공용 값은 design/ 아래 공용 위치에 둔다.
// 이 파일은 계속 그 값을 아래에서 쓴다.

/** 스탯 값 하나를 소수 첫째 자리까지 보여준다(§3.1 "강인 2.1"). */
function fmtStat(v: number): string {
  return v.toFixed(1)
}

function StatChip({ statKey, label, value }: { statKey: keyof Stats; label: string; value: number }) {
  // 증가 시 플래시(스펙 §6 "상태 전이" 층). 이전 값을 기억해 뒀다가 늘었을 때만
  // 짧게 flash 클래스를 붙인다 — 감소나 무변화에는 반응하지 않는다(플래시는 "성장"
  // 신호이지 일반적인 변경 알림이 아니다). reduced-motion이면 아예 켜지 않는다.
  const prevRef = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (value > prevRef.current && !prefersReducedMotion()) {
      setFlash(true)
      const id = setTimeout(() => setFlash(false), 480) // --dur-slow와 값을 맞춘다
      prevRef.current = value
      return () => clearTimeout(id)
    }
    prevRef.current = value
  }, [value])

  return (
    <span
      className={`stat-chip${flash ? ' stat-chip-flash' : ''}`}
      data-testid={`stat-${statKey}`}
      style={{ '--chip': `var(--stat-${statKey})` }}
    >
      <span className="stat-chip-dot" aria-hidden="true" />
      <span className="stat-chip-label">{label}</span>
      <span className="stat-chip-value">{fmtStat(value)}</span>
    </span>
  )
}

/** §3.1 홈 레이아웃의 스탯 칩 행 — 스탯 5종을 항상 화면에 상시 노출한다(§2 "다섯
 *  스탯이 전부 매 턴 체감된다"). 1차 설계에서는 스탯이 화면 어디에도 안 보였다. */
export function StatChips() {
  const s = useGame(st => st.state)
  if (!s) return null

  return (
    <div className="stat-chips" data-testid="stat-chips">
      {STAT_META.map(({ key, label }) => (
        <StatChip key={key} statKey={key} label={label} value={s.player.stats[key]} />
      ))}
    </div>
  )
}

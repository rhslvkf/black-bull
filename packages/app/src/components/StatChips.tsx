import { useEffect, useRef, useState } from 'react'
import type { Stats } from '@bb/core'
import { useGame } from '../store/store'
import { prefersReducedMotion } from '../design/motion'

/**
 * 스탯 5종의 고정 메타(순서·라벨·색 토큰 이름). §2 표의 순서(분석력·정보력·강인함·
 * 체력·인맥 — 표는 그 순서지만 §3.1 다이어그램은 "강인·체력·정보·분석·인맥"으로
 * 그린다)를 그대로 따른다 — 다이어그램이 화면 문법의 최종 기준이다.
 */
const STAT_META: readonly { key: keyof Stats; label: string }[] = [
  { key: 'grit', label: '강인' },
  { key: 'stamina', label: '체력' },
  { key: 'info', label: '정보' },
  { key: 'analysis', label: '분석' },
  { key: 'network', label: '인맥' },
]

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

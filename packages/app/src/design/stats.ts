import type { Stats } from '@bb/core'

/**
 * 스탯 5종의 고정 메타(순서·라벨). §2 표의 순서(분석력·정보력·강인함·체력·인맥 — 표는
 * 그 순서지만 §3.1 다이어그램은 "강인·체력·정보·분석·인맥"으로 그린다)를 그대로
 * 따른다 — 다이어그램이 화면 문법의 최종 기준이다.
 *
 * `StatChips`와 `CardTile`(효과 요약의 스탯 라벨) 둘 다 이 메타를 쓴다 — 한쪽이 각자
 * "분석"/"analysis" 매핑을 따로 들고 있다가 라벨이 갈라지는 사고(1차 개발에서 상수
 * 복제가 반복 결함이었다)를 막기 위해 `design/`의 공용 위치 하나에 둔다(Fix Round 1
 * Minor 3 — 이전에는 CardTile이 이 상수를 StatChips.tsx에서 직접 끌어다 썼다).
 */
export const STAT_META: readonly { key: keyof Stats; label: string }[] = [
  { key: 'grit', label: '강인' },
  { key: 'stamina', label: '체력' },
  { key: 'info', label: '정보' },
  { key: 'analysis', label: '분석' },
  { key: 'network', label: '인맥' },
]

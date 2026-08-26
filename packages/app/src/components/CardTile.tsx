import type { ActionCardDef, CardGrade, SlotCard, StatKey } from '@bb/core'
import { cardApCost, gradeCashMul, gradeMul, loadCards } from '@bb/core'
import { Art } from '../art/Art'
import { STAT_META } from '../design/stats'
import { TOUCH_TARGET_PX } from '../design/layout'

const CARDS = loadCards()

/** 스탯 라벨은 `design/stats.ts`가 export하는 단일 출처를 그대로 재사용한다(`StatChips`도
 *  같은 곳을 쓴다 — Fix Round 1 Minor 3, 중복 결함 방지). `Record<StatKey, string>`을
 *  만들려면 빈 객체를 그 타입으로 단언해야 하는데(`as` 금지), `find`로 조회하면 단언
 *  없이도 타입이 선다. */
function statLabel(key: StatKey): string {
  return STAT_META.find(m => m.key === key)?.label ?? key
}

/** `-0`을 `0`으로 접는다 — `0 * gradeMul(...)`이 부호 있는 0을 만들 수 있고, 그걸
 *  그대로 찍으면 "-0.0"이라는 존재하지 않는 값이 화면에 뜬다. */
const foldNegZero = (n: number): number => (n === 0 ? 0 : n)

/** 스탯·멘탈·컨디션 델타 — 소수 첫째 자리, 부호 명시(§3.1 "강인 2.1"과 같은 표기,
 *  format.ts의 `pct`와 같은 부호 규칙). */
function fmtDelta(n: number): string {
  const r = foldNegZero(Math.round(n * 10) / 10)
  return `${r >= 0 ? '+' : ''}${r.toFixed(1)}`
}

/** 현금 델타 — 천단위 구분자 + "원", 부호 명시. */
function fmtCash(n: number): string {
  const r = foldNegZero(Math.round(n))
  return `${r >= 0 ? '+' : ''}${r.toLocaleString('ko-KR')}원`
}

export interface EffectRow {
  key: string
  label: string
  text: string
  /** gain = 등급이 오르면 함께 커지는 보상, cost = 등급이 오르면 함께 커지는 대가.
   *  같은 배율(gradeMul)이 둘 다에 걸린다는 것이 §2.2의 핵심 규칙이다 — 카드 요약이
   *  gain만 보여주고 cost를 숨기면 그 규칙이 화면에서 사라진다(컨트롤러 판정 1). */
  kind: 'gain' | 'cost'
}

/**
 * 카드 한 장의 효과를 이번 슬롯의 등급 배율로 계산해 표시용 행으로 바꾼다.
 *
 * 현금 델타에는 `gradeCashMul`을, 나머지(스탯·멘탈·컨디션)에는 `gradeMul`을 쓴다 —
 * 두 배율을 가르는 근거는 core `BALANCE.grade.cashMul` 주석과 동일하다(야근 S등급이
 * 무위험으로 월급을 넘어서는 사고를 막기 위한 손잡이). 대응 스탯 없는 flag/impact류
 * 효과는 카드 데이터에 없으므로 다루지 않는다.
 */
export function summarizeEffects(card: ActionCardDef, grade: CardGrade): EffectRow[] {
  const mul = gradeMul(grade)
  const cashMul = gradeCashMul(grade)
  const rows: EffectRow[] = []
  card.effects.forEach((e, i) => {
    if (e.type === 'stat') {
      const v = e.delta * mul
      rows.push({ key: `stat-${i}`, label: statLabel(e.stat), text: fmtDelta(v), kind: v >= 0 ? 'gain' : 'cost' })
    } else if (e.type === 'mental') {
      const v = e.delta * mul
      rows.push({ key: `mental-${i}`, label: '멘탈', text: fmtDelta(v), kind: v >= 0 ? 'gain' : 'cost' })
    } else if (e.type === 'condition') {
      const v = e.delta * mul
      rows.push({ key: `condition-${i}`, label: '컨디션', text: fmtDelta(v), kind: v >= 0 ? 'gain' : 'cost' })
    } else if (e.type === 'cash') {
      const v = e.delta * cashMul
      rows.push({ key: `cash-${i}`, label: '현금', text: fmtCash(v), kind: v >= 0 ? 'gain' : 'cost' })
    }
  })
  return rows
}

export interface CardTileProps {
  /** 이번 턴 슬롯에 뽑힌 카드 한 장 — id와, 매 턴 새로 굴려진 등급(§2.2). */
  slot: SlotCard
  /** 이번 턴에 이미 골랐는가. */
  selected?: boolean
  /** 잠겼거나(core `cardLockReason`) 행동력 예산을 넘어 고를 수 없으면 true.
   *  CardGrid가 계산해 내려준다 — `togglePick`의 예산 판정과 정확히 같은 식이어야
   *  "눌리는데 아무 일도 안 일어나는" 버튼이 생기지 않는다(컨트롤러 판정 5). */
  disabled?: boolean
  /** disabled가 true일 때 그 이유를 사람이 읽는 문구로. null이면 이유를 안 보여준다. */
  lockReason?: string | null
  onPick?: (id: string) => void
}

/**
 * 슬롯 카드 한 장의 타일 — §3.1 카드 2×2의 셀 하나.
 *
 * `SlotCard`(core 타입)와 이름이 겹치지 않도록 컴포넌트 이름은 `CardTile`이다.
 * 등급 배지·효과 요약(보상)·비용(행동력 + 대가)을 한 타일 안에 모아, "등급이 오르면
 * 보상과 대가가 함께 커진다"는 이 게임의 성장 루프가 카드 한 장만 봐도 읽히게 한다.
 *
 * 높이 예산(Fix Round 1 Minor 1) — §3.1 다이어그램은 카드 2×2 전체(2행)에 190px을
 * 쓴다. `recovery-marker`를 별도 줄이 아니라 비용 줄 안에 넣은 것(아래 card-cost-row
 * 참고)이 그 예산을 맞추기 위한 조치다. 다만 카드 데이터 중 효과가 가장 많은
 * `drink`(최존버와 소주, 효과 5개: 멘탈+스탯2 보상, 현금+컨디션 대가)가 S등급으로
 * 회복 슬롯에 뽑히면, playwright 실측(2026-08-26, 177px 폭)으로 카드 한 장이 122px까지
 * 커진다 — 같은 행의 다른 카드가 82px이면 그 행만 122px, 전체 2행 그리드가 약
 * 122+8+82=212px로 190px 예산을 넘는다. 효과를 줄이면(=대가를 숨기면) 예산은 맞지만
 * §2.2·MU7이 요구하는 "보상과 대가를 함께 보여준다"가 깨진다 — 여기서는 후자를
 * 우선했다. jsdom은 실제 텍스트 줄바꿈을 계산하지 못해 이 픽셀 수치 자체를 CI
 * 테스트로 고정할 수 없으므로, 그 원인이었던 "표시 줄 수"를 대신 구조로 고정한다
 * (CardTile.test.tsx "카드 표시 줄 수 상한" — recovery-marker가 다시 별도 줄로
 * 돌아가거나 새 줄이 추가되는 회귀를 잡는다).
 */
export function CardTile({ slot, selected = false, disabled = false, lockReason = null, onPick }: CardTileProps) {
  const card = CARDS.find(c => c.id === slot.cardId)
  if (!card) return null

  const rows = summarizeEffects(card, slot.grade)
  const gains = rows.filter(r => r.kind === 'gain')
  const costs = rows.filter(r => r.kind === 'cost')
  const apCost = cardApCost(card.id, slot.grade)

  return (
    <button
      type="button"
      data-testid={`slot-card-${card.id}`}
      data-card-id={card.id}
      disabled={disabled}
      className={`card${selected ? ' picked' : ''}${card.isRecovery ? ' recovery' : ''}`}
      style={{ minWidth: TOUCH_TARGET_PX, minHeight: TOUCH_TARGET_PX }}
      onClick={() => onPick?.(card.id)}
    >
      <span className="card-top">
        <span className="card-name">
          <Art id="ui.card" size={13} />
          <span>{card.name}</span>
          {disabled && <Art id="ui.lock" size={12} />}
        </span>
        {/*
         * 등급색은 tokens.css(design/tokens.css, Task 9)의 `--grade-E`~`--grade-S`
         * 6종이 유일한 출처다. 여기서 hex 값을 복제하지 않고 `var(--grade-<grade>)`
         * 문자열만 인라인으로 내린다 — jsdom은 외부 CSS를 읽지 않고 var()도 해석하지
         * 않으므로(Ruling 20) getComputedStyle이 이 문자열을 그대로 돌려주고, 그래서
         * 등급마다 다른 문자열이 되어 테스트가 6색을 구별할 수 있다. 실제 브라우저에서는
         * tokens.css가 이 변수를 실제 색으로 해석한다 — 색 값은 한 곳(tokens.css)에만 있다.
         */}
        <span
          className="grade-badge"
          data-testid="grade-badge"
          style={{ backgroundColor: `var(--grade-${slot.grade})` }}
        >
          {slot.grade}
        </span>
      </span>

      {gains.length > 0 && (
        <span className="effect-summary" data-testid="effect-summary">
          {gains.map(r => `${r.label} ${r.text}`).join(' · ')}
        </span>
      )}

      <span className="card-cost-row">
        <span className="ap-cost" data-testid="ap-cost">⚡{apCost}</span>
        {costs.map(r => (
          <span key={r.key} className="cost-item" data-testid={`cost-${r.key}`}>{r.label} {r.text}</span>
        ))}
        {/* 회복 슬롯은 전역 제약("회복 슬롯은 항상 열려 있고 회복 카드는 행동력을
         *  소모하지 않는다")의 예외 없는 카드다 — ⚡0 숫자만으로는 "항상 열려 있다"는
         *  사실까지 전달되지 않아 별도 표식을 둔다(MU9 대비). 비용 줄 안에 같이 두는
         *  이유는 Fix Round 1 Minor 1 — 별도 줄로 두면 §3.1 카드 높이 예산을 넘긴다.
         *  카드 시각 구별(왼쪽 초록 테두리, .card.recovery)은 그대로 유지된다. */}
        {card.isRecovery && (
          <span className="recovery-marker" data-testid="recovery-marker">항상 열림</span>
        )}
      </span>

      {disabled && lockReason && (
        <span className="card-lock" data-testid={`card-lock-${card.id}`}>{lockReason}</span>
      )}
    </button>
  )
}

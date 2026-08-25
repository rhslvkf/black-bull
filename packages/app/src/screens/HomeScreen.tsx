import { cardsPerTurn, isShaken, moodOf } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import { NewsFeed } from '../components/NewsFeed'
import { CardGrid } from '../components/CardGrid'
import type { ArtKey } from '../art/keys'

export function HomeScreen() {
  const s = useGame(st => st.state)
  const next = useGame(st => st.next)
  // 탭을 옮겨도 고른 카드가 남아 있어야 한다 — "카드 고르고 → 시세 보고 → 돌아와서
  // 넘기기"가 자연스러운 순서인데 매번 재선택을 요구했다(최종 리뷰 Minor 8).
  const picked = useGame(st => st.picked)
  const togglePick = useGame(st => st.togglePick)
  if (!s) return null

  const limit = cardsPerTurn(s)
  const shaken = isShaken(s)
  // 표정 구간 판정은 core(moodOf)가 갖는다. 예전에는 여기서 '시드머니 대비 ROI ≥ 20%'로
  // 갈랐는데, 월급 입금만으로 턴 4에 48%가 되어 normal 6종이 사실상 죽어 있었다
  // (최종 리뷰 C1 부작용).
  const mood = moodOf(s)
  const charKey = `char.tier${s.player.tier}.${mood}` as ArtKey

  // 선택지 대기 중에는 next()가 CHOICE_PENDING을 조용히 삼키므로, 버튼을 눌러도
  // 아무 일도 안 일어나는 화면이 되지 않도록 여기서 먼저 막고 안내한다.
  const blocked = s.pendingChoices.length > 0
  // 같은 이유로 강제 스킵도 화면에 남긴다 — 스킵된 턴은 고른 카드가 통째로 버려지는데
  // 예전에는 화면에 아무 흔적이 없어 "버튼을 눌렀는데 아무 일도 안 일어났다"가 됐다
  // (최종 리뷰 M4). skipNotice는 '지난 턴에 실제로 일어난 일', burnoutAhead는 예고다.
  const skipNotice = s.lastTurnSkip === 'burnout'
    ? '번아웃으로 지난주를 통째로 날렸다. 고른 카드는 실행되지 않았다.'
    : s.lastTurnSkip === 'exhausted'
      ? '야근으로 장을 못 봤다. 고른 카드는 실행되지 않았다.'
      : null
  const burnoutAhead = s.player.burnoutTurns > 0

  const pick = (id: string) => togglePick(id, limit)
  const go = () => next(picked)

  return (
    <section className="screen home">
      <div className={`portrait${shaken ? ' portrait-shaken' : ''}`}>
        <Art id={charKey} size={128} />
      </div>
      {skipNotice && <p className="turn-skipped" data-testid="turn-skipped">{skipNotice}</p>}
      <NewsFeed />
      <h2 className="section-title">
        이번 주에 뭘 할까 <small>{picked.length}/{limit}</small>
      </h2>
      <CardGrid picked={picked} onPick={pick} />
      {blocked && <p className="turn-blocked">먼저 마주한 상황부터 정리해야 한다.</p>}
      {burnoutAhead && (
        <p className="turn-blocked" data-testid="burnout-ahead">
          번아웃이다. 이번 주에 고른 카드는 실행되지 않는다 (남은 {s.player.burnoutTurns}주).
        </p>
      )}
      <button
        className="next-turn" data-testid="next-turn"
        disabled={picked.length === 0 || blocked}
        onClick={go}
      >
        한 주 넘기기
      </button>
    </section>
  )
}

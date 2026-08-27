import { useGame } from '../store/store'
import { NewsTicker } from '../components/NewsTicker'
import { CardGrid } from '../components/CardGrid'
import { TopBar } from '../components/TopBar'
import { TurnProgress } from '../components/TurnProgress'
import { CharacterStage } from '../components/CharacterStage'
import { StatChips } from '../components/StatChips'
import { ActionMeter } from '../components/ActionMeter'

export function HomeScreen() {
  const s = useGame(st => st.state)
  const next = useGame(st => st.next)
  // 탭을 옮겨도 고른 카드가 남아 있어야 한다 — "카드 고르고 → 시세 보고 → 돌아와서
  // 넘기기"가 자연스러운 순서인데 매번 재선택을 요구했다(최종 리뷰 Minor 8).
  const picked = useGame(st => st.picked)
  const togglePick = useGame(st => st.togglePick)
  if (!s) return null

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

  const pick = (id: string) => togglePick(id)
  const go = () => next(picked)

  // Fix Round 1 — 홈은 **스크롤 영역 + 고정 조작부** 두 층이다.
  //
  // Round 1 이전에는 홈 전체가 한 덩어리였고 "남는 세로는 캐릭터 스테이지가 흡수한다"에
  // 기댔다. 리뷰어 실측으로 그 가정이 깨졌다 — 스테이지 하한(170px)까지 줄여도 안내 문구가
  // 두세 줄 붙는 턴에는 예산이 모자라, **156턴 중 13턴에서 '한 주 넘기기' 버튼이 화면
  // 밖으로 밀려났다(최악 −56px, 턴 128).**
  //
  // 그래서 흡수에만 기대지 않고 구조로 못박는다: 주 조작부(`home-actions`)는 스크롤
  // 컨테이너 **바깥**의 형제이므로, 안쪽 내용이 아무리 길어져도 밀려날 자리가 없다.
  // 넘치는 것은 위쪽(`home-scroll`)이고 그건 스크롤로 닿을 수 있다 — 반면 버튼이
  // 화면 밖으로 나가면 게임이 진행되지 않는다. 스테이지 흡수는 그대로 남아, 여유가
  // 있는 대부분의 턴에서는 스크롤 자체가 생기지 않는다.
  //
  // 버튼이 왜 못 눌리는지 설명하는 두 문구(`blocked`·`burnoutAhead`)도 버튼과 함께
  // 내려온다 — 버튼 옆에 있어야 읽히고, 위에 남겨두면 스크롤 밖으로 사라진다.
  return (
    <section className="screen home">
      <div className="home-scroll" data-testid="home-scroll">
        <TopBar />
        <TurnProgress />
        <CharacterStage />
        {skipNotice && <p className="turn-skipped" data-testid="turn-skipped">{skipNotice}</p>}
        <NewsTicker />
        <StatChips />
        <ActionMeter picked={picked} />
        {/* 예전에는 여기 <h2 className="section-title">이번 주에 뭘 할까</h2>가 있었다.
            §3.1 다이어그램에 없는 행이고(행동력 행 바로 아래가 카드 2x2다), 제목 18px과
            위아래 여백 24px을 합쳐 42px — 390x844에서 카드 아래 줄과 '한 주 넘기기'가
            탭바에 가려지던 세로 초과분의 3분의 1이 이 한 줄이었다. 카드 타일 자체가
            "고를 것"임을 이미 말하므로 정보 손실도 없다(Task 24 세로 예산 재배분). */}
        <CardGrid picked={picked} onPick={pick} />
      </div>
      <div className="home-actions" data-testid="home-actions">
        {blocked && <p className="turn-blocked">먼저 마주한 상황부터 정리해야 한다.</p>}
        {burnoutAhead && (
          <p className="turn-blocked" data-testid="burnout-ahead">
            번아웃이다. 이번 주에 고른 카드는 실행되지 않는다 (남은 {s.player.burnoutTurns}주).
          </p>
        )}
        {/* 카드를 한 장도 고르지 않아도 턴은 넘어간다 — 스펙 §2.4가 "'아무것도 안 한다'는
            선택은 카드를 고르지 않고 턴을 넘기는 것으로 표현한다"고 명시했고, core의
            advanceTurn(s, [])도 그것을 정상 경로로 처리한다. 예전에는 여기 disabled에
            `picked.length === 0`이 함께 걸려 있어서 그 선택 자체가 화면에서 불가능했다
            (최종 리뷰 M3). 남는 차단 조건은 `blocked` 하나 — 선택지가 대기 중이면
            core가 CHOICE_PENDING으로 거부하므로 눌러도 아무 일이 안 일어난다. */}
        <button
          className="next-turn" data-testid="next-turn"
          disabled={blocked}
          onClick={go}
        >
          한 주 넘기기
        </button>
      </div>
    </section>
  )
}

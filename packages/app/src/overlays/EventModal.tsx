import { loadEvents, SECTORS, type EventDef, type StockDef, type Sector } from '@bb/core'
import { useGame } from '../store/store'
import { ArtSlot } from '../art/slots'
import { NPCS, type ArtKey } from '../art/keys'
import { speakerDisplayName } from '../design/speakers'
import { DialogueBox } from './DialogueBox'

const NPC_SET: ReadonlySet<string> = new Set(NPCS)
/** 이벤트 데이터의 speaker는 @bb/core에서 평범한 string으로 온다(타입으로 NPCS와 좁혀지지
 * 않는다). 타입 단언(as ArtKey) 없이 npc.* 아트 키로 좁히려면 런타임 멤버십 검사가 필요하다 —
 * 이 타입가드가 그 유일한 통로다. 리뷰 Fix Round 1(Minor 3): 가드 자체가 항상 true를
 * 반환하도록 망가져도 이 화면의 테스트는 못 잡는다(콘텐츠의 speaker는 이미 core의
 * content.test.ts가 알려진 4인으로만 제한한다) — 그래서 export해 가드 로직 자체를
 * 직접 단위 테스트로 고정한다(EventModal.test.tsx). */
export function isNpcName(x: string): x is (typeof NPCS)[number] {
  return NPC_SET.has(x)
}

const SECTOR_SET: ReadonlySet<string> = new Set(SECTORS)
function isSectorName(x: string): x is Sector {
  return SECTOR_SET.has(x)
}

/**
 * 이벤트 종류(§4.1 "회사·시황·사회·스토리") → 배경 슬롯 키.
 *
 * `EventDef.category`는 core의 콘텐츠 5분류(news/company/personal/social/story)이고,
 * 배경 아트는 §5 슬롯 규격상 4종(office/home/street/exchange)뿐이라 1:1로 대응시킬 수
 * 없다 — 5개를 4개에 의미가 통하게 나눠 담는 것이 이 태스크의 판단 지점이다(브리프
 * 5번 항목). 근거:
 *   - news(시황): 지수·섹터 전반의 시장 뉴스라 거래소 시세판이 맞는다 → exchange
 *   - company(회사): "컨센서스 상회" 같은 개별 기업 정보는 직장인이 업무 중 접하는
 *     정보라는 결로 office
 *   - personal(개인): 엄마의 전화 등 지극히 사적인 순간 → home
 *   - social(사회): 지인의 DM·소문·단톡방 — 바깥 세상과의 접촉이라는 결로 street
 *   - story(스토리): 퇴사·반대매매·10억 돌파 등 핵심 서사는 자산·계좌와 직결돼
 *     시황(news)과 같은 exchange를 공유한다
 * 4종 배경이 전부 최소 한 카테고리 이상에서 쓰이므로(§4가 요구하는 "장면"), 이벤트
 * 종류에 따라 실제로 다른 배경이 나온다 — 하드코딩 단일 배경이 아니다.
 */
const CATEGORY_BG: Record<EventDef['category'], ArtKey> = {
  news: 'bg.exchange',
  company: 'bg.office',
  personal: 'bg.home',
  social: 'bg.street',
  story: 'bg.exchange',
}

/**
 * 화자가 없는 뉴스형 이벤트의 "인물 자리"에 넣을 아트 키(§4.1 "섹터 아트나 시황
 * 그래픽"). `impact.target`이 `sector:반도체`/`stock:sjc` 형태이므로 이를 먼저
 * 해석해 관련 섹터 아이콘을 고르고, 대상이 없거나(개인 회고·스토리 이정표 등)
 * `market`(시장 전반)이면 `ui.news`(뉴스 아이콘)로 떨어진다 — 8종 섹터 아이콘 중
 * 아무거나 임의로 고정하는 것보다, 이벤트가 실제로 건드리는 섹터를 보여주는 쪽이
 * 정보로서 의미가 있다.
 */
function eventVisualKey(def: EventDef, stockDefs: readonly StockDef[]): ArtKey {
  const target = def.impact?.target
  if (target?.startsWith('sector:')) {
    const name = target.slice('sector:'.length)
    if (isSectorName(name)) return `sector.${name}`
  }
  if (target?.startsWith('stock:')) {
    const stockId = target.slice('stock:'.length)
    const stock = stockDefs.find(d => d.id === stockId)
    if (stock) return `sector.${stock.sector}`
  }
  return 'ui.news'
}

const DEFAULT_EVENTS = loadEvents()

export interface EventModalProps {
  /** 테스트 전용 주입 지점. 기본값은 실제 콘텐츠 번들(loadEvents()) — 프로덕션
   *  코드(App.tsx)는 이 prop을 넘기지 않는다. testUtils.tsx의 renderEvent가
   *  실제 콘텐츠에 없는 합성 이벤트를 렌더할 때만 쓴다. */
  events?: EventDef[]
}

export function EventModal({ events = DEFAULT_EVENTS }: EventModalProps = {}) {
  const s = useGame(st => st.state)
  const choose = useGame(st => st.choose)
  const pending = s?.pendingChoices[0]
  if (!s || !pending) return null

  const def = events.find(e => e.id === pending.eventId)
  if (!def) return null

  const rawSpeaker = def.text.speaker
  const hasSpeaker = typeof rawSpeaker === 'string' && rawSpeaker.length > 0
  const npcId = hasSpeaker && isNpcName(rawSpeaker) ? rawSpeaker : null
  // 경고 사항(Task 17 리뷰) — def.text.speaker는 npc **id**('kim')로 온다.
  // DialogueBox는 이미 변환된 한국어 표시 이름을 받으므로 speakerDisplayName을
  // 반드시 거친다. id든 이름이든 받아 멱등하게 처리하고, 알 수 없는 값은 '???'다.
  const dialogueSpeaker = hasSpeaker ? speakerDisplayName(rawSpeaker) : null
  const bgKey = CATEGORY_BG[def.category]
  const choices = def.choices ?? [{ label: '확인', effects: [] }]

  /** 대사를 끝까지 읽은 뒤 대화창을 탭했을 때. 이 이벤트에 실제 선택지가 없으면
   *  (원래 "확인" 버튼 하나만 있던 자리) 탭 자체가 그 유일한 선택을 확정한다 —
   *  그렇지 않으면 대화창만 있고 아무도 닫을 방법이 없어 진행이 멈춘다. 실제
   *  선택지가 있는 이벤트는 사용자가 아래 선택지에서 직접 골라야 하므로 여기서는
   *  아무 일도 하지 않는다(하단 시트로 분리하는 것은 Task 19 — 지금은 선택지가
   *  대화창과 함께 이미 보이므로 무시해도 안전하다). */
  const handleDialogueAdvance = (): void => {
    if (!def.choices) choose(def.id, 0)
  }

  return (
    <div className="overlay event vn-event" data-testid="event-modal">
      <div className="event-card vn-event-card">
        <h3 className="event-title" data-testid="event-title">{def.text.title}</h3>

        <div className="vn-stage">
          <div className="event-bg" data-testid="event-bg" data-slot-kind="background">
            <ArtSlot kind="background" id={bgKey} />
          </div>

          {npcId && (
            <div className="speaker-portrait" data-testid="speaker-portrait" data-art-id={`npc.${npcId}.normal`}>
              <ArtSlot kind="portrait" id={`npc.${npcId}.normal`} className="speaker-portrait-art" />
            </div>
          )}

          {!hasSpeaker && (
            <div className="event-visual" data-testid="event-visual">
              <ArtSlot kind="scene" id={eventVisualKey(def, s.stockDefs)} />
            </div>
          )}
        </div>

        <DialogueBox key={def.id} speaker={dialogueSpeaker} text={def.text.body} onAdvance={handleDialogueAdvance} />

        <div className="choices">
          {choices.map((c, i) => (
            <button key={i} data-testid={`choice-${i}`} onClick={() => choose(def.id, i)}>{c.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

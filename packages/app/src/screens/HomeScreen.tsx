import { useState } from 'react'
import { BALANCE, cardsPerTurn, isShaken, totalAssets } from '@bb/core'
import { useGame } from '../store/store'
import { Art } from '../art/Art'
import { NewsFeed } from '../components/NewsFeed'
import { CardGrid } from '../components/CardGrid'
import type { ArtKey } from '../art/keys'

export function HomeScreen() {
  const s = useGame(st => st.state)
  const next = useGame(st => st.next)
  const [picked, setPicked] = useState<string[]>([])
  if (!s) return null

  const limit = cardsPerTurn(s)
  const roi = ((totalAssets(s) - BALANCE.seedMoney) / BALANCE.seedMoney) * 100
  const shaken = isShaken(s)
  const mood = shaken ? 'shaken' : roi >= 20 ? 'joy' : 'normal'
  const charKey = `char.tier${s.player.tier}.${mood}` as ArtKey

  // 선택지 대기 중에는 next()가 CHOICE_PENDING을 조용히 삼키므로, 버튼을 눌러도
  // 아무 일도 안 일어나는 화면이 되지 않도록 여기서 먼저 막고 안내한다.
  const blocked = s.pendingChoices.length > 0

  const pick = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= limit ? [...p.slice(1), id] : [...p, id])

  const go = () => { next(picked); setPicked([]) }

  return (
    <section className="screen home">
      <div className={`portrait${shaken ? ' portrait-shaken' : ''}`}>
        <Art id={charKey} size={128} />
      </div>
      <NewsFeed />
      <h2 className="section-title">
        이번 주에 뭘 할까 <small>{picked.length}/{limit}</small>
      </h2>
      <CardGrid picked={picked} onPick={pick} />
      {blocked && <p className="turn-blocked">먼저 마주한 상황부터 정리해야 한다.</p>}
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

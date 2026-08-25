import { ENDINGS } from '@bb/core'
import { useGame } from '../store/store'
import { won } from '../format'
import { Art } from '../art/Art'

export function EndingView() {
  const s = useGame(st => st.state)
  const newGame = useGame(st => st.newGame)
  if (!s || s.status !== 'ended' || !s.ending) return null

  const { endingId, endingName, titles, finalAssets } = s.ending
  const desc = ENDINGS.find(e => e.id === endingId)?.desc ?? ''

  return (
    <div className="overlay ending" data-testid="ending">
      <Art id={`ending.${endingId}`} size={280} />
      {titles.length > 0 && <p className="titles">{titles.join(' · ')}</p>}
      <h2>{endingName}</h2>
      <p className="ending-desc">{desc}</p>
      <p className="final-assets">{won(finalAssets)}</p>
      <button className="primary" data-testid="restart" onClick={() => newGame()}>다시 하기</button>
    </div>
  )
}

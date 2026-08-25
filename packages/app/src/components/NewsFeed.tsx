import { useGame } from '../store/store'
import { Art } from '../art/Art'

export function NewsFeed() {
  const s = useGame(st => st.state)
  if (!s) return null
  const items = s.news.slice(-8).reverse()
  if (items.length === 0) return <p className="news-empty">아직 아무 소식도 없다.</p>
  return (
    <ul className="news" data-testid="news-feed">
      {items.map((n, i) => (
        <li key={`${n.turn}-${i}`} className={n.kind}>
          <Art id={n.kind === 'rumor' ? 'ui.rumor' : 'ui.news'} size={14} />
          <span>{n.title}</span>
        </li>
      ))}
    </ul>
  )
}

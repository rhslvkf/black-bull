import { ENDINGS, TITLES } from '@bb/core'
import { useGame } from '../store/store'
import { won } from '../format'

export function CodexScreen() {
  const codex = useGame(s => s.codex)
  return (
    <section className="screen codex">
      <p className="codex-sum">
        {codex.runs}회 플레이 · 최고 {won(codex.bestAssets)}
      </p>
      <h3>엔딩 {codex.endings.length}/{ENDINGS.length}</h3>
      <ul className="codex-list">
        {ENDINGS.map(e => {
          const got = codex.endings.includes(e.id)
          return (
            <li key={e.id} className={got ? 'got' : 'locked'}>
              <strong>{got ? e.name : '???'}</strong>
              <span>{got ? e.desc : '아직 보지 못한 결말'}</span>
            </li>
          )
        })}
      </ul>
      <h3>칭호 {codex.titles.length}/{TITLES.length}</h3>
      <ul className="codex-titles">
        {TITLES.map(t => (
          <li key={t.id} className={codex.titles.includes(t.name) ? 'got' : 'locked'}>
            {codex.titles.includes(t.name) ? t.name : '???'}
          </li>
        ))}
      </ul>
    </section>
  )
}

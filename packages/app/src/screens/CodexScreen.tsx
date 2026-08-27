import { ENDINGS, TITLES } from '@bb/core'
import { useGame } from '../store/store'
import { won } from '../format'
import { Art } from '../art/Art'

/** 미수집 엔딩·칭호를 가리는 표시. 엔딩·칭호 둘 다 같은 문자열로 가린다 — 도감의
 *  핵심 규칙("아직 안 본 건 안 보여준다")이 두 목록에 동일하게 적용된다는 뜻이고,
 *  그래서 브리프의 `getAllByText('???')` 같은 전역 텍스트 질의는 엔딩 목록으로 범위를
 *  좁혀야 정확히 8종 중 미수집분(여기서는 7)만 센다 — 칭호 목록도 같은 문자열을 쓰므로
 *  좁히지 않으면 칭호의 미수집분까지 합쳐져 세어진다. */
const HIDDEN = '???'

export function CodexScreen() {
  const codex = useGame(s => s.codex)

  return (
    <section className="screen codex">
      <p className="codex-sum">
        {codex.runs}회 플레이 · 최고 {won(codex.bestAssets)}
      </p>

      <h3>엔딩 {codex.endings.length}/{ENDINGS.length}</h3>
      <ul className="codex-list" data-testid="codex-endings">
        {ENDINGS.map(e => {
          const got = codex.endings.includes(e.id)
          return (
            <li key={e.id} className={got ? 'got' : 'locked'} data-testid={`codex-ending-${e.id}`}>
              <span className="codex-stamp">
                {/* 미수집 엔딩에는 <Art id={`ending.${e.id}`}> 를 절대 렌더하지 않는다 — 그
                    svg 폴백은 엔딩 실제 이름을 aria-label과 화면 텍스트 양쪽에 바로 굽는다
                    (art/parts/Scenes.tsx의 makeScene), 그래서 잠긴 엔딩에 그리면 그 자체로
                    스포일러가 된다. 잠긴 자리는 아무 정체도 드러내지 않는 자물쇠 아이콘으로
                    채운다(§5.1 도장 그래픽은 수집한 엔딩에만 등장한다). */}
                {got ? <Art id={`ending.${e.id}`} size={44} /> : <Art id="ui.lock" size={20} />}
              </span>
              <span className="codex-text">
                <strong>{got ? e.name : HIDDEN}</strong>
                <span>{got ? e.desc : '아직 보지 못한 결말'}</span>
              </span>
            </li>
          )
        })}
      </ul>

      <h3>칭호 {codex.titles.length}/{TITLES.length}</h3>
      <ul className="codex-titles" data-testid="codex-titles">
        {TITLES.map(t => {
          const got = codex.titles.includes(t.name)
          return (
            <li key={t.id} className={got ? 'got' : 'locked'} data-testid={`codex-title-${t.id}`}>
              {got ? t.name : HIDDEN}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

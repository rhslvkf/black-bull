import { useGame } from '../store/store'
import { Art } from '../art/Art'
import type { ArtKey } from '../art/keys'

const LINES: Record<string, string> = {
  'cutscene.promote.1': '드디어 1주가 아니라 10주씩 산다.',
  'cutscene.promote.2': '이제 코스닥이 보인다. 보이면 안 되는데.',
  'cutscene.promote.3': '최존버가 처음으로 말을 걸었다. "조심해."',
  'cutscene.promote.4': '숫자가 현실감을 잃기 시작한다.',
  'cutscene.promote.5': '이제 내가 사면 오른다. 그게 제일 무섭다.',
  'cutscene.demote.0': '처음으로 돌아왔다. 시간만 썼다.',
  'cutscene.demote.1': '박대박한테서 카톡이 왔다. "괜찮냐?"',
  'cutscene.demote.2': '계좌를 안 열어본 지 나흘째다.',
  'cutscene.demote.3': '올라갈 때보다 내려올 때가 훨씬 빠르다.',
  'cutscene.demote.4': '한 단계 아래로 밀려났다. 다시 처음부터.',
}

export function CutsceneView() {
  const s = useGame(st => st.state)
  const clear = useGame(st => st.clearCutscene)
  if (!s?.cutscene) return null
  return (
    <div className="overlay cutscene" data-testid="cutscene">
      <Art id={s.cutscene as ArtKey} size={260} />
      <p className="cut-text">{LINES[s.cutscene] ?? ''}</p>
      <button className="primary" data-testid="cutscene-close" onClick={clear}>계속</button>
    </div>
  )
}

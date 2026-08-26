import { useState } from 'react'
import { Art } from '../art/Art'

const CUTS = [
  { art: 'npc.daebak.normal', text: '회식 자리. 박대박이 계좌를 돌린다.\n"+3,240만원 (+412%)"' },
  { art: 'char.tier0.normal', text: '집에 오는 길 내내 그 숫자가 떠나지 않는다.' },
  { art: 'ui.cash', text: '새벽 2시. 증권사 앱을 깔고 적금을 깬다.\n시드 300만원.' },
  { art: 'char.tier0.joy', text: '"나만 없어 주식."\n\n그렇게 3년이 시작됐다.' },
] as const

export function PrologueView({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const cut = CUTS[i]!
  return (
    <div className="overlay prologue">
      <button className="skip" data-testid="prologue-skip" onClick={onDone}>건너뛰기</button>
      <Art id={cut.art} size={160} />
      <p className="cut-text">{cut.text}</p>
      <button className="primary" data-testid="prologue-next"
        onClick={() => (i + 1 >= CUTS.length ? onDone() : setI(i + 1))}>
        {i + 1 >= CUTS.length ? '시작' : '다음'}
      </button>
    </div>
  )
}

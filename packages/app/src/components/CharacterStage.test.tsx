import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { BALANCE } from '@bb/core'
import { renderWithState } from '../testUtils'
import { useGame } from '../store/store'
import { CHARACTER_STAGE_HEIGHT_PX } from './CharacterStage'

// Ruling 18 — jest-dom을 더하지 않고 순수 DOM(getAttribute/textContent)으로 검사한다.
// Ruling 20 — 260px는 CharacterStage.tsx의 상수 하나에서만 나온다. jsdom은 외부 CSS를
// 읽지 않으므로, 그 상수가 인라인 style로 실제 내려오는지를 getComputedStyle로 잰다.

describe('CharacterStage', () => {
  it('티어에 맞는 캐릭터 슬롯을 그린다', () => {
    renderWithState({ player: { tier: 3 } })
    expect(screen.getByTestId('char-slot').getAttribute('data-art-id')).toBe('char.tier3.normal')
  })

  it('흔들림이면 shaken 표정으로 바뀐다', () => {
    renderWithState({ player: { tier: 1, mental: 12 } })
    expect(screen.getByTestId('char-slot').getAttribute('data-art-id')).toBe('char.tier1.shaken')
  })

  it('높이가 260px로 고정된다', () => {
    renderWithState({})
    expect(getComputedStyle(screen.getByTestId('char-stage')).height).toBe('260px')
    // 값 자체가 §3 레이아웃 예산이므로, 소스의 상수와도 어긋나지 않는지 함께 못박는다.
    expect(CHARACTER_STAGE_HEIGHT_PX).toBe(260)
  })

  // MU7 대비 — 260을 200 등으로 바꾸면 위 두 단언이 모두 실패해야 한다(상수 하나만
  // 정의돼 있으므로 두 단언이 반드시 같이 움직인다).

  // MU8 대비 — §3이 "배경 레이어 + 인물 레이어" 2레이어를 요구하는데 브리프 테스트는
  // 인물만 본다. 배경이 실제로 렌더되는지 별도로 고정한다.
  describe('배경 레이어 (§3, MU8)', () => {
    it('배경 레이어가 인물과 별개로 렌더된다', () => {
      renderWithState({})
      const bg = screen.getByTestId('char-bg')
      expect(bg.getAttribute('data-art-id')).toBe('bg.home')
      // 폴백(svg)이든 이미지든 실제 컨텐츠가 자리를 채우고 있어야 한다 — 빈 컨테이너면
      // "배경 레이어가 있다"고 볼 수 없다.
      expect(bg.querySelector('svg, img')).not.toBeNull()
    })
    it('배경과 인물은 서로 다른 슬롯이다', () => {
      renderWithState({})
      const bg = screen.getByTestId('char-bg')
      const fg = screen.getByTestId('char-slot')
      expect(bg).not.toBe(fg)
      expect(bg.contains(fg)).toBe(false)
      expect(fg.contains(bg)).toBe(false)
    })
  })

  // MU6 대비 — 브리프는 normal/shaken만 검사한다. core의 moodOf는 normal/shaken/joy
  // 세 갈래를 낸다. 세 무드가 각각 실제로 화면(char-slot의 data-art-id)에 도달하는지
  // 직접 고정한다 — 'joy로 가는 경로를 없앤다' 뮤테이션이 이 블록 없이는 안 잡힌다.
  describe('세 무드가 모두 화면에 도달한다 (§6, MU6)', () => {
    it('기본 상태(흔들리지 않고 투자도 없음)는 normal이다', () => {
      renderWithState({ player: { tier: 2 } })
      expect(screen.getByTestId('char-slot').getAttribute('data-art-id')).toBe('char.tier2.normal')
    })
    it('멘탈이 흔들림 문턱 이하면 shaken이다', () => {
      renderWithState({ player: { tier: 2, mental: BALANCE.mental.shakenMax } })
      expect(screen.getByTestId('char-slot').getAttribute('data-art-id')).toBe('char.tier2.shaken')
    })
    it('시장에 들어가 있고 멘탈·수익률이 충분하면 joy다', () => {
      // HomeScreen.test.tsx의 '무드 전환 임계값' 스위트와 같은 산식 — 무매매 기준선
      // (턴 1이라 시드머니와 같다) 대비 +joyRoiPct%를 총자산으로 맞추고, 그중 일부를
      // 실제로 보유(holdings)해야 '투자 중'으로 인정된다(moodOf의 invested 조건).
      // 시드 1의 결정론적 주가를 읽기 위해 렌더 없이 먼저 새 판만 굴린다 — 이 테스트
      // 안에서 renderWithState를 두 번 부르면(둘 다 렌더까지 하면) RTL이 정리하지 않은
      // 이전 트리와 char-slot testid가 겹쳐 "여러 개 찾음" 오류가 난다.
      useGame.getState().reset()
      useGame.getState().newGame(1)
      const s = useGame.getState().state!
      const total = Math.round(BALANCE.seedMoney * (1 + BALANCE.mood.joyRoiPct / 100))
      const price = s.stocks[0]!.price
      const qty = Math.floor(1_000_000 / price)
      renderWithState({
        player: {
          tier: 2,
          mental: BALANCE.mood.joyMental,
          cash: total - qty * price,
          holdings: [{ stockId: s.stocks[0]!.id, qty, avgCost: price, heldTurns: 1 }],
        },
      })
      expect(screen.getByTestId('char-slot').getAttribute('data-art-id')).toBe('char.tier2.joy')
    })
  })

  // MU9 대비 — 한국 관례(상승 빨강 = 'up' 클래스, 하락 파랑 = 'down' 클래스)는
  // design/tokens.test.ts가 토큰 배선을 이미 고정했다. 여기서는 이 컴포넌트가 그
  // 클래스를 실제로 옳은 부호에 붙이는지를 본다 — 부호와 클래스가 뒤집히면 토큰이
  // 맞아도 화면은 틀리게 된다.
  describe('수익률 배지 색 (한국 관례, MU9)', () => {
    it('수익률이 양수면 up 클래스를 쓴다', () => {
      renderWithState({ player: { cash: BALANCE.seedMoney + 500_000 } })
      expect(screen.getByTestId('char-roi').className).toContain('up')
      expect(screen.getByTestId('char-roi').className).not.toContain('down')
    })
    it('수익률이 음수면 down 클래스를 쓴다', () => {
      renderWithState({ player: { cash: BALANCE.seedMoney - 500_000 } })
      expect(screen.getByTestId('char-roi').className).toContain('down')
      expect(screen.getByTestId('char-roi').className).not.toContain('up')
    })
    it('수익률이 정확히 0이면 neutral이다 (상승도 하락도 아니다)', () => {
      renderWithState({ player: { cash: BALANCE.seedMoney } })
      expect(screen.getByTestId('char-roi').className).toContain('neutral')
    })
  })

  it('티어 이름을 배지로 보여준다', () => {
    renderWithState({ player: { tier: 0 } })
    expect(screen.getByTestId('char-tier').textContent).toBe('주린이')
  })

  // Fix Round 2(Task 18 재리뷰) — 인물 레이어의 object-fit이 어떤 테스트에도 안 걸리면
  // `contain`을 `fill`(또는 `cover`)로 바꿔도 아무도 모른다. 지금은 폴백 SVG가
  // `width:auto`라 비율이 저절로 맞아 화면상 안 보이지만, 실제 알파 이미지가 들어오고
  // `max-width` 클램프가 걸리면 그때 인물이 찌그러진 채 표면화된다. jsdom은 외부
  // CSS를 읽지 않으므로(Ruling 20) index.css 소스를 직접 읽어 고정한다 — `contain`은
  // 인스턴스마다 안 바뀌는 상수라 소스 하나만 있으면 되고, 인라인 스타일에 값을
  // 다시 적어 두 곳에 두지 않는다.
  describe('인물 레이어는 알파 이미지가 찌그러지지 않도록 object-fit: contain을 쓴다 (Fix Round 2)', () => {
    const cssPath = join(dirname(fileURLToPath(import.meta.url)), '../index.css')
    const css = readFileSync(cssPath, 'utf-8')
    const charFgArtRule = css.match(/(?:^|\n)\.char-fg-layer \.art-slot-content\s*\{[^}]*\}/)?.[0] ?? ''

    it('.char-fg-layer .art-slot-content 규칙이 존재하고 object-fit: contain이다', () => {
      expect(charFgArtRule, 'index.css에서 .char-fg-layer .art-slot-content 규칙을 못 찾았다').not.toBe('')
      expect(charFgArtRule).toMatch(/object-fit:\s*contain/)
    })
  })
})

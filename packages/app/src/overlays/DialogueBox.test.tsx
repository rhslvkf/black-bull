import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DialogueBox } from './DialogueBox'
import { matchMediaMock } from '../design/testUtils'

// Ruling 18 — packages/app에는 @testing-library/jest-dom이 없다. toHaveTextContent 대신
// 순수 DOM(el.textContent)으로 본다. 검사 내용은 브리프와 동일하다.
//
// Ruling 20 — jsdom은 외부 CSS를 읽지 않고 var()도 해석하지 않는다. 화자별 이름표 색은
// DialogueBox.tsx가 인라인 `backgroundColor: var(--speaker-<id>)`로 내리므로
// getComputedStyle이 그 문자열을 그대로 돌려주고, 4명이 서로 다른 문자열이 된다.
// (그것만으로는 토큰 "이름"에 오타가 나도 여전히 4개가 서로 달라 보인다 — Task 13이
// CardTile에서 겪은 함정과 같다. tokens.css를 직접 읽어 실제로 정의된 토큰인지까지
// 아래에서 한 번 더 고정한다.)

const here = dirname(fileURLToPath(import.meta.url))
const tokensCss = readFileSync(join(here, '../design/tokens.css'), 'utf-8')
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}
function definesCustomProperty(css: string, name: string): boolean {
  const re = new RegExp(`--${name}\\s*:\\s*[^;]+;`)
  return re.test(stripCssComments(css))
}

describe('DialogueBox', () => {
  it('대사가 타이핑되어 나타난다', () => {
    render(<DialogueBox speaker="김실장" text="형님, 이번 건은 확실합니다." />)
    expect(screen.getByTestId('dialogue-text').textContent!.length)
      .toBeLessThan('형님, 이번 건은 확실합니다.'.length)
  })

  it('탭하면 즉시 전문이 보인다', () => {
    render(<DialogueBox speaker="김실장" text="형님, 이번 건은 확실합니다." />)
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(screen.getByTestId('dialogue-text').textContent).toBe('형님, 이번 건은 확실합니다.')
  })

  it('이름표에 화자가 보인다', () => {
    render(<DialogueBox speaker="최존버" text="형은 15년째 그거 하나만 들고 있다." />)
    expect(screen.getByTestId('speaker-tag').textContent).toBe('최존버')
  })

  it('화자별로 이름표 색이 다르다', () => {
    const bg = (s: string) => {
      const { container, unmount } = render(<DialogueBox speaker={s} text="x" />)
      const c = getComputedStyle(container.querySelector('[data-testid=speaker-tag]')!).backgroundColor
      unmount()
      return c
    }
    expect(new Set(['박대박', '최존버', '김실장', '엄마'].map(bg)).size).toBe(4)
  })

  it('정체 미상은 ???로 표시된다', () => {
    render(<DialogueBox speaker="???" text="안녕하십니까." />)
    expect(screen.getByTestId('speaker-tag').textContent).toBe('???')
  })

  it('화자가 없으면 이름표가 없다', () => {
    render(<DialogueBox speaker={null} text="원달러 환율이 1400원을 넘었다." />)
    expect(screen.queryByTestId('speaker-tag')).toBeNull()
  })

  it('전문이 보인 뒤 탭하면 다음으로 넘어간다', () => {
    const onAdvance = vi.fn()
    render(<DialogueBox speaker={null} text="짧다" onAdvance={onAdvance} />)
    fireEvent.click(screen.getByTestId('dialogue-box')) // 즉시 완성
    fireEvent.click(screen.getByTestId('dialogue-box')) // 다음
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})

// MU8 대비 — VN에서 흔한 버그: 한 번의 탭으로 스킵이 아니라 곧장 다음 줄로 넘어가버리면
// 플레이어가 대사를 통째로 놓친다. 타이핑 "도중"의 탭은 절대 onAdvance를 부르면 안 된다.
describe('타이핑 도중 탭은 스킵만 한다 (MU8)', () => {
  it('전문이 아직 안 보인 상태에서 첫 탭은 onAdvance를 부르지 않는다', () => {
    const onAdvance = vi.fn()
    const longText = '형님, 이번 건은 진짜 확실합니다. 제가 아는 라인에서 직접 나온 정보라니까요.'
    render(<DialogueBox speaker="김실장" text={longText} onAdvance={onAdvance} />)
    // 아직 전문이 안 보였는지 먼저 확인(전제 확인) — reduced-motion이 아니므로 typing 중이다.
    expect(screen.getByTestId('dialogue-text').textContent).not.toBe(longText)
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(onAdvance).not.toHaveBeenCalled()
    // 스킵은 됐어야 한다 — 이제 전문이 보인다.
    expect(screen.getByTestId('dialogue-text').textContent).toBe(longText)
  })

  it('스킵 탭 다음 탭에서만 onAdvance가 정확히 한 번 불린다', () => {
    const onAdvance = vi.fn()
    const longText = '형님, 이번 건은 진짜 확실합니다. 제가 아는 라인에서 직접 나온 정보라니까요.'
    render(<DialogueBox speaker="김실장" text={longText} onAdvance={onAdvance} />)
    fireEvent.click(screen.getByTestId('dialogue-box')) // skip
    fireEvent.click(screen.getByTestId('dialogue-box')) // advance
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})

// MU9 대비 — prefers-reduced-motion을 무시하고 항상 타이핑하면 안 된다. design/motion.ts의
// useTypewriter가 이미 이걸 지키지만(Task 9), DialogueBox가 그 계약을 실제로 물려받아
// 쓰는지 여기서 다시 고정한다.
describe('prefers-reduced-motion을 존중한다 (MU9)', () => {
  it('reduced-motion이면 마운트 즉시 전문이 보인다(타이핑하지 않는다)', () => {
    matchMediaMock('(prefers-reduced-motion: reduce)', true)
    const longText = '형님, 이번 건은 진짜 확실합니다. 제가 아는 라인에서 직접 나온 정보라니까요.'
    render(<DialogueBox speaker="김실장" text={longText} />)
    expect(screen.getByTestId('dialogue-text').textContent).toBe(longText)
  })
})

// MU5 대비 — Task 13이 CardTile에서 겪은 함정: jsdom은 var()를 해석하지 않으므로 토큰
// 이름에 오타가 나도(예: --speakerX-kim) "4개가 서로 다르다"는 위 테스트는 여전히 통과한다.
// tokens.css를 직접 읽어, 화자 이름표가 실제로 가리키는 --speaker-* 변수가 정의돼 있는지
// 확인해야 오타가 잡힌다.
describe('이름표가 참조하는 CSS 변수가 tokens.css에 실제로 존재한다 (MU5)', () => {
  it('조연 4인 전부 tokens.css에 정의된 --speaker-* 변수를 가리킨다', () => {
    for (const name of ['박대박', '최존버', '김실장', '엄마']) {
      const { container, unmount } = render(<DialogueBox speaker={name} text="x" />)
      const bg = getComputedStyle(container.querySelector('[data-testid=speaker-tag]')!).backgroundColor
      const m = bg.match(/^var\(--([a-zA-Z0-9-]+)\)$/)
      expect(m, `화자 ${name} 이름표의 backgroundColor가 var(--x) 형태가 아니다: "${bg}"`).not.toBeNull()
      expect(
        definesCustomProperty(tokensCss, m![1]!),
        `화자 ${name}가 가리키는 --${m ? m[1] : '?'}가 tokens.css에 정의돼 있지 않다`,
      ).toBe(true)
      unmount()
    }
  })

  it('정체 미상(???)의 이름표도 tokens.css에 정의된 변수를 가리킨다', () => {
    const { container } = render(<DialogueBox speaker="???" text="x" />)
    const bg = getComputedStyle(container.querySelector('[data-testid=speaker-tag]')!).backgroundColor
    const m = bg.match(/^var\(--([a-zA-Z0-9-]+)\)$/)
    expect(m).not.toBeNull()
    expect(definesCustomProperty(tokensCss, m![1]!)).toBe(true)
  })
})

// MU12 대비 — NPC_NAME_KO(및 그 역방향 조회)를 공용 위치(design/speakers.ts)로 옮기지 않고
// 대화창 파일 안에 복제하면, 두 사본이 소리 없이 갈릴 수 있다(Ruling 56이 겪은 사고).
// 소스를 직접 읽어 공용 위치를 import해 쓰는지, 조연 한국어 이름을 이 파일 안에 다시
// 하드코딩하지 않는지를 고정한다.
describe('화자 이름 매핑을 design/speakers에서 가져와 쓴다 (MU12)', () => {
  const src = readFileSync(join(here, 'DialogueBox.tsx'), 'utf-8')

  it("'../design/speakers'에서 import한다", () => {
    expect(src).toMatch(/from ['"]\.\.\/design\/speakers['"]/)
  })

  it('조연 한국어 정본 이름을 이 파일 안에 다시 하드코딩하지 않는다', () => {
    for (const name of ['박대박', '최존버', '김실장', '엄마']) {
      expect(src).not.toContain(name)
    }
  })
})

// 로그(≡) — 브리프 테스트에는 빠져 있지만 태스크 제목("타이핑·이름표·로그")과 §4.1의
// "≡는 로그"가 요구하는 기능이다. 지난 대사를 다시 볼 수 있어야 VN이다.
describe('대화 로그 (§4.1 "≡")', () => {
  it('로그 토글 버튼이 있고, 처음에는 닫혀 있다(로그 패널이 안 보인다)', () => {
    render(<DialogueBox speaker="김실장" text="첫 줄" />)
    expect(() => screen.getByTestId('dialogue-log-toggle')).not.toThrow()
    expect(screen.queryByTestId('dialogue-log')).toBeNull()
  })

  it('아직 아무 줄도 지나가지 않았으면 로그가 비어 있다', () => {
    render(<DialogueBox speaker="김실장" text="첫 줄" />)
    fireEvent.click(screen.getByTestId('dialogue-log-toggle'))
    expect(screen.getByTestId('dialogue-log-empty')).toBeDefined()
    expect(screen.queryByTestId('dialogue-log-entry-0')).toBeNull()
  })

  // MU10 대비 — 로그가 마지막 한 줄만 남기지 않고 지나간 줄을 전부 누적해야 한다.
  // MU11 대비 — "지금 보이는" 줄(아직 안 지나감)은 로그에 절대 들어가면 안 된다. 이
  // 하나의 시퀀스로 누적(MU10)과 경계(MU11)를 동시에 고정한다.
  it('다음 줄로 넘어갈 때마다 방금 지나간 줄이 쌓이고, 지금 보이는 줄은 아직 로그에 없다 (MU10·MU11)', () => {
    const { rerender } = render(<DialogueBox speaker="김실장" text="첫 줄" />)

    // 아직 첫 줄이 화면에 보이는 상태 — 로그는 비어 있어야 한다(MU11).
    fireEvent.click(screen.getByTestId('dialogue-log-toggle'))
    expect(screen.queryByTestId('dialogue-log-entry-0')).toBeNull()
    fireEvent.click(screen.getByTestId('dialogue-log-toggle')) // 닫기

    // 둘째 줄로 넘어간다 — "첫 줄"이 로그에 쌓이고, "둘째 줄"(현재 줄)은 아직 없다.
    rerender(<DialogueBox speaker="김실장" text="둘째 줄" />)
    fireEvent.click(screen.getByTestId('dialogue-log-toggle'))
    expect(screen.getByTestId('dialogue-log-entry-0').textContent).toContain('첫 줄')
    expect(screen.queryByTestId('dialogue-log-entry-1')).toBeNull()
    expect(screen.getByTestId('dialogue-log').textContent).not.toContain('둘째 줄')
    fireEvent.click(screen.getByTestId('dialogue-log-toggle')) // 닫기

    // 셋째 줄로 넘어간다 — 이제 "첫 줄"·"둘째 줄" 둘 다 쌓이고(MU10 — 마지막 하나만
    // 남기지 않는다), "셋째 줄"(현재 줄)은 여전히 로그에 없다(MU11).
    rerender(<DialogueBox speaker="김실장" text="셋째 줄" />)
    fireEvent.click(screen.getByTestId('dialogue-log-toggle'))
    expect(screen.getByTestId('dialogue-log-entry-0').textContent).toContain('첫 줄')
    expect(screen.getByTestId('dialogue-log-entry-1').textContent).toContain('둘째 줄')
    expect(screen.queryByTestId('dialogue-log-entry-2')).toBeNull()
    expect(screen.getByTestId('dialogue-log').textContent).not.toContain('셋째 줄')
  })

  it('로그 항목에 그 줄의 화자 이름도 함께 보인다', () => {
    const { rerender } = render(<DialogueBox speaker="최존버" text="형은 안 판다" />)
    rerender(<DialogueBox speaker="최존버" text="15년째다" />)
    fireEvent.click(screen.getByTestId('dialogue-log-toggle'))
    expect(screen.getByTestId('dialogue-log-entry-0').textContent).toContain('최존버')
    expect(screen.getByTestId('dialogue-log-entry-0').textContent).toContain('형은 안 판다')
  })

  it('로그 토글을 탭해도 대화창의 스킵/다음 동작(onAdvance)이 함께 불리지 않는다', () => {
    const onAdvance = vi.fn()
    render(<DialogueBox speaker={null} text="짧다" onAdvance={onAdvance} />)
    fireEvent.click(screen.getByTestId('dialogue-box')) // 즉시 완성(done=true)
    fireEvent.click(screen.getByTestId('dialogue-log-toggle')) // 로그만 열림
    expect(onAdvance).not.toHaveBeenCalled()
  })
})

// MU13 대비 — 전역 제약 "터치 타깃 44px 이상". 44는 계획서 요구값이지 구현 상수가
// 아니므로 DialogueBox.tsx의 어떤 export도 참조하지 않고 테스트 안에 리터럴로 못박는다
// (ActionMeter.test.tsx·CardTile.test.tsx와 같은 방식).
describe('로그 토글의 터치 타깃이 44px 이상이다 (Global Constraints, MU13)', () => {
  it('minWidth·minHeight가 44px 이상이다', () => {
    const MIN_TOUCH_TARGET_PX = 44
    render(<DialogueBox speaker="김실장" text="x" />)
    const style = (screen.getByTestId('dialogue-log-toggle') as HTMLElement).style
    expect(parseFloat(style.minWidth)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
    expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX)
  })
})

// 직접 확인 요청 항목 — 아주 긴 대사와 빈 문자열 대사에서 대화창이 깨지지 않는지.
describe('긴 대사·빈 대사에서도 깨지지 않는다', () => {
  it('아주 긴 대사도 렌더되고, 탭하면 전문이 그대로 보인다', () => {
    const longText = '형'.repeat(500)
    render(<DialogueBox speaker="김실장" text={longText} />)
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(screen.getByTestId('dialogue-text').textContent).toBe(longText)
    expect(screen.getByTestId('dialogue-text').textContent!.length).toBe(500)
  })

  it('빈 문자열 대사는 던지지 않고 렌더되며, 탭하면 곧바로 onAdvance가 불린다', () => {
    const onAdvance = vi.fn()
    expect(() => render(<DialogueBox speaker={null} text="" onAdvance={onAdvance} />)).not.toThrow()
    expect(screen.getByTestId('dialogue-text').textContent).toBe('')
    fireEvent.click(screen.getByTestId('dialogue-box'))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })
})

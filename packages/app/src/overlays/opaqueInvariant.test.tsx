import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { PrologueView } from './PrologueView'
import { CutsceneView } from './CutsceneView'
import { EndingView } from './EndingView'
import { renderWithState, renderEnding } from '../testUtils'
import { useGame } from '../store/store'
import { matchMediaMock } from '../design/testUtils'

/**
 * Fix Round 1 Major 1(리뷰) — 컷신에서 찾아낸 인라인 style 우회(§6 "컷신
 * 크로스페이드" 요구와 Ruling 28 "완전 불투명 장면" 불변식이 충돌했던 자리)를
 * 프롤로그·엔딩에 직접 넣어봤더니 기존 621개 테스트가 전부 green이었다 — 즉
 * 같은 클래스의 구멍에 그 둘은 무방비였다.
 *
 * 세 장면(프롤로그·컷신·엔딩)이 완전히 같은 불변식("배경 자체는 절대 반투명해질
 * 방법이 없어야 한다")을 공유하므로, 런타임 검사도 여기 한 곳에서 세 개를 함께
 * 돈다 — 나중에 네 번째 장면(예: Task 23+)이 생겨도 SCENES 배열에 한 줄만 추가하면
 * 빠짐없이 같은 보호를 받는다.
 *
 * CSS 소스 텍스트 파싱(overlays.test.tsx의 "완전 불투명 장면이다" describe,
 * EndingView.test.tsx)은 정적 CSS 규칙만 본다 — 컴포넌트가 런타임에 인라인
 * `style={{ opacity: ... }}`나 `style={{ animation: '...' }}`을 직접 걸면 전혀
 * 잡지 못한다(Task 21 재리뷰 MU-B가 처음 지적한 종류의 구멍, Task 22가 컷신에서
 * 실제로 재현). 이 파일은 그 우회를 막는 유일한 방어선이다 — 세 장면의 루트
 * 요소가 어떤 prefers-reduced-motion 상태에서도 인라인 `opacity`·`animation`을
 * 전혀 갖지 않는지를 직접 렌더해서 확인한다.
 *
 * Fix Round 2(리뷰) — Round 1 버전은 default 모션 상태만 렌더했다. 리뷰어가
 * `CutsceneView`의 바깥 요소에 **reduced-motion 조건부로만** 인라인 animation을
 * 심어봤더니 632/632가 green이었다 — reduced-motion 경로 자체가 무검증이었다.
 * `MOTION_STATES`로 default/reduced-motion 두 상태를 각각 렌더해, "특정 모션
 * 상태에서만" 걸리는 우회까지 잡는다. 3장면 × 2상태 × 2속성 = 12경우.
 */

beforeEach(() => {
  localStorage.clear()
  useGame.getState().reset()
  useGame.getState().newGame(1)
})

interface OpaqueScene {
  /** 보고서·실패 메시지에 쓸 사람이 읽는 이름. */
  name: string
  /** 장면 루트(완전 불투명 배경) 요소의 data-testid. */
  testId: string
  /** 그 장면이 뜨도록 상태를 심고 렌더한다. */
  render(): void
}

const OPAQUE_SCENES: OpaqueScene[] = [
  {
    name: '프롤로그',
    testId: 'prologue',
    render: () => { renderWithState({}, <PrologueView />) },
  },
  {
    name: '컷신',
    testId: 'cutscene',
    render: () => { renderWithState({ cutscene: 'cutscene.promote.1' }, <CutsceneView />) },
  },
  {
    name: '엔딩',
    testId: 'ending',
    render: () => { renderEnding() },
  },
]

/** Fix Round 2 — 검사해야 할 모션 상태 두 가지. `reduced`가 boolean인 이유는
 *  `matchMediaMock`이 그 값을 그대로 받아 `(prefers-reduced-motion: reduce)`
 *  쿼리의 `matches`로 세우기 때문이다(design/testUtils.ts). */
const MOTION_STATES: { name: string; reduced: boolean }[] = [
  { name: '기본(모션 허용)', reduced: false },
  { name: 'reduced-motion', reduced: true },
]

describe('완전 불투명 장면 3종 — 런타임 인라인 스타일 불변식 (Ruling 28, Fix Round 2)', () => {
  for (const scene of OPAQUE_SCENES) {
    for (const motion of MOTION_STATES) {
      describe(`${scene.name} · ${motion.name}`, () => {
        beforeEach(() => {
          // 명시적으로 두 값 다 세운다 — "default"를 "matchMedia 자체가 없는 상태"에
          // 기대는 대신 실제로 matches:false를 등록해, 이 describe 안의 두 상태가
          // 항상 대칭적으로 검증되게 한다.
          matchMediaMock('(prefers-reduced-motion: reduce)', motion.reduced)
        })

        it(`인라인 opacity를 전혀 갖지 않는다`, () => {
          scene.render()
          const el = screen.getByTestId(scene.testId)
          expect(el.style.opacity, `${scene.testId}(${motion.name}) 요소에 인라인 opacity가 걸려 있다: "${el.style.opacity}"`).toBe('')
        })

        it(`인라인 animation을 전혀 갖지 않는다`, () => {
          scene.render()
          const el = screen.getByTestId(scene.testId)
          expect(el.style.animation, `${scene.testId}(${motion.name}) 요소에 인라인 animation이 걸려 있다: "${el.style.animation}"`).toBe('')
        })
      })
    }
  }
})

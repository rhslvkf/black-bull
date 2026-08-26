import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'

/**
 * Task 16 MU8 — 1차 개발에서 도감이 엔딩 id를 그대로 찍거나(`ENDING_NAME_KO[id] ?? id`
 * 식으로 땜질) app이 엔딩 이름을 따로 베껴 적어 core와 갈라진 결함이 있었다.
 *
 * "CodexScreen이 실제로 core의 ENDINGS를 그 자리에서 읽는가"는 리터럴 문자열 비교만으로는
 * 확인할 수 없다 — app이 값을 통째로 복제해 자기 파일에 박아 둬도(복제 시점 값이 core와
 * 같으면) 어떤 스냅샷 테스트도 통과한다. 유일하게 구별하는 방법은 core의 값 자체를
 * 바꿔치기하고, 화면이 그 변화를 그대로 반영하는지 보는 것이다 — 이 파일 하나를 위해
 * `@bb/core`를 부분 모킹한다(다른 export는 `importOriginal`로 그대로 통과시킨다).
 */
vi.mock('@bb/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@bb/core')>()
  return {
    ...actual,
    ENDINGS: actual.ENDINGS.map(e => (e.id === 'bank' ? { ...e, name: '__TEST_SENTINEL_은행이자__' } : e)),
  }
})

import { renderWithCodex } from '../testUtils'

describe('CodexScreen — 엔딩 이름의 출처 (MU8)', () => {
  it('엔딩 이름은 매 렌더마다 core의 ENDINGS에서 읽는다 — app이 따로 복제해 두지 않는다', () => {
    renderWithCodex({ endings: ['bank'] })
    // 이 테스트가 core의 ENDINGS 중 'bank'의 이름을 바꿔치기했다. 화면이 그 바뀐 값을
    // 그대로 보여주면 실제로 core를 참조한다는 뜻이다 — app이 '은행 이자보단 낫지'를
    // 자기 파일에 하드코딩해 뒀다면(1차 개발의 반복 결함) 이 mock은 아무 효과가 없고
    // 원래 문자열이 그대로 떴을 것이다.
    expect(screen.getByTestId('codex-ending-bank').textContent).toContain('__TEST_SENTINEL_은행이자__')
  })
})

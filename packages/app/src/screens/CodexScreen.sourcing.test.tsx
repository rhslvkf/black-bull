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
    // 함정: 행 전체(row.textContent)로 검사하면 이 테스트가 아무것도 못 잡는다 —
    // 수집한 엔딩 옆의 도장 그래픽(<Art id="ending.bank">)도 art/registry.tsx를 거쳐
    // core의 ENDINGS를 읽어 svg 안에 같은 이름을 굽기 때문에, app이 이름 표시 로직을
    // 자기 파일에 몰래 복제해 놓아도 도장 쪽 svg 텍스트에 sentinel이 섞여 들어와
    // row.textContent.toContain(sentinel)이 우연히 참이 돼 버린다(실측: 도장이 sentinel을
    // 보여줘도 이름 자리(<strong>)는 예전 하드코딩 값 그대로인 상태에서 이 함정에 걸려
    // 이 테스트가 조용히 통과하는 걸 직접 확인했다). 그래서 이름을 표시하는 실제
    // 엘리먼트(.codex-text strong) 하나로 좁혀 짚는다.
    const nameEl = screen.getByTestId('codex-ending-bank').querySelector('.codex-text strong')
    expect(nameEl?.textContent).toBe('__TEST_SENTINEL_은행이자__')
  })
})

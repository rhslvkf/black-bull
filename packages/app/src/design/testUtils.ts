import { afterEach } from 'vitest'

/**
 * jsdom에는 `window.matchMedia`가 없다. 이 헬퍼가 특정 미디어 쿼리 문자열에 대해
 * `matches` 값을 고정한 모킹 구현을 세운다. 등록되지 않은 쿼리는 `matches: false`를
 * 반환한다 — 실제 브라우저에서 매치되지 않는 쿼리와 같은 동작이다.
 *
 * Task 22가 같은 헬퍼를 재사용한다. 모듈을 import하는 순간 `afterEach`가 자동으로
 * 등록되어 매 테스트 뒤 모킹을 걷어낸다 — 상태가 다음 테스트로 새지 않는다.
 */
export function matchMediaMock(query: string, matches: boolean): void {
  registry.set(query, matches)
  if (!installed) {
    installed = true
    window.matchMedia = ((q: string): MediaQueryList =>
      ({
        matches: registry.get(q) ?? false,
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia
  }
}

let registry = new Map<string, boolean>()
let installed = false

/** 다음 테스트로 모킹 상태가 새지 않도록 되돌린다. 직접 부를 필요는 보통 없다 — 모듈을 import하면 자동으로 매 테스트 뒤 실행된다. */
export function resetMatchMediaMock(): void {
  registry = new Map()
  if (installed) {
    // jsdom 기본 상태(= matchMedia 없음)로 되돌린다.
    // @ts-expect-error 테스트 정리용으로 의도적으로 지운다.
    delete window.matchMedia
    installed = false
  }
}

afterEach(() => {
  resetMatchMediaMock()
})

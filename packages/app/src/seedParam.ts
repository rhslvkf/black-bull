/**
 * URL 질의 문자열에서 시드를 읽는다 — `?seed=12345`.
 *
 * **왜 있는가 (Task 24 Fix Round 4, Ruling 39).** `newGame()`은 인자가 없으면
 * `Math.random()`으로 시드를 뽑는다(app에서는 허용된다 — 금지는 core·sim의 규칙이다).
 * 그래서 `scripts/layout-audit.mjs`의 156턴 감사가 **매번 다른 판**을 돌았고, 같은 결함에
 * 대해 실행마다 다른 숫자가 나왔다(같은 뮤테이션에서 38/63 vs 11/24). **재현되지 않는
 * 게이트는 게이트가 아니다.** `@bb/core`는 결정론적이므로 시드만 고정하면 감사도 재현된다.
 *
 * 값이 없거나 정수가 아니면 `null`을 돌려주고, 호출자는 평소대로 무작위 시드를 쓴다 —
 * 즉 이 경로는 **QA 도구용 입구**이지 게임 규칙이 아니다.
 */
export function seedFromQuery(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed')
  if (raw === null || raw.trim() === '') return null
  if (!/^\d+$/.test(raw.trim())) return null
  const n = Number.parseInt(raw.trim(), 10)
  // initGame은 32비트 시드를 전제한다(createRng). 범위를 벗어난 값은 무시한다.
  if (!Number.isSafeInteger(n) || n < 0 || n > 2 ** 31 - 1) return null
  return n
}

/** 브라우저의 현재 주소에서 시드를 읽는다. 테스트 가능하도록 위 순수 함수와 분리해 둔다. */
export function seedFromLocation(): number | undefined {
  try { return seedFromQuery(window.location.search) ?? undefined } catch { return undefined }
}

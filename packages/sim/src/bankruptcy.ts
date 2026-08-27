import { totalAssets, type GameState } from '@bb/core'

/**
 * 이 판이 **파산으로 끝났는가** — 엔딩 이름이 아니라 **최종 상태의 총자산**으로 잰다.
 *
 * 이 파일이 따로 있는 이유는 한 줄짜리 식이 아까워서가 아니다. 예전 sim은
 * `bankrupt: ending === 'legend'`였고, 그러면 "`legend` 판수와 파산 판수가 일치한다"는
 * 게이트가 `id === id`가 되어 **아무것도 검사하지 않는다**(리뷰 Major 2). 판정은 두
 * 경로로 계산돼야 교차검증이 성립한다: 엔딩 쪽은 core의 `judgeEnding`이 고른 id를,
 * 파산 쪽은 여기서 상태를 직접 잰 값을 센다.
 *
 * 문제는 **두 정의가 실제 판에서는 절대 어긋나지 않는다**는 것이다 —
 * `advanceTurn`이 `judgeEnding(s, totalAssets(s) <= 0)`을 부르고 `pickEnding`이
 * `bankrupt || assets <= 0`이면 `legend`를 주므로, 완주한 판에서는 두 값이 항상 같다.
 * 그래서 옛 정의로 되돌려도 sim 스위트가 통째로 green이었다. 되돌림을 잡으려면 판의
 * **결과**가 아니라 `playOne`이 **어느 경로로 그 값을 만드는가**를 봐야 하고,
 * 그러려면 그 경로가 바꿔치기 가능한 모듈 경계에 있어야 한다.
 * `bankruptcy.test.ts`가 그 경계를 잡고 있다.
 */
export function isBankrupt(state: GameState): boolean {
  return totalAssets(state) <= 0
}

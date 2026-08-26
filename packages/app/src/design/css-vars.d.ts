/**
 * React의 `CSSProperties`는 커스텀 프로퍼티(`--x`) 인덱스 시그니처를 일부러 비워 뒀다
 * (`@types/react`의 CSSProperties 주석: "You're able to use type assertion or module
 * augmentation to add properties or an index signature of your own"). 이 저장소는
 * `as` 타입 단언을 전역 제약으로 금지하므로(1차 개발에서 여섯 번 결함으로 잡힌 항목)
 * 여기서 모듈 보강으로 연다.
 *
 * 이 컴포넌트 하나만의 문제가 아니다 — Ruling 20(jsdom은 외부 CSS를 읽지 않으므로
 * `getComputedStyle`로 값을 실측하려면 커스텀 프로퍼티를 인라인 스타일로 내려야 한다)
 * 때문에 인라인 CSS 변수를 쓰는 컴포넌트가 앞으로 계속 늘어난다(지금은
 * `StatChips`의 `--chip`). 컴포넌트마다 보강을 반복하지 않도록 공용 타입 선언
 * 파일 한 곳에 둔다.
 */
import 'react'

declare module 'react' {
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number | undefined
  }
}

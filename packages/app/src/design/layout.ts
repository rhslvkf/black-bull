/**
 * 화면 전반이 공유하는 레이아웃 상수. `design/` 아래(다른 파일: `tokens.css`·
 * `motion.ts`·`css-vars.d.ts`)에 두는 이유는 Fix Round 1 Minor 3 — 여러 컴포넌트
 * (TopBar·ActionMeter·CardTile·…)가 같은 값을 참조해야 하는데, 컴포넌트 파일 하나가
 * 그 값의 "출처"이자 다른 컴포넌트들의 상수 창고 역할까지 겸하면 앞으로 늘어날 UI
 * 태스크가 계속 그 파일을 뒤져 import해야 한다. 공용 값은 공용 위치에 둔다.
 */

/** 전역 제약의 터치 타깃 최소값. jsdom은 외부 CSS를 읽지 않으므로(design/testUtils.ts
 *  주석·CharacterStage의 260px와 같은 이유) 인라인 스타일로 내려 실측 가능하게 한다.
 *  1차 개발에서 "패딩 포함 ≥40px"을 ≥44px로 잘못 보고했던 사고가 있었다 — 여기서는
 *  min-width/min-height를 직접 숫자로 박아 그 착시가 반복될 여지를 없앤다. */
export const TOUCH_TARGET_PX = 44

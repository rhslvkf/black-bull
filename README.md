# 흑우키우기 (Black Bull)

주차 턴제 주식 육성 게임. 중소기업 3년차 직장인 **김흑우**가 3년(156턴, 1턴 = 1주) 동안
주식으로 무엇을 잃고 얻는지에 대한 이야기.

톤은 자조적 현실(매운맛)이다. 물타기·존버·상투·손절·리딩방·곱버스·빚투를 전부 다루되
미화하지 않고 결과로 대가를 보여준다.

## 실행

```bash
pnpm install
pnpm dev            # 개발 서버 (http://localhost:5173)
pnpm build          # 프로덕션 번들
pnpm preview        # 번들 미리보기 (http://localhost:4173)
pnpm test           # 전체 테스트 (core + sim + app)
pnpm typecheck      # 전체 타입체크
pnpm sim -- --runs 2000 --strategy buyhold   # 밸런싱 시뮬
```

`--strategy`는 `buyhold` · `panic` · `momentum` · `random` · `cash` 다섯 가지다.
`cash`는 매매를 전혀 하지 않고 월급만 받는 **무매매 기준선**으로, "투자할 이유가 있는
시장인가"를 재는 자다.

## 구조

- `packages/core` — 순수 함수형 게임 코어. 런타임 의존성 0개, React 의존성 없음.
  모든 규칙과 데이터가 여기 있다
- `packages/sim` — 코어를 headless로 수천 판 돌려 밸런스를 검증하는 CLI + 게이트 테스트
- `packages/app` — React + Vite 프론트엔드 (뷰 전용)

의존 방향은 `app → core`, `sim → core`뿐이고 역방향은 없다.

핵심 API는 `initGame(seed)` / `advanceTurn(state, cardIds)` / `buy` / `sell` 넷이다.
상태는 불변이고 난수는 시드 고정이라, 시드만 있으면 156턴 전체가 재현된다.
`core`·`sim`에서는 `Math.random` · `Date.now` · `new Date`를 쓰지 않는다.

## 밸런싱

**튜닝 가능한 수치는 전부 `packages/core/src/balance.ts`의 `BALANCE` 객체 하나에만 둔다.**
드리프트, 국면 전이 가중치, 엔딩 경계, 멘탈·컨디션 계수, 티어 문턱이 모두 여기 있다.
다른 파일에 숫자를 복사해 두면 시뮬로 튜닝해도 게임이 안 바뀐다.

밸런스 게이트는 `packages/sim/src/balance.test.ts`에 테스트로 박혀 있다.

| 게이트 | 뜻 |
|---|---|
| `buyhold` 파산율 < 15% | 사놓고 버티기만 해도 망하진 않는다 |
| `panic` 중앙 자산 < `buyhold` 중앙 자산 | 뇌동매매는 확실히 손해다 |
| `buyhold` 중앙 자산 > `cash` 중앙 자산 | **투자할 이유가 있다** (시장 기대수익률이 양수다) |
| `buyhold` 중앙 자산 > `cash` 중앙 자산 × 1.03 | 마진 없는 `>`는 "차이 2,906원"도 통과시킨다 |
| 종목별 최종가 상승률이 15%~95% 안에 있다 | **어떤 종목도 시드와 무관하게 확정 승리·패배가 아니다** |
| 비ETF 종목 최종가 배율의 중앙값 > 1 | **시장 자체가 3년 뒤 우상향한다** (buyhold를 통하지 않고 직접 측정) |
| `buyhold` 흔들림 발생 판이 10%~90% | **멘탈 시스템이 살아 있다** (늘 발동해도, 한 번도 안 발동해도 실패) |
| `random` 엔딩 4종 이상, 최다 엔딩 < 70% | 결과가 한 종류로 쏠리지 않는다 |

게이트를 통과시키려고 **게이트를 낮추거나 시드 창을 갈아끼우지 않는다.** 게이트가 깨지면
고쳐야 할 것은 `BALANCE` 값이다.

### 시장 모형 한 줄 요약

주가는 `국면 드리프트 × 베타 + 정규 노이즈 × 국면 변동성 + 이벤트 충격 × (1+hype) ×
BALANCE.impact.mul + 평균회귀(적정가 대비)`로 움직인다.

- **적정가(fundamental)는 매 턴 `BALANCE.fundamentalGrowth`만큼 자란다.** 국면 드리프트는
  평균회귀가 되돌리지만 이 성장분은 되돌리지 못하므로, 장기 보유가 보상받는 원천이 여기다.
  이 값이 0이면 주가는 고정된 적정가 주위를 맴돌 뿐이다.
- **이벤트 충격이 가장 큰 채널이다.** 국면 드리프트(턴당 ±0.001~0.01)보다 한 자릿수 크다.
  세기는 `BALANCE.impact.mul`로 조절하지만, **방향 편향은 이벤트 데이터 자체로 관리한다** —
  각 채널(`market` / `sector:*` / `stock:*` / `fundamentalMul`)이 양방향 이벤트를 짝으로
  갖고 가중 기대값이 0 근처여야 한다. `packages/core/src/events/content.test.ts`의
  "임팩트 채널 균형" 블록이 이걸 강제한다.
- 지수 ETF는 개별 종목·섹터 뉴스를 받지 않고 시장 충격만 받으며, 곱버스(`inv`)는 반대로 받는다.

> **밸런싱할 때 반드시 보는 두 줄.** `pnpm sim`의 **종목별 최종가 배율**과 **흔들림 겪은 판 %**.
> 자산 분위수만 보면 "10종 중 5종이 시드와 무관하게 확정 전멸"과 "멘탈 시스템이 한 번도
> 발동하지 않음"을 둘 다 놓친다 — 실제로 놓쳤다.

## 저장 스키마 — `SAVE_VERSION` 규율

`packages/app/src/store/store.ts`의 `SAVE_VERSION`은 **저장된 `GameState`의 스키마
버전**이다. `readSave()`는 버전이 다르면 그 저장을 버리고 `null`을 돌려준다.

> **`GameState`(또는 그 하위 타입)의 구조를 바꾸면 같은 커밋에서 `SAVE_VERSION`을 올린다.**

올리지 않으면 구버전 저장이 신버전 코드로 그대로 로드되고, 새 코드가 기대하는 필드가
없는 채로 렌더에 들어가 **흰 화면**이 된다. 이건 타입 검사가 못 잡는다 — 저장은
`localStorage`의 JSON이라 컴파일 타임에 존재하지 않기 때문이다. 규율로만 막을 수 있다.

구조를 바꾸는 변경의 예:
- 필드 추가·삭제·이름 변경 (`player`, `stocks`, `trackers`, `flags` …)
- 필드 의미 변경 (단위·기준 변경 포함. 예: 비율 0~1 → 0~100)
- 배열 원소 형태 변경 (`holdings[]`, `pendingChoices[]` …)

바꾸지 않아도 되는 예: `BALANCE` 숫자 튜닝, 문구·아트 교체, 렌더 전용 변경.

`SAVE_KEY`는 `SAVE_VERSION`에서 파생시킨다(`blackbull.save.v${SAVE_VERSION}`) — 리터럴로
`v1`을 박아두면 버전을 올렸을 때 키 이름만 거짓말이 된다.

저장 검증(`readSave`)을 통과해도 렌더가 죽을 수 있고(예: `holdings`가 사라진 종목을 가리킴),
저장과 무관한 코드 버그로도 죽는다. 그래서 최상위에 `ErrorBoundary`
(`packages/app/src/ErrorBoundary.tsx`)를 두고 버튼 두 개를 준다: **다시 시도**(저장을 건드리지
않는다 — 일시적 예외면 진행이 살아난다)와 **새 판으로 시작**(세이브를 지운다).
도감(`blackbull.codex.v1`)은 회차 기록이라 어느 쪽에서도 지우지 않는다.

## 아트 교체

모든 그림은 `packages/app/src/art/registry.tsx` 한 곳에 등록되고, 화면에서는
`<Art id="..." />`로만 쓴다. SVG를 AI 일러스트로 바꾸려면 registry의 해당 줄만 고친다.
게임 코드는 건드리지 않는다.

```ts
'char.tier1.shaken': { kind: 'image', src: '/art/char_t1_shaken.webp' },
```

## 설계 문서

`docs/superpowers/specs/2026-08-25-black-bull-design.md`

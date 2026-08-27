# 흑우키우기 아트 프롬프트 — 56컷

> 이 문서 하나로 게임에 필요한 그림 **56장**을 전부 뽑는다.
> 각 컷의 코드블록은 **그대로 복사해 붙여 넣으면 되는 완성된 프롬프트**다. 조립할 것이 없다.
> 슬롯 규격의 정본은 [`docs/superpowers/specs/2026-08-26-black-bull-vn-redesign.md` §5](superpowers/specs/2026-08-26-black-bull-vn-redesign.md)이고,
> 키 문자열의 정본은 `packages/app/src/art/keys.ts`의 `ArtKey` 유니온이다.

| 슬롯 | 비율 | 개수 | 쓰이는 자리 |
|---|---|---|---|
| `char.tier{0..5}.{normal,shaken,joy}` | 3:4 | 18 | 홈 화면 캐릭터 스탠딩 |
| `npc.{daebak,cho,kim,mom}.{normal,alt}` | 3:4 | 8 | 이벤트 화자 초상 |
| `bg.{office,home,street,exchange}` | 16:9 | 4 | 배경 레이어 |
| `cutscene.{promote.1~5,demote.0~4}` | 4:3 | 10 | 티어 전환 컷신 |
| `ending.*` | 1:1 | 8 | 엔딩 문서의 도장 |
| `sector.*` | 1:1 | 8 | 이벤트 섹터 아이콘 |
| | | **56** | |

`ui.*` 12종(멘탈·현금·잠금 등)은 이 목록에 없다. 이모지 폴백으로 충분하고 §5 표에도 없다.

---

## 0. 3분 요약 — 이 순서로 하면 된다

1. 아래 컷 하나를 골라 코드블록 **전체**를 복사한다.
2. ChatGPT·Gemini·Grok 아무 데나 붙여 넣고 생성한다. (도구별 요령은 [§13](#13-생성-도구별-주의사항))
3. **인물 컷 26장**(`char.*` 18 + `npc.*` 8)은 배경이 마젠타(#FF00FF)로 나온다. 그 색을 지워 투명하게 만든다. ([§12.2](#122-마젠타-배경-지우기))
4. 비율이 어긋났으면 크롭한다. 완벽하지 않아도 화면은 안 깨진다. ([§12.4](#124-비율이-어긋난-이미지가-들어오면))
5. `.webp`로 바꿔 `packages/app/public/art/`에 넣는다. ([§12.1](#121-파일-위치와-이름))
6. `registerImage('키', ...)` 한 줄을 추가한다. **키를 틀리면 조용히 무시되지 않고 에러가 난다.** ([§12.3](#123-registerimage로-꽂는다))
7. [§14 체크리스트](#14-진행-체크리스트)에 표시한다.

56장을 한 번에 다 할 필요가 없다. **한 장이 들어올 때마다 그 자리만 좋아진다** — 나머지는 폴백 SVG가 계속 화면을 채운다.

---

## 1. 왜 프롬프트 본문만 영어인가

세 도구 전부 학습 데이터의 절대다수가 영어 캡션이다. 같은 지시를 한국어로 주면
구도·조명·화풍 용어가 뭉개지고, 특히 **부정 지시("배경에 그림자를 드리우지 마라")가
한국어에서 훨씬 잘 무시된다**. 반대로 "한국 회사원", "포장마차", "소주" 같은
**문화적 소재는 영어 프롬프트에서도 정확히 전달된다** — 세 모델 모두 그 단어들을 안다.
그래서 설명은 한국어로, 프롬프트 본문은 영어로 쓴다.

---

## 2. 화풍 고정 블록

생성 도구가 셋으로 갈린다. 그림체를 붙잡아 줄 장치는 **모든 컷에 똑같은 문장을 넣는 것**
하나뿐이다. 아래 두 블록은 **56컷 전부에 토씨 하나 바꾸지 않고** 들어가 있다.
이미 각 컷의 코드블록 안에 들어 있으니 따로 붙일 필요는 없다 — 여기 적는 건 확인용이다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.
```

```text
NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

색값은 게임의 실제 디자인 토큰(`packages/app/src/design/tokens.css`)에서 가져왔다:
배경 `#0B0E13`, 패널 `#151A22`, 금색 악센트 `#E6B45A`.
네거티브의 `no green-up/red-down western chart coloring`은 실수가 아니다 —
**한국 시장은 상승이 빨강, 하락이 파랑**이고 게임 UI도 그렇게 칠해져 있다(`--up: #f0616d`, `--down: #4f8ff7`).
차트가 등장하는 컷에서 색이 반대로 나오면 한국 게임처럼 보이지 않는다.

### 2.1 구도 블록은 컷 종류마다 다르다

화풍은 전부 같지만 **구도는 같을 수 없다**. "인물을 중앙에 허리 위로"를 배경 컷이나
아이콘 컷에 붙이면 서로 모순된 지시가 된다. 그래서 종류별로 다섯 개를 따로 뒀고,
각 컷에는 그 컷에 맞는 것 하나만 들어가 있다.

| 종류 | 구도 요지 |
|---|---|
| 인물 (`char.*`, `npc.*`) | 단독 인물, 허리 위, 정면 3/4, 마젠타 배경, 화면 높이의 80% |
| 배경 (`bg.*`) | 사람 없음, 눈높이 광각, **왼쪽 1/3을 비운다**(인물이 거기 선다) |
| 컷신 (`cutscene.*`) | 인물 1~2명 + 환경, 미디엄 와이드, **하단 1/3에 여백**(자막이 깔린다) |
| 엔딩 도장 (`ending.*`) | 사각형을 꽉 채우는 원형 인장, 68px에서 읽힐 것 |
| 섹터 아이콘 (`sector.*`) | 단일 글리프, 굵은 선, **상하 15%를 비운다**(잘린다) |

왼쪽·하단·상하 여백 지시는 취향이 아니라 **실제 CSS에서 나온 제약**이다.
근거는 [§12.4](#124-비율이-어긋난-이미지가-들어오면)에 적어뒀다.

---

## 3. 주인공 고정 묘사

티어 6단계는 **다른 사람 여섯이 아니라 같은 사람의 3년**이다. 그래서 얼굴은 한 번 정하고
`char.*` 18컷과 `cutscene.*` 10컷, 합쳐 **28컷에 똑같은 문장**으로 반복한다.

```text
HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.
```

바뀌는 것은 **복장·자세·표정·소품** 넷뿐이다.

| 티어 | 이름 | 복장이 말하는 것 |
|---|---|---|
| 0 | 주린이 | 큰 사이즈 구겨진 반팔 셔츠, 넥타이 없음, 나일론 백팩, 편의점 커피 |
| 1 | 개미 | 기성복 남색 재킷, 삐뚤게 맨 싸구려 넥타이 |
| 2 | 불개미 | 소매 걷음, 넥타이 끝까지 내림, 사원증 목걸이, 폰 두 대, 에너지드링크 |
| 3 | 슬기로운 개미 | 검은 뿔테 안경, 몸에 맞는 니트 조끼, 수첩과 펜 |
| 4 | 슈퍼개미 | 맞춤 정장, 포켓스퀘어, 드레스워치, **사원증이 사라진다** |
| 5 | 큰손 | 쓰리피스, 금장 타이바와 커프스, 어깨에 걸친 카멜 코트 |

**눈은 여섯 티어 내내 같다** — 티어 5의 `normal` 프롬프트에 "비싼 옷 아래 티어 0과 같은
피곤한 눈"이라고 못 박아 뒀다. 3년을 갈아 넣어 얻은 게 옷뿐이라는 게 이 게임의 이야기다.

> 폴백 SVG(`art/parts/Character.tsx`)는 소품을 앞치마 → 넥타이 → 사원증 → 안경 →
> 포켓스퀘어 → 보타이·톱햇 순으로 쌓는다. 위 표는 그 누적 구조를 그대로 물려받되
> 양 끝 둘만 옮겼다: **티어 0의 앞치마**는 월급 받는 직장인 설정과 안 맞고,
> **티어 5의 톱햇**은 사실적인 화풍에서 코스프레로 보인다. 금색이라는 신호는 타이바로 남겼다.

---

## 4. 무드 3종 — `normal` / `shaken` / `joy`

임계는 `packages/core/src/balance.ts`와 `mental/mental.ts`에 있는 실제 값이다.

| 무드 | 조건 | 그림이 해야 할 일 |
|---|---|---|
| `normal` | 아래 둘 다 아닐 때 | 피로가 기본값. 웃지도 무너지지도 않는다 |
| `shaken` | **멘탈 ≤ 29** | 이 게임의 핵심 감정. 아래 참조 |
| `joy` | 멘탈 ≥ 70 **그리고** 투자 수익률 ≥ 5% | 티어가 오를수록 기쁨이 조용해진다 |

**흔들림(`shaken`)은 단순한 슬픔이 아니다.** 화면에서 이 무드는 캐릭터 무대 가장자리가
붉게 맥동하고(`char-stage-pulse`), 손절 카드가 잠기는 상태와 함께 뜬다. 그림도 같은 말을
해야 한다 — 그래서 6컷 전부에 **차가운 파란 화면광, 식은땀, 수축한 동공, 몸을 안쪽으로 마는
자세**를 공통으로 넣되, 무너지는 방식은 티어마다 다르게 썼다:
티어 0은 폰을 끌어안고, 티어 2는 얼굴을 감싸고, 티어 5는 자기 목의 금장 타이바를 만진다.

`joy`도 마찬가지로 여섯 개가 다르다. 티어 0은 입을 벌리고 주먹을 쥐지만,
티어 5는 **눈이 웃지 않는 미소**다.

---

## 5. 조연 4인 — `normal`과 `alt`가 뜻하는 것

이름은 `packages/app/src/design/speakers.ts`의 `NPC_NAME_KO`가 정본이다.
`normal`/`alt`의 의미는 각 인물이 실제로 등장하는 이벤트(`packages/core/data/events/*.json`)를
읽고 정했다 — **두 무드는 표정 차이가 아니라 서사의 두 국면**이다.

| 키 | 이름 | `normal` | `alt` |
|---|---|---|---|
| `daebak` | 박대박 | 계좌 인증하며 우쭐한 회식 자리 (`s_daebak_flex`, 프롤로그) | 반토막 나고 돈 빌리러 온 얼굴 (`s_daebak_loss`, `s_daebak_borrow`) |
| `cho` | 최존버 | 소주잔 돌리며 던지는 농담 반 조언 (`st_cho_advice`) | 몇 년 뒤, 진심으로 말하는 밤 (`st_cho_late`) |
| `kim` | 김실장 | 명함 내미는 영업용 미소 (`s_kim_offer`, `s_kim_tip`) | 미소가 꺼진 본색 (`st_scam_promise`, `s_kim_paid_room`) |
| `mom` | 엄마 | 전화 (`p_mom_call`) | 반찬통 들고 찾아옴 (`p_mom_visit`) |

**`alt`는 같은 사람이어야 한다.** 그래서 네 개의 `alt` 프롬프트는 전부
`the exact same 인물 - 같은 체격, 같은 얼굴, 같은 옷`으로 시작한 다음 무엇이 달라졌는지만 말한다.

---

## 6. 캐릭터 스탠딩 18컷 — `char.tier{0..5}.{normal,shaken,joy}`

홈 화면 캐릭터 무대(높이 260px)에 **바닥에 붙여 세로로 꽉 차게** 놓인다. 배경 컷이 뒤에 반투명으로 깔리고,
좌하단에 티어 배지가 얹힌다 — 그래서 **인물이 프레임 왼쪽 아래 끝까지 내려오면 배지에 가린다**.
허리 위 구도를 지키고 아래쪽에 약간 여유를 남겨라.

### 티어 0 — 주린이

### `char.tier0.normal` — 주린이 · 평상시

> 첫 매수 직전. 아직 아무것도 잃지 않았고, 아무것도 모른다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 0, the beginner): a cheap wrinkled white short-sleeve dress shirt one size too big, no tie, collar button undone, a worn grey nylon backpack strap over one shoulder, a convenience-store paper coffee cup in one hand, an old plastic-cased smartphone.

EXPRESSION AND POSE: dead-tired neutral face after overtime, mouth closed in a flat line, eyelids heavy, shoulders sagging, chin slightly down, holding the coffee cup at chest height with both hands, looking straight at the viewer with the blank stare of someone at the end of a very long day.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier0.shaken` — 주린이 · 흔들림

> 생애 첫 손실. 파란 숫자가 얼굴에 비친다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 0, the beginner): a cheap wrinkled white short-sleeve dress shirt one size too big, no tie, collar button undone, a worn grey nylon backpack strap over one shoulder, a convenience-store paper coffee cup in one hand, an old plastic-cased smartphone.

EXPRESSION AND POSE: first-ever loss, mouth open a crack, lower lip bitten, eyes wide with tiny pupils, cold sweat on the temple and the neck, shoulders pulled up and inward, both hands clutching the phone close to his chest, the phone screen throwing a cold blue glow up onto his chin and cheeks.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier0.joy` — 주린이 · 기쁨

> 수익 3만원. 세상을 다 가진 얼굴.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 0, the beginner): a cheap wrinkled white short-sleeve dress shirt one size too big, no tie, collar button undone, a worn grey nylon backpack strap over one shoulder, a convenience-store paper coffee cup in one hand, an old plastic-cased smartphone.

EXPRESSION AND POSE: an unguarded open-mouthed grin, eyes squeezed into happy crescents, eyebrows up, both fists clenched small and tight at chest height, leaning a little toward the viewer, warm gold light on the face, the naive joy of a tiny first profit.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### 티어 1 — 개미

### `char.tier1.normal` — 개미 · 평상시

> 매수 버튼이 익숙해졌다. 아직 겸손하다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 1, the small retail investor): an off-the-rack navy suit jacket with slightly long sleeves over a white shirt, a cheap dark tie knotted crooked and pulled a finger's width loose, the same old smartphone, a cheap steel wristwatch.

EXPRESSION AND POSE: calm working face, lips pressed, one eyebrow marginally higher, standing straight with the phone held flat in one hand at waist height and thumb resting on it, the other hand adjusting the crooked tie, a routine end-of-day expression.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier1.shaken` — 개미 · 흔들림

> 지하철에서 계좌를 열었다가 굳었다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 1, the small retail investor): an off-the-rack navy suit jacket with slightly long sleeves over a white shirt, a cheap dark tie knotted crooked and pulled a finger's width loose, the same old smartphone, a cheap steel wristwatch.

EXPRESSION AND POSE: frozen mid-motion, eyes locked wide on the phone in his raised hand, jaw clenched so the muscle shows, veins standing on the back of the gripping hand, the free hand half-raised as if to cover his mouth, cold blue light on one side of the face, a bead of sweat at the hairline.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier1.joy` — 개미 · 기쁨

> 처음으로 남한테 말하고 싶어진 수익률.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 1, the small retail investor): an off-the-rack navy suit jacket with slightly long sleeves over a white shirt, a cheap dark tie knotted crooked and pulled a finger's width loose, the same old smartphone, a cheap steel wristwatch.

EXPRESSION AND POSE: a wide toothy laugh with the head tipped back a little, one hand turning the phone toward the viewer at chest height with the blank screen angled away, the other hand pointing at it with the index finger, warm red glow from below, shoulders loose and open.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### 티어 2 — 불개미

### `char.tier2.normal` — 불개미 · 평상시

> 매일 새벽에 깨서 호가창을 본다. 확신에 차 있다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 2, the overheated one): shirt sleeves rolled up above the elbows, tie yanked far down, a company ID card on a lanyard swinging at his chest, two smartphones - one in his hand and one poking out of his shirt pocket, an energy drink can.

EXPRESSION AND POSE: bloodshot eyes with heavy dark circles, an unsettling calm certainty, arms folded across the chest, chin lifted slightly, one corner of the mouth marginally raised, the ID lanyard hanging crooked, hard cold light from one side.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier2.shaken` — 불개미 · 흔들림

> 확신이 무너지는 순간. 손이 얼굴로 간다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 2, the overheated one): shirt sleeves rolled up above the elbows, tie yanked far down, a company ID card on a lanyard swinging at his chest, two smartphones - one in his hand and one poking out of his shirt pocket, an energy drink can.

EXPRESSION AND POSE: both palms pressed against his own face with the fingers spread, one wide unblinking eye visible between the fingers, forehead shining with sweat, head bowed forward, the lanyard swinging, harsh blue light from below and deep shadow above.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier2.joy` — 불개미 · 기쁨

> 상한가. 자기가 옳았다고 믿는다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 2, the overheated one): shirt sleeves rolled up above the elbows, tie yanked far down, a company ID card on a lanyard swinging at his chest, two smartphones - one in his hand and one poking out of his shirt pocket, an energy drink can.

EXPRESSION AND POSE: a sharp triumphant laugh with teeth showing and the eyes not quite laughing, one hand gripping the loosened tie knot and yanking it further down, shoulders thrown back, chest forward, hot amber rim light along the jaw and shoulders.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### 티어 3 — 슬기로운 개미

### `char.tier3.normal` — 슬기로운 개미 · 평상시

> 이제 시장이 조금 보인다. 착각일 수도 있고.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 3, the one who has learned something): thin black-framed glasses, a well-fitted charcoal knit vest over a clean navy shirt, sleeves buttoned, a small paper notebook and a pen, a plain leather-strap watch.

EXPRESSION AND POSE: composed and quiet, lips together, gaze level and steady through the glasses, one hand holding the small notebook, the pen capped between two fingers of the other hand, just having looked up from writing, posture upright and relaxed, soft even light.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier3.shaken` — 슬기로운 개미 · 흔들림

> 차분함에 금이 간다. 아는 사람일수록 더 아프다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 3, the one who has learned something): thin black-framed glasses, a well-fitted charcoal knit vest over a clean navy shirt, sleeves buttoned, a small paper notebook and a pen, a plain leather-strap watch.

EXPRESSION AND POSE: the glasses taken off and dangling from one hand, the other hand pinching the bridge of his nose, eyes shut hard with the brows knotted, head tilted down, the notebook fallen against his chest, jaw tight, thin cold light across the closed eyelids.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier3.joy` — 슬기로운 개미 · 기쁨

> 요란하지 않은 기쁨. 계획대로 됐다는 얼굴.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 3, the one who has learned something): thin black-framed glasses, a well-fitted charcoal knit vest over a clean navy shirt, sleeves buttoned, a small paper notebook and a pen, a plain leather-strap watch.

EXPRESSION AND POSE: a small controlled smile with the mouth closed, eyes warm and slightly narrowed, pushing the glasses up the nose with one fingertip, a single small nod, the notebook held loosely at his side, warm gold light on the cheekbone.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### 티어 4 — 슈퍼개미

### `char.tier4.normal` — 슈퍼개미 · 평상시

> 숫자가 커졌고 표정이 없어졌다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 4, the one with real money): a tailored dark charcoal suit with peaked lapels, a folded ivory pocket square, a slim silk tie, a dress watch on the wrist, no ID lanyard anywhere.

EXPRESSION AND POSE: an expressionless composed face, eyes cool and direct at the viewer, standing square and still, one hand adjusting the watch on the opposite wrist, suit jacket buttoned, absolutely no wasted movement, hard rim light along one shoulder.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier4.shaken` — 슈퍼개미 · 흔들림

> 잃는 액수의 자릿수가 달라졌다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 4, the one with real money): a tailored dark charcoal suit with peaked lapels, a folded ivory pocket square, a slim silk tie, a dress watch on the wrist, no ID lanyard anywhere.

EXPRESSION AND POSE: the face rigid and pale, nostrils flared, tendons showing on the neck, one hand hooked into the tie knot pulling it loose with a jerk, the other hand flat on an unseen surface just out of frame, eyes staring past the viewer at nothing, sweat at the temple, cold blue light.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier4.joy` — 슈퍼개미 · 기쁨

> 웃되 소리 내지 않는다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 4, the one with real money): a tailored dark charcoal suit with peaked lapels, a folded ivory pocket square, a slim silk tie, a dress watch on the wrist, no ID lanyard anywhere.

EXPRESSION AND POSE: one corner of the mouth pulled up in a dry half-smile, eyes half-lidded and satisfied, buttoning the suit jacket with both hands in one smooth motion, chin level, warm gold light raking across the lapels.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### 티어 5 — 큰손

### `char.tier5.normal` — 큰손 · 평상시

> 누가 봐도 다른 사람이 됐다. 눈만 그대로다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 5, the whale): a midnight-navy three-piece suit, a gold tie bar and gold-rimmed cufflinks, a camel wool coat draped over both shoulders without the arms in the sleeves, a heavy watch, everything quiet and expensive.

EXPRESSION AND POSE: total stillness, no expression at all, arms folded, the camel coat slipping off one shoulder, gaze straight into the viewer and completely flat, the same tired eyes as tier 0 under the expensive clothes, deep shadow behind the jaw and a single hard rim light.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier5.shaken` — 큰손 · 흔들림

> 정상에서 흔들리는 것이 제일 무섭다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 5, the whale): a midnight-navy three-piece suit, a gold tie bar and gold-rimmed cufflinks, a camel wool coat draped over both shoulders without the arms in the sleeves, a heavy watch, everything quiet and expensive.

EXPRESSION AND POSE: the mask cracking, eyes very wide and fixed, one hand up at his own throat touching the gold tie bar as if it were choking him, the other hand curled into a fist at his side, the coat sliding off both shoulders, head pulled back slightly, cold blue light and a hard black shadow.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `char.tier5.joy` — 큰손 · 기쁨

> 기뻐서 웃는 게 아니라 이겨서 웃는다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 5, the whale): a midnight-navy three-piece suit, a gold tie bar and gold-rimmed cufflinks, a camel wool coat draped over both shoulders without the arms in the sleeves, a heavy watch, everything quiet and expensive.

EXPRESSION AND POSE: a slow closed-mouth smile that does not reach the eyes, head tilted a few degrees, one hand smoothing the lapel downward, the other in the trouser pocket, shoulders squared, warm amber light on the face and near-black shadow filling the rest.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

---

## 7. 조연 초상 8컷 — `npc.{daebak,cho,kim,mom}.{normal,alt}`

이벤트 대화창 무대의 **왼쪽 4% 지점에 바닥 정렬로, 무대 높이의 86%** 크기로 선다.
오른쪽에는 섹터 아이콘 배지가 뜨므로 인물은 왼쪽에만 있으면 된다. 주인공과 달리 이 넷은 각자 다른 사람이다 —
`HERO` 블록이 들어가지 않는 이유다.

### `npc.daebak.normal` — 박대박 · 기본 (계좌 인증하는 회식 자리)

> 단톡방에 세 자리 수익률을 올리는 라이벌. 게임의 첫 화면에 나오는 얼굴이다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: Park Dae-bak, a South Korean man in his early thirties, stocky and broad-shouldered, square jaw, thick eyebrows, a two-block haircut with the sides shaved, a wide easy grin showing teeth, cheeks and ears flushed red from soju, a short-sleeve patterned shirt with the top two buttons open, a chunky gold-tone watch. He is turning his smartphone toward the viewer with one hand to show it off, screen angled away and completely blank, a small soju glass raised in the other hand, leaning in too close, loud and delighted, warm orange restaurant light on his face.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.daebak.alt` — 박대박 · 다른 모습 (반토막 난 뒤)

> 단톡방이 조용해진 뒤, 돈을 빌려달라고 찾아온 얼굴. `s_daebak_loss`·`s_daebak_borrow`가 쓰는 무드다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: the exact same Park Dae-bak - same stocky build, square jaw, thick eyebrows, two-block haircut - but hollowed out: the grin gone, mouth a tight flat line, eyes ringed and looking down and away from the viewer, three days of stubble, hood of a grey hoodie pulled up over his head, shoulders rounded forward, both hands wrapped around a paper cup of instant coffee, gripping it too tightly, pale flat convenience-store lighting from above.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.cho.normal` — 최존버 · 기본 (소주잔 앞의 선배)

> "버티는 건 버틸 만한 걸 들고 있을 때만 하는 거야." 회복 카드 "최존버와 소주"의 그 사람이다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: Choi Jon-beo, a South Korean man in his late forties, thin and narrow-shouldered, long lined face, grey streaking through his cropped black hair, deep crow's feet, a permanently amused half-smile, wearing a stretched-out grey zip-up hoodie over a faded t-shirt. He is rolling a small soju glass slowly between his thumb and forefinger at chest height, head tilted, eyes crinkled and looking slightly past the viewer's shoulder, entirely unhurried, warm low tungsten light from one side.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.cho.alt` — 최존버 · 다른 모습 (늦은 밤의 진심)

> "몇 년 지나 보니까, 종목보다 사람이 먼저 무너지더라." 게임 후반부의 무드다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: the exact same Choi Jon-beo - same thin frame, long lined face, grey-streaked cropped hair, deep crow's feet, same stretched-out grey zip-up hoodie - but the half-smile is gone. He is leaning in toward the viewer with his shoulders hunched and both elbows braced on something just below the frame, hands loosely clasped, a cold paper cup forgotten beside them, looking straight at the viewer with a direct serious gaze, brows lowered, mouth open a little as if halfway through a sentence he has waited years to say, dim late-night blue light with one warm edge.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.kim.normal` — 김실장 · 기본 (리딩방 실장의 영업용 얼굴)

> "이번 건은 확실합니다. 딱 이번만 알려드리는 거예요."

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: Team Leader Kim, a South Korean man in his late thirties, sharp cheekbones, hair slicked straight back with too much product, an unnaturally white wide sales smile, eyes that do not smile with the mouth, a glossy slim-cut black suit with a shiny satin-finish tie, an oversized fake luxury watch, one wireless earbud in his ear. He is holding out a blank business card between two fingers toward the viewer with a small deferential bow of the head, the other hand pressed flat to his own chest, bright even flattering light like a profile photo.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.kim.alt` — 김실장 · 다른 모습 (본색)

> "원금 보장" 리딩방 결제 안내. 계약서는 없다. 사기 이벤트에 붙는 무드다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: the exact same Team Leader Kim - same sharp cheekbones, slicked-back hair, glossy slim-cut black suit, fake luxury watch - but the sales smile is switched off. Chin tucked down, eyes raised to look up at the viewer from under the brows, mouth a thin calculating line, a smartphone in each hand held low and screens dark, the earbud still in, the tie loosened one notch, harsh light from below leaving the eye sockets in shadow, cold and unfriendly.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.mom.normal` — 엄마 · 기본 (전화)

> "요즘 뭐 하고 사니. 적금은 붓고 있지?"

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: the protagonist's mother, a South Korean woman in her early sixties, short tightly permed hair, round kind face with laugh lines, small round-framed glasses, a floral blouse under a beige knit cardigan, a thin gold chain. She is holding a smartphone to her ear with one hand, the other hand resting on her hip, head tilted, eyebrows drawn together in half worry and half nagging, mouth open mid-sentence, warm soft daylight on her face.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `npc.mom.alt` — 엄마 · 다른 모습 (반찬통)

> "밥은 챙겨 먹고 다니니." 냉장고엔 지난달 반찬통이 그대로다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single character, waist-up, centered, body turned three-quarters toward the viewer, eye level, clean readable light on the face, the whole head and both shoulders inside the frame with clear margin, the figure filling about 80% of the frame height, feet and legs out of frame.

CHARACTER: the exact same mother - same short permed hair, round face, laugh lines, round glasses, floral blouse - now under a puffy sleeveless vest, both arms wrapped around a stack of three side-dish containers tied up in a cloth wrapper, a plastic bag of groceries hanging from one wrist. She is smiling with her mouth while her eyes stay worried, eyebrows raised, head pushed slightly forward as if peering past the viewer to check whether he has been eating, warm light on her face.

BACKGROUND: flat solid pure magenta #FF00FF filling every pixel behind the character, completely uniform, no gradient, no vignette, no texture, no props, no floor, no shadow cast onto the background, no drop shadow, no contact shadow, no glow or colored spill around the silhouette, crisp clean edges.

ASPECT: 3:4 vertical portrait, 1200 x 1600 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

---

## 8. 배경 4컷 — `bg.{office,home,street,exchange}`

**사람이 들어가면 안 된다.** 이 넷은 인물 뒤에 깔리는 레이어이고, 화면에서는 불투명도 55%에 채도 70%로
죽여서 쓴다(`.char-bg-layer`). 그래서 원본은 **조금 밝고 디테일이 살아 있어도 된다** — 어차피 눌린다.
반대로 대비가 너무 강하면 앞의 인물이 안 읽힌다.

### `bg.office` — 사무실 (회사 이벤트 · 밤 10시)

> `company.*` 이벤트 전부와 홈 화면 뒤에 깔린다. 야근이 기본값인 회사.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: empty establishing shot with no people and no animals anywhere in frame, eye-level wide lens, deep receding space, the left third of the frame kept visually calm and uncluttered because a character will stand there, the bottom-right corner kept free of important detail, slightly darkened overall with soft edge vignette so foreground figures read against it.

SCENE: a Korean mid-size company office at 10 p.m., rows of grey fabric-partitioned cubicles, only half the ceiling fluorescents still on so the far end of the room sinks into darkness, two monitors glowing on the nearest desk showing an unlabeled candlestick chart in red and blue with no axis text, a paper cup and a lanyard ID card left on the desk, a piled-up document tray, a printer in the corner, an office chair pushed out at an angle, wide windows along the right wall filled with the cold blue lights of a Seoul business district.

ASPECT: 16:9 horizontal, 1920 x 1080 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `bg.home` — 집 (원룸 · 새벽 2시)

> 프롤로그 3번째 장면("새벽 2시. 증권사 앱을 깔고 적금을 깬다")과 홈 화면 기본 배경, `personal.*` 이벤트.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: empty establishing shot with no people and no animals anywhere in frame, eye-level wide lens, deep receding space, the left third of the frame kept visually calm and uncluttered because a character will stand there, the bottom-right corner kept free of important detail, slightly darkened overall with soft edge vignette so foreground figures read against it.

SCENE: a cramped Seoul one-room officetel at 2 a.m., a low mattress with a crumpled duvet on the floor, a short folding table holding an open laptop that throws pale blue light across the room, a convenience-store plastic bag and an empty instant-noodle cup beside it, a drying rack of shirts, a small kitchenette with a single burner, a wall clock, the window showing the lit windows of an apartment tower across the street, everything slightly too small for an adult life.

ASPECT: 16:9 horizontal, 1920 x 1080 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `bg.street` — 거리 (밤의 상가 골목)

> `social.*` 이벤트 전부. 단톡방·회식·박대박·최존버가 사는 자리다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: empty establishing shot with no people and no animals anywhere in frame, eye-level wide lens, deep receding space, the left third of the frame kept visually calm and uncluttered because a character will stand there, the bottom-right corner kept free of important detail, slightly darkened overall with soft edge vignette so foreground figures read against it.

SCENE: a narrow Korean commercial alley at night, low-rise buildings stacked with blank glowing signboards reduced to bands of red, yellow and green light with no readable characters, orange tarpaulin awnings, a pojangmacha cart with plastic stools and folding tables outside, empty green soju bottles on a table, wet asphalt reflecting the signage, a tangle of overhead cables, an air-conditioner outdoor unit dripping, steam rising from a grill vent, no people anywhere.

ASPECT: 16:9 horizontal, 1920 x 1080 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `bg.exchange` — 거래소 (여의도 증권가 · 아침)

> `news.*`와 `story.*` 이벤트. 게임이 "시장"을 보여줄 때 쓰는 자리다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: empty establishing shot with no people and no animals anywhere in frame, eye-level wide lens, deep receding space, the left third of the frame kept visually calm and uncluttered because a character will stand there, the bottom-right corner kept free of important detail, slightly darkened overall with soft edge vignette so foreground figures read against it.

SCENE: the glass lobby of a Korean securities firm in Yeouido at opening hour, a huge wall-mounted board covered in rows of unlabeled red and blue bars and arrows with no numbers or letters, polished stone floor reflecting the board, a curved reception counter, low leather benches, a revolving door, tall glass curtain walls with cold morning sunlight cutting diagonal shafts across the floor, the Han river towers visible outside, completely empty of people.

ASPECT: 16:9 horizontal, 1920 x 1080 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

---

## 9. 티어 전환 컷신 10컷 — `cutscene.{promote,demote}.*`

자산이 티어 문턱을 넘거나 밑으로 떨어질 때 전체 화면으로 뜬다. **아래 한 줄이 그림 위에 자막으로 깔린다**
(`overlays/CutsceneView.tsx`의 `LINES`) — 프롬프트의 장면은 그 문장을 그린 것이다.
`promote.0`과 `demote.5`는 없다: 티어 0으로는 승급할 수 없고 티어 5에서는 더 오를 데가 없다.


> 컷신에는 그 티어의 `WARDROBE` 문장이 그대로 들어간다. 소품(커피컵·수첩 등)이 `SCENE`과 겹쳐 두 개로 그려지면
> **`SCENE`이 우선이다** — `WARDROBE` 문장에서 그 소품 하나만 지우고 다시 생성해라.

### `cutscene.promote.1` — 개미 승급

> 자막: “드디어 1주가 아니라 10주씩 산다.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 1, the small retail investor): an off-the-rack navy suit jacket with slightly long sleeves over a white shirt, a cheap dark tie knotted crooked and pulled a finger's width loose, the same old smartphone, a cheap steel wristwatch.

SCENE: inside a late-night subway car, the hero standing and holding the overhead strap with one hand, looking down at the phone in his other hand where a red rising line glows up onto his face, the corner of his mouth just starting to lift, empty seats and dark tunnel windows behind him, a small bright moment that he is trying not to show to the other passengers.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.promote.2` — 불개미 승급

> 자막: “이제 코스닥이 보인다. 보이면 안 되는데.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 2, the overheated one): shirt sleeves rolled up above the elbows, tie yanked far down, a company ID card on a lanyard swinging at his chest, two smartphones - one in his hand and one poking out of his shirt pocket, an energy drink can.

SCENE: the hero at 4 a.m. in his one-room, two monitors stacked with red candlestick charts filling the frame in front of him, leaning in so close his face is entirely lit red by the screens, pupils tiny, the room behind him black, an energy drink can and a phone face-up on the desk, the duvet untouched, hunger in the eyes rather than joy.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.promote.3` — 슬기로운 개미 승급

> 자막: “최존버가 처음으로 말을 걸었다. "조심해."”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 3, the one who has learned something): thin black-framed glasses, a well-fitted charcoal knit vest over a clean navy shirt, sleeves buttoned, a small paper notebook and a pen, a plain leather-strap watch.

SCENE: two men at a pojangmacha cart under an orange tarpaulin at night - on the right the hero in his glasses and knit vest, mid-turn, surprised, and on the left an older thin man in a stretched grey zip-up hoodie with grey-streaked cropped hair and deep crow's feet, who has put a hand flat on the table and is leaning in with a serious face to say something short, two soju glasses and a plate between them, warm bulb light overhead, cold blue street behind.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.promote.4` — 슈퍼개미 승급

> 자막: “숫자가 현실감을 잃기 시작한다.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 4, the one with real money): a tailored dark charcoal suit with peaked lapels, a folded ivory pocket square, a slim silk tie, a dress watch on the wrist, no ID lanyard anywhere.

SCENE: the hero standing alone at floor-to-ceiling glass high above Seoul at night, seen at three-quarter angle with his own reflection doubled in the window beside him, the city lights below smeared into long streaks that look like a rising chart, one hand hanging open at his side, face lit only by the glass, expression unreadable, the room behind him dark and empty.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.promote.5` — 큰손 승급

> 자막: “이제 내가 사면 오른다. 그게 제일 무섭다.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 5, the whale): a midnight-navy three-piece suit, a gold tie bar and gold-rimmed cufflinks, a camel wool coat draped over both shoulders without the arms in the sleeves, a heavy watch, everything quiet and expensive.

SCENE: the hero seated alone in a high-backed leather chair in a dark private office, the city spread out far below through the window behind him, a phone face-down on the empty desk, both hands resting still on the armrests, camel coat over his shoulders, his face half-lit and holding something much closer to fear than to triumph, the room enormous and silent around him.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.demote.0` — 주린이 강등

> 자막: “처음으로 돌아왔다. 시간만 썼다.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 0, the beginner): a cheap wrinkled white short-sleeve dress shirt one size too big, no tie, collar button undone, a worn grey nylon backpack strap over one shoulder, a convenience-store paper coffee cup in one hand, an old plastic-cased smartphone.

SCENE: the hero sitting on the bare floor of his one-room with his back against the bed frame, knees up, the dead black phone lying face-up beyond his reach, thin grey dawn coming through the window, a wall calendar with three years of pages torn off hanging beside him, head tipped back against the mattress, eyes open and looking at nothing, the coffee cup on the floor gone cold.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.demote.1` — 개미 강등

> 자막: “박대박한테서 카톡이 왔다. "괜찮냐?"”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 1, the small retail investor): an off-the-rack navy suit jacket with slightly long sleeves over a white shirt, a cheap dark tie knotted crooked and pulled a finger's width loose, the same old smartphone, a cheap steel wristwatch.

SCENE: the hero alone on the last subway train, sitting slumped with the crooked tie and the navy jacket half off one shoulder, a message notification lighting the phone in his lap in cold white, his face turned toward the dark window where his own reflection stares back, not reaching for the phone, empty seats stretching away behind him.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.demote.2` — 불개미 강등

> 자막: “계좌를 안 열어본 지 나흘째다.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 2, the overheated one): shirt sleeves rolled up above the elbows, tie yanked far down, a company ID card on a lanyard swinging at his chest, two smartphones - one in his hand and one poking out of his shirt pocket, an energy drink can.

SCENE: the hero at his office desk in flat grey afternoon light, the phone deliberately turned face-down beside his keyboard, the ID lanyard still crooked, sleeves rolled, staring straight ahead past his monitor at nothing with his chin on one hand, an untouched cup of coffee with a skin on it, a colleague's empty chair beside him, the whole frame drained of color.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.demote.3` — 슬기로운 개미 강등

> 자막: “올라갈 때보다 내려올 때가 훨씬 빠르다.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 3, the one who has learned something): thin black-framed glasses, a well-fitted charcoal knit vest over a clean navy shirt, sleeves buttoned, a small paper notebook and a pen, a plain leather-strap watch.

SCENE: the hero sitting on the steps of a concrete emergency stairwell between floors, glasses folded in one hand, the knit vest unbuttoned, elbows on his knees and head hanging, a single bare stairwell light above throwing a hard vertical shadow down the wall, the flights of stairs falling away below him into darkness, the notebook lying closed on the step beside him.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `cutscene.demote.4` — 슈퍼개미 강등

> 자막: “한 단계 아래로 밀려났다. 다시 처음부터.”

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: cinematic single-panel key art, one or two characters inside a real environment, medium-wide shot, strong directional light with deep shadow, the face clearly readable, calm negative space across the lower third of the frame where a caption bar will sit.

HERO (identical in every cut he appears in): a South Korean man in his early thirties, slim build, oval face with a soft jawline, single-eyelid eyes whose outer corners droop slightly, thick straight eyebrows, a small mole under his left eye, short black hair parted loosely to the left with one strand falling over his forehead, clean-shaven, faint shadows under the eyes.

WARDROBE (tier 4, the one with real money): a tailored dark charcoal suit with peaked lapels, a folded ivory pocket square, a slim silk tie, a dress watch on the wrist, no ID lanyard anywhere.

SCENE: the hero standing in a corridor outside a glass-walled meeting room, the camel coat taken off and folded over one forearm, tailored suit still immaculate, looking back over his shoulder at the empty lit room he has just left, jaw set, one hand loosening the tie, cold institutional lighting overhead, his reflection faint in the dark glass.

ASPECT: 4:3 horizontal, 1600 x 1200 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

---

## 10. 엔딩 도장 8컷 — `ending.*`

3년이 끝나면 명세서처럼 생긴 문서가 뜨고, 그 오른쪽 아래에 **68px 크기로 9도 기울어져** 찍힌다.
결정적으로 **CSS가 정사각형을 원으로 잘라낸다**(`border-radius: 50%`) — 그래서 네 모서리는 버려지는 영역이고,
도장은 **사각형을 가득 채우는 원반**이어야 한다. 문서 패널은 어두운 색(`#151A22`)이므로
종이 같은 흰 바탕을 깔면 화면에서 흰 동그라미가 된다. **잉크 색이 원반 전체를 채우게 하라.**
잉크색은 폴백 아트가 이미 쓰고 있는 엔딩별 색을 그대로 가져왔다(`art/registry.tsx`의 `ENDING_META`).

> `ending.legend`의 **흑우**는 한우 계열의 검은 소이지 월스트리트의 돌진하는 황소상이 아니다.
> 결과에 서양 황소상이 나오면 `a Korean Hanwoo black ox, not a Wall Street bull` 한 줄을 덧붙여 재생성해라.

### `ending.legend` — 흑우의 전설

> **흑우의 전설** — 계좌가 0이 됐다. 3년이 숫자 하나로 정리된다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: the skull of a Korean black ox seen head-on with long curved horns, the horns dropping downward instead of rising, one horn cracked, an empty flat line running straight through the eye sockets from rim to rim, the ink heavily broken and worn as if the stamp was pressed too hard and too many times.

INK: the whole disc is printed in #6E2B2B ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.savings` — 적금이나 들걸

> **적금이나 들걸** — 그냥 모으기만 했어도 이것보단 나았다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: a plain ceramic piggy bank in pure silhouette with a coin slot on its back, a single coin hovering just above the slot and never quite dropping in, a small crack running up the piggy bank's side, dull flat grey ink with no warmth anywhere.

INK: the whole disc is printed in #4A4A4A ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.breakeven` — 본전이 어디야

> **본전이 어디야** — 잃지도 벌지도 않았다. 3년이 사라졌을 뿐.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: one perfectly straight horizontal line crossing the whole disc from rim to rim, an arrow head pushing up against it from below and an identical arrow head pushing down against it from above so that the two exactly cancel, nothing else in the field, cold slate-blue ink.

INK: the whole disc is printed in #3F5A6B ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.bank` — 은행 이자보단 낫지

> **은행 이자보단 낫지** — 누구한테 자랑하긴 애매한 숫자.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: a single small sprout with two leaves growing out of the top coin of a short stack of three coins, the sprout modest and barely taller than the stack itself, muted green ink, deliberately unimpressive and a little bit sweet.

INK: the whole disc is printed in #3F6B52 ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.wise` — 슬기로운 투자생활

> **슬기로운 투자생활** — 이제 시장이 조금 보이는 것 같다. 착각일 수도 있고.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: a pair of round eyeglasses drawn in bold outline, with a calm rising line passing through both lenses and continuing out to the rim on each side, the line gentle rather than steep, teal-green ink, composed and quiet.

INK: the whole disc is printed in #3F7D6B ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.super` — 슈퍼개미

> **슈퍼개미** — 회사는 계속 다닌다. 그게 제일 안전하다는 걸 배웠다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: one large ant in bold silhouette seen from the side, standing firmly on a rising step-shaped line, carrying a small briefcase in one foreleg and a company lanyard card slung over its thorax, antennae up, warm gold ink, dignified rather than comic.

INK: the whole disc is printed in #A58A3F ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.fire` — 파이어족

> **파이어족** — 사표를 냈고, 아직까지는 버티고 있다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: a single sheet of paper held upright with one corner already curling and burning, the flame stylized into three clean tongues, a necktie draped over the paper's lower edge and sliding off it, warm burnt-orange ink, the fire small and controlled rather than a blaze.

INK: the whole disc is printed in #C9702A ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `ending.kimheir` — 김실장의 후예

> **김실장의 후예** — 이제 DM을 보내는 쪽이 됐다. 아무도 안 물어본 걸 알려준다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: a circular rubber-stamp seal that bleeds to all four edges of the square so the disc is the whole image, one centered emblem, flat two-tone ink with no shading, dry ink-pressed texture with a few broken and faded spots, a thin double ring just inside the rim, all meaningful detail inside the middle 70% of the disc, bold enough to read at 68 pixels wide.

EMBLEM: a megaphone in bold silhouette pointing out toward the viewer, three concentric sound arcs spreading from its mouth, and a hand with the index finger raised gripping its handle, deep violet ink, the whole emblem faintly smug.

INK: the whole disc is printed in #7A2F6B ink on a slightly lighter tint of the same hue, no white, no paper texture outside the disc.

ASPECT: 1:1 square, 1024 x 1024 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

---

## 11. 섹터 아이콘 8컷 — `sector.*`

뉴스형 이벤트(화자가 없는 이벤트)의 오른쪽 위에 **68px 배지**로 뜬다. 여덟 개가 한 세트로 보여야 하므로
색과 선 굵기를 통일했다 — **charcoal `#151A22` 바탕에 금색 `#E6B45A` 글리프 하나**.

> ⚠️ **상하 15%를 비워라.** 이 1:1 아이콘은 화면에서 4:3 창에 `object-fit: cover`로 들어가므로
> **위아래가 각각 약 12.5%씩 잘린다**. 가장자리까지 그리면 글리프가 깎인다.

> 키에 한글이 들어간다(`sector.반도체`). **키는 반드시 이 한글 그대로**여야 하지만
> **파일 이름은 영문으로 두는 것을 권한다** — 이유는 [§12.1](#121-파일-위치와-이름).

### `sector.반도체` — 반도체

> `윤슬반도체` — 변동성이 가장 낮은 대장주. 여덟 개 중 가장 정직하게 생겨야 한다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a circular silicon wafer disc with one flat edge, overlaid by a simple square die grid of nine cells and three short circuit traces running off the right side of the disc.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.2차전지` — 2차전지

> `청람소재` — 테마만 붙으면 뛰는 자리.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a prismatic battery cell standing upright with two small terminals on top and a charge-level band across its middle, a clean lightning bolt cutting diagonally across the cell body.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.바이오` — 바이오

> `나린바이오` — 임상 뉴스 한 줄에 반토막이 나는 자리.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a double helix of two twisting strands with four connecting rungs, its lower end passing through and merging into the outline of a single medicine capsule.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.조선` — 조선

> `해솔중공업` — 수주 소식으로 움직이는 중후장대.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: the bow of a large container ship seen at a three-quarter angle with three stacked container blocks on deck, a simple gantry crane arm reaching over it from the right, two short wave lines beneath the hull.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.게임` — 게임

> `도깨비게임즈` — 신작과 확률형 아이템 기사가 붙는다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a game controller seen from the front with a cross-shaped D-pad on the left, two round buttons on the right, and two grip handles, drawn as one solid connected shape.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.금융` — 금융

> `한들금융지주`, 그리고 `레버리지ETF`·`곱버스ETF`도 이 섹터로 묶인다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a stack of three coins seen edge-on with a fourth coin standing upright behind them, and a short arrow rising over the stack from left to right, no currency symbols of any kind.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.엔터` — 엔터

> `반딧불엔터` — 컴백과 열애설이 주가를 흔든다.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a handheld microphone with a mesh-textured ball head pointing up and to the right, its cable curling once below it, and two short light beams crossing behind the head.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

### `sector.방산` — 방산

> `무쇠정밀` — 여덟 섹터 중 변동성이 가장 큰 자리.

```text
STYLE: Korean webtoon illustration, clean bold ink linework, flat cel shading with a soft rim light, muted desaturated palette built on deep charcoal navy (#0B0E13) and slate grey with one warm amber-gold accent (#E6B45A), cinematic low-key lighting, contemporary Seoul, 2020s Korean office-worker life, hand-drawn digital painting.

COMPOSITION: one single flat icon glyph, centered, thick uniform strokes, rounded corners, no perspective and no shading, silhouette-legible at 24 pixels, generous even padding on all four sides with the top 15% and bottom 15% of the frame left completely empty, flat solid charcoal #151A22 background, glyph rendered in warm amber-gold #E6B45A.

GLYPH: a broad shield with a straight top edge and a pointed bottom, a single vertical ridge down its center, three rivets along the top edge, and one radar sweep arc crossing its upper left corner.

ASPECT: 1:1 square, 512 x 512 px.

NEGATIVE: no text, no letters, no hangul, no numbers, no watermark, no signature, no logo, no speech bubble, no UI overlay, no added border or frame, no blur, no low resolution, no jpeg artifacts, no photorealism, no 3D render, no western superhero comic style, no Wall Street or NYSE imagery, no charging bull statue, no dollar bills or dollar signs, no green-up/red-down western chart coloring, no extra limbs, no deformed hands.
```

---

## 12. 파일 배치와 교체 절차

### 12.1 파일 위치와 이름

```
packages/app/public/art/<파일이름>.webp
```

`public/`은 Vite가 그대로 복사하는 정적 폴더다. `packages/app/public/art/`는 **아직 없으니 처음 한 번 만들면 된다**
(현재 `public/`에는 `favicon.svg` 하나뿐이다).

파일 이름은 **아트 키를 그대로** 쓰는 것이 가장 헷갈리지 않는다 — `char.tier0.normal.webp`, `bg.office.webp`.

**딱 하나 예외: 섹터 8종.** 아트 키가 한글이라(`sector.반도체`) 파일 이름까지 한글로 두면
macOS(NFD)와 리눅스·윈도(NFC)의 유니코드 정규화가 달라 git을 오갈 때 파일을 못 찾는 사고가 난다.
**키는 한글 그대로 두고 파일 이름만 영문으로** 쓴다:

| 아트 키 (절대 바꾸지 말 것) | 권장 파일 이름 |
|---|---|
| `sector.반도체` | `sector.semiconductor.webp` |
| `sector.2차전지` | `sector.battery.webp` |
| `sector.바이오` | `sector.bio.webp` |
| `sector.조선` | `sector.shipbuilding.webp` |
| `sector.게임` | `sector.game.webp` |
| `sector.금융` | `sector.finance.webp` |
| `sector.엔터` | `sector.entertainment.webp` |
| `sector.방산` | `sector.defense.webp` |

**경로에 `/art/...`를 직접 쓰면 안 된다.** 이 게임은 GitHub Pages에 `/black-bull/` 하위 경로로 배포된다
(`packages/app/vite.config.ts`: `GITHUB_ACTIONS`일 때 `base = '/black-bull/'`, 로컬은 `'/'`).
`'/art/x.webp'`라고 쓰면 **로컬에서는 잘 보이고 배포하면 전부 404**가 난다.
반드시 `import.meta.env.BASE_URL`을 앞에 붙인다 — 아래 §12.3의 `artUrl()`이 그 일을 한다.

### 12.2 마젠타 배경 지우기

인물 26컷(`char.*` 18 + `npc.*` 8)만 해당한다. 프롬프트가 배경을 순수 마젠타(#FF00FF)로
칠하게 하고, 그 색을 지워 알파로 만든다. 프롬프트에 "그림자를 배경에 드리우지 마라"를 넣어둔 이유가 이것이다 —
바닥 그림자가 있으면 키잉했을 때 가장자리가 지저분해진다.

ImageMagick과 `cwebp`로 세 줄이면 끝난다:

```bash
# 1) 마젠타를 투명으로 (fuzz 12%에서 시작해 가장자리를 보며 조절한다)
magick in.png -fuzz 12% -transparent '#FF00FF' out.png
# 2) 실루엣 가장자리에 남은 마젠타 테두리를 알파를 1px 깎아 없앤다
magick out.png -channel A -morphology Erode Diamond:1 +channel out.png
# 3) webp로 (알파 품질은 최대로 — 인물 외곽선이 여기서 뭉개지면 티가 난다)
cwebp -q 88 -alpha_q 100 out.png -o char.tier0.normal.webp
```

알파가 없는 컷(`bg.*`, `cutscene.*`, `ending.*`, `sector.*` 30컷)은 마지막 한 줄만 하면 된다:

```bash
cwebp -q 85 in.png -o bg.office.webp
```

`cwebp`가 없으면 ImageMagick만으로도 된다 — `magick out.png -quality 88 -define webp:alpha-quality=100 out.webp`.
GUI로 하겠다면 포토샵 **색상 범위 → 유사 색상 선택**, GIMP **색상을 알파로(Color to Alpha)**가 같은 일을 한다.
자동 누끼 서비스는 쓰지 마라 — 머리카락 경계에서 마젠타 키잉보다 결과가 나쁘다.

배경이 마젠타가 아니라 회색이나 그라디언트로 나왔다면 다시 생성하는 편이 빠르다.
"완전히 균일한 순수 마젠타 배경"만 다시 강조해서 재시도하면 대체로 잡힌다.

### 12.3 `registerImage`로 꽂는다

**`packages/app/src/art/registry.tsx`를 손으로 고치지 마라.** 그 파일은 56개 슬롯 전부를
루프로 만들어내는 자리이고, 이미지 교체를 위한 통로가 따로 있다 —
`packages/app/src/art/slots.tsx`의 `registerImage(id, src)`다.

첫 이미지를 넣을 때 아래 파일을 새로 만들고, `main.tsx`에서 한 번 import하면 된다.

```ts
// packages/app/src/art/images.ts  (첫 이미지를 넣을 때 새로 만든다)
import { registerImage } from './slots'

/** public/art/ 의 파일을 base 경로(로컬 '/' · GitHub Pages '/black-bull/')에 맞춰 가리킨다. */
const artUrl = (file: string) => `${import.meta.env.BASE_URL}art/${file}`

registerImage('char.tier0.normal', artUrl('char.tier0.normal.webp'))
registerImage('sector.반도체', artUrl('sector.semiconductor.webp'))
// ...이미지가 준비된 컷만 한 줄씩 추가한다
```

```ts
// packages/app/src/main.tsx — 이 한 줄을 추가한다
import './art/images'
```

**오타는 조용히 무시되지 않는다.** `registerImage`는 첫 인자가 실제 아트 키가 아니면 예외를 던진다:

```
registerImage: "char.tier0.nomal"는 존재하지 않는 아트 키다 (ALL_ART_KEYS에 없음) — 오타를 확인해라.
```

즉 키를 틀리면 **앱이 즉시 터진다**. 한 컷만 조용히 폴백으로 남아 몇 주 뒤에 발견되는 일은 생기지 않는다.
TypeScript도 같은 것을 컴파일 타임에 잡는다(`id: ArtKey`). 마음 놓고 붙여 넣어도 된다.

등록하지 않은 컷은 그대로 폴백 SVG가 그려진다. **56장을 다 채울 때까지 화면이 깨지는 구간은 없다.**

### 12.4 비율이 어긋난 이미지가 들어오면

슬롯 컨테이너가 `aspect-ratio`로 자리를 고정하므로 **레이아웃은 절대 안 흔들린다.**
어긋난 이미지가 어떻게 처리되는지만 자리마다 다르다:

| 자리 | `object-fit` | 비율이 다르면 |
|---|---|---|
| 홈 캐릭터(`.char-fg-layer`) | `contain` | 잘리지 않는다. 높이에 맞춰 들어가고 좌우에 여백이 생긴다 (알파라 여백이 안 보인다) |
| 화자 초상(`.speaker-portrait-art`) | `contain` | 같음. 무대 높이의 86%로 바닥에 선다 |
| 그 외 전부(`.art-slot-content`) | `cover` | **잘린다.** 배경·컷신·아이콘은 중앙만 남고 넘치는 쪽이 깎인다 |

여기서 나온 실전 규칙 셋:

- **배경(16:9)**: 좌우가 조금 잘려도 괜찮게 중요한 것을 가운데 몰아라. 그리고 **왼쪽 1/3은 비워라** — 인물이 그 앞에 선다.
- **컷신(4:3)**: **하단 1/3에 여백**을 남겨라. 자막 바가 거기 깔린다.
- **섹터 아이콘(1:1)**: 4:3 창에 들어가므로 **위아래 각 12.5%가 잘린다.** 상하 15%를 비워두면 안전하다.
- **엔딩 도장(1:1)**: 네 모서리가 원으로 잘린다. 원반이 사각형을 꽉 채우게 그려라.

인물 컷은 `contain`이라 **3:4에서 조금 벗어나도 아무 문제 없다.** 세로로 길기만 하면 된다.

### 12.5 확인

```bash
pnpm --filter @bb/app dev     # 브라우저에서 실제로 보기
pnpm -r test                  # core 451 / app 647 / sim 27
```

---

## 13. 생성 도구별 주의사항

세 도구 모두 **별도의 네거티브 프롬프트 입력란이 없다.** 그래서 이 문서의 `NEGATIVE`는
토큰 나열이 아니라 `no ~` 자연어 문장으로 썼다 — 대화형 모델은 그 형태를 훨씬 잘 따른다.

### ChatGPT
- **인물 일관성이 가장 잘 유지되는 방법: 한 대화 안에서 이어서 생성한다.** 티어 6단계 18컷을
  새 대화마다 하나씩 뽑지 말고, 한 대화에서 `char.tier0.normal`부터 순서대로 이어가면
  앞 컷의 얼굴을 참고한다. 조연 4인도 인물별로 한 대화씩 잡아 `normal` → `alt` 순으로 뽑아라.
- 비율은 **정사각·세로·가로 셋으로 수렴하는 경향**이 있다. 3:4·16:9·1:1은 잘 나오지만
  **4:3(컷신 10컷)은 정사각이나 16:9로 흐르기 쉽다.** 프롬프트의 `1600 x 1200 px`를 지우지 말고,
  어긋나면 가로로 크롭해라 (`cover`로 어차피 중앙만 남는다).
- **글자를 잘 그리는 만큼 넣으려는 경향도 강하다.** 간판·모니터·도장이 있는 컷에서 글자가 나오면
  "signs and screens must be completely blank, no characters of any kind"를 한 줄 덧붙여 재생성.
- 마젠타 배경 지시는 세 도구 중 가장 잘 따른다.

### Gemini
- **가장 강한 무기는 이미지 첨부다.** 이미 뽑아 둔 컷을 첨부하고 "같은 인물, 같은 화풍, 옷과 표정만
  이렇게 바꿔서"라고 지시하면 인물 동일성이 가장 잘 유지된다. **`char.tier0.normal`을 먼저 완성한 뒤
  그 한 장을 나머지 17컷의 레퍼런스로 계속 첨부하는 방식을 권한다.**
- **부정문을 그대로 따르지 않고 오히려 그 대상을 그려 넣는 경향**이 있다. 결과에 자꾸 나오는 요소가 있으면
  네거티브에 더 적기보다 **긍정문으로 바꿔 말하는 편이 잘 먹는다** — "그림자를 넣지 마라" 대신
  "배경은 처음부터 끝까지 완전히 균일한 단색 마젠타 한 겹".
- 비율은 프롬프트 문장보다 **UI/설정의 종횡비 옵션이 우선**한다. 옵션이 있으면 거기서 먼저 맞춰라.

### Grok
- **사진처럼 흘러가는 경향이 가장 강하다.** 프롬프트 맨 앞의 `STYLE:` 줄을 절대 지우지 말고,
  그래도 사진처럼 나오면 맨 앞에 `Illustration, not a photograph.` 한 줄을 더 얹어라.
- **비율 지시가 가장 약하다.** 정사각으로 나오는 일이 잦으니 **1:1인 엔딩·섹터 16컷을 Grok에 몰아주면**
  손해가 없다. 반대로 3:4 인물 컷과 16:9 배경은 다른 도구가 낫다.
- **글자 렌더링이 가장 나쁘다.** 이 문서는 애초에 글자를 전부 금지했으므로 오히려 유리하다.
  간판·전광판은 "빛의 띠"로만 그리게 되어 있다.

### 셋 다 공통
- **한 컷이 세 번 만에 안 나오면 그 컷은 다른 도구로 넘겨라.** 같은 도구에서 다섯 번 재시도하는 것보다 빠르다.
- 인물 컷은 **얼굴만 맞으면 성공**이다. 옷 주름이나 손가락은 68~260px로 축소돼 보이지 않는다.
- 나온 그림이 애매하면 **회색조로 만들어 보고 실루엣만으로 무슨 컷인지 알아볼 수 있는지** 확인해라.
  섹터 아이콘과 엔딩 도장은 그 테스트를 통과해야 한다.

---

## 14. 진행 체크리스트

56컷. 순서는 자유지만 **왼쪽 위부터 하는 것을 권한다** — `char.tier0.*` 3컷과 `bg.home` 하나만 있어도
홈 화면과 프롤로그가 곧바로 달라 보인다.

| # | 아트 키 | 비율 | 생성 | 키잉 | 등록 |
|---|---|---|:--:|:--:|:--:|
| 1 | `char.tier0.normal` | 3:4 | ☐ | ☐ | ☐ |
| 2 | `char.tier0.shaken` | 3:4 | ☐ | ☐ | ☐ |
| 3 | `char.tier0.joy` | 3:4 | ☐ | ☐ | ☐ |
| 4 | `char.tier1.normal` | 3:4 | ☐ | ☐ | ☐ |
| 5 | `char.tier1.shaken` | 3:4 | ☐ | ☐ | ☐ |
| 6 | `char.tier1.joy` | 3:4 | ☐ | ☐ | ☐ |
| 7 | `char.tier2.normal` | 3:4 | ☐ | ☐ | ☐ |
| 8 | `char.tier2.shaken` | 3:4 | ☐ | ☐ | ☐ |
| 9 | `char.tier2.joy` | 3:4 | ☐ | ☐ | ☐ |
| 10 | `char.tier3.normal` | 3:4 | ☐ | ☐ | ☐ |
| 11 | `char.tier3.shaken` | 3:4 | ☐ | ☐ | ☐ |
| 12 | `char.tier3.joy` | 3:4 | ☐ | ☐ | ☐ |
| 13 | `char.tier4.normal` | 3:4 | ☐ | ☐ | ☐ |
| 14 | `char.tier4.shaken` | 3:4 | ☐ | ☐ | ☐ |
| 15 | `char.tier4.joy` | 3:4 | ☐ | ☐ | ☐ |
| 16 | `char.tier5.normal` | 3:4 | ☐ | ☐ | ☐ |
| 17 | `char.tier5.shaken` | 3:4 | ☐ | ☐ | ☐ |
| 18 | `char.tier5.joy` | 3:4 | ☐ | ☐ | ☐ |
| 19 | `npc.daebak.normal` | 3:4 | ☐ | ☐ | ☐ |
| 20 | `npc.daebak.alt` | 3:4 | ☐ | ☐ | ☐ |
| 21 | `npc.cho.normal` | 3:4 | ☐ | ☐ | ☐ |
| 22 | `npc.cho.alt` | 3:4 | ☐ | ☐ | ☐ |
| 23 | `npc.kim.normal` | 3:4 | ☐ | ☐ | ☐ |
| 24 | `npc.kim.alt` | 3:4 | ☐ | ☐ | ☐ |
| 25 | `npc.mom.normal` | 3:4 | ☐ | ☐ | ☐ |
| 26 | `npc.mom.alt` | 3:4 | ☐ | ☐ | ☐ |
| 27 | `bg.office` | 16:9 | ☐ | — | ☐ |
| 28 | `bg.home` | 16:9 | ☐ | — | ☐ |
| 29 | `bg.street` | 16:9 | ☐ | — | ☐ |
| 30 | `bg.exchange` | 16:9 | ☐ | — | ☐ |
| 31 | `cutscene.promote.1` | 4:3 | ☐ | — | ☐ |
| 32 | `cutscene.promote.2` | 4:3 | ☐ | — | ☐ |
| 33 | `cutscene.promote.3` | 4:3 | ☐ | — | ☐ |
| 34 | `cutscene.promote.4` | 4:3 | ☐ | — | ☐ |
| 35 | `cutscene.promote.5` | 4:3 | ☐ | — | ☐ |
| 36 | `cutscene.demote.0` | 4:3 | ☐ | — | ☐ |
| 37 | `cutscene.demote.1` | 4:3 | ☐ | — | ☐ |
| 38 | `cutscene.demote.2` | 4:3 | ☐ | — | ☐ |
| 39 | `cutscene.demote.3` | 4:3 | ☐ | — | ☐ |
| 40 | `cutscene.demote.4` | 4:3 | ☐ | — | ☐ |
| 41 | `ending.legend` | 1:1 | ☐ | — | ☐ |
| 42 | `ending.savings` | 1:1 | ☐ | — | ☐ |
| 43 | `ending.breakeven` | 1:1 | ☐ | — | ☐ |
| 44 | `ending.bank` | 1:1 | ☐ | — | ☐ |
| 45 | `ending.wise` | 1:1 | ☐ | — | ☐ |
| 46 | `ending.super` | 1:1 | ☐ | — | ☐ |
| 47 | `ending.fire` | 1:1 | ☐ | — | ☐ |
| 48 | `ending.kimheir` | 1:1 | ☐ | — | ☐ |
| 49 | `sector.반도체` | 1:1 | ☐ | — | ☐ |
| 50 | `sector.2차전지` | 1:1 | ☐ | — | ☐ |
| 51 | `sector.바이오` | 1:1 | ☐ | — | ☐ |
| 52 | `sector.조선` | 1:1 | ☐ | — | ☐ |
| 53 | `sector.게임` | 1:1 | ☐ | — | ☐ |
| 54 | `sector.금융` | 1:1 | ☐ | — | ☐ |
| 55 | `sector.엔터` | 1:1 | ☐ | — | ☐ |
| 56 | `sector.방산` | 1:1 | ☐ | — | ☐ |

☐ 를 ☑ 로 바꿔가며 채운다. **키잉 칸이 `—`인 30컷은 마젠타 배경을 지우는 작업 자체가 없다** — 생성하고 바로 넣으면 된다.

---

## 부록 A. 이 문서가 코드와 어긋나지 않게 유지하는 법

- 아트 키 56개는 `packages/app/src/art/keys.ts`의 `ArtKey` 유니온에서 그대로 나온 것이다.
  섹터가 추가되거나 엔딩이 늘면 **이 문서의 컷 수도 함께 늘어야 한다.**
- 티어 이름·엔딩 이름·섹터 이름은 `@bb/core`(`balance.ts`의 `TIER_NAMES`, `data/endings.json`,
  `market/stocks.ts`의 `SECTORS`)가 정본이다. 조연 이름은 `packages/app/src/design/speakers.ts`의 `NPC_NAME_KO`다.
- 컷신 10컷의 자막은 `packages/app/src/overlays/CutsceneView.tsx`의 `LINES`가 정본이다.
- 무드 임계(흔들림 ≤ 29, 기쁨 ≥ 70 & ROI ≥ 5%)는 `packages/core/src/balance.ts`의 `BALANCE.mental.shakenMax`,
  `BALANCE.mood`가 정본이다.

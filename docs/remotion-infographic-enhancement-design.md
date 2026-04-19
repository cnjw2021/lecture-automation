# Remotion 인포그래픽 전면 리디자인 설계서

GitHub Issue: [#69](https://github.com/cnjw2021/lecture-automation/issues/69)  
이 문서는 Remotion 슬라이드의 시각 품질을 **부분 개선이 아니라 라이브러리 단위 전면 리디자인**으로 끌어올리기 위한 구현 설계다.

## 1. 결론 먼저

이번 이슈의 핵심은 `lecture-01-03.json` 한 파일을 파일럿으로 손보는 것이 아니다.  
핵심은 아래 4가지를 한 묶음으로 처리하는 **전면 리디자인**이다.

1. 시각 기반 계층 재정비
   - 아이콘
   - 브랜드 SVG
   - typography
   - elevation / radius / color token
   - illustration / backdrop
   - semantic motion preset
2. Remotion 컴포넌트 라이브러리 전면 리디자인
3. 강의 JSON 재배치 규칙 강화 및 다강의 적용
4. component props schema validation 도입

`lecture-01-03.json`은 더 이상 scope boundary가 아니다.  
이 강의는 어디까지나 **benchmark 검증용 기준 강의**로만 사용한다.

핵심 판단:

- `docs/component-props-reference.md` 기준으로 현재 HTML/CSS 강의 커리큘럼은 기존 top-level 컴포넌트 집합으로 1차 커버 가능하다.
- 따라서 이번 이슈는 새 top-level 컴포넌트를 늘리는 것보다, **기존 컴포넌트 전면 리디자인 + asset 계층 확장 + JSON 재배치**에 집중한다.
- low-usage 컴포넌트(`BarChartScreen`, `PieChartScreen`, `VennDiagramScreen`, `HierarchyScreen`)도 이번 이슈의 핵심 범위에 포함한다. “후순위”는 우선순위일 뿐, scope 제외를 뜻하지 않는다.

---

## 2. 현재 상태 요약

### 2.1 구조적 사실

- Remotion 렌더링은 `packages/remotion/src/Root.tsx`의 `COMPONENT_MAP` 기반이다.
- `packages/automation/src/application/use-cases/ValidateLectureUseCase.ts`는 현재 component 이름 존재 여부만 검증한다.
- 설명형 컴포넌트는 공통 UI primitive 없이 각 파일에서 카드/텍스트/배경을 직접 구현한다.
- 아이콘 인프라는 이미 있다.
  - `packages/remotion/src/icons/resolveIcon.ts`
  - `packages/remotion/src/components/NodeIcon.tsx`
  - `config/icons.json`
- 현재 아이콘 resolver는 다음 순서로 동작한다.
  - brand SVG
  - `lucide-react`
  - emoji → Lucide 매핑
  - raw emoji / text fallback

### 2.2 실제 사용 편중

현재 `data/lecture-??-??.json` 기준으로 사용 빈도가 높은 것은 다음 계열이다.

| 컴포넌트 | 사용 수 |
|---|---:|
| `MyCodeScene` | 148 |
| `KeyPointScreen` | 146 |
| `CalloutScreen` | 108 |
| `DefinitionScreen` | 55 |
| `BulletDetailScreen` | 44 |
| `SummaryScreen` | 43 |
| `NumberedListScreen` | 36 |
| `TwoColumnScreen` | 35 |
| `CodeWalkthroughScreen` | 32 |
| `IconListScreen` | 31 |
| `DiagramScreen` | 9 |
| `FeatureGridScreen` | 8 |
| `TimelineScreen` | 3 |
| `BarChartScreen` | 1 |

해석:

- 실제 강의는 설명형 컴포넌트에 크게 치우쳐 있다.
- 인포그래픽 계열 컴포넌트는 존재하지만, 디자인 완성도와 JSON 활용도 모두 낮다.
- 따라서 이번 이슈는 “몇 개 컴포넌트만 예쁘게”가 아니라, **라이브러리 전체의 시각 언어를 다시 잡는 작업**이어야 한다.

### 2.3 현재 품질의 핵심 한계

1. 화면 간 시각 언어가 비슷해 장면 전환의 임팩트가 약하다.
2. typography scale, elevation, radius가 token화되지 않아 파일마다 밀도가 다르다.
3. icon resolver는 존재하지만 raw emoji fallback이 여전히 많다.
4. 브랜드/기술 SVG 자산 풀이 매우 부족하다.
5. 브랜드 SVG 외에 illustration / backdrop 자산 계층이 없다.
6. 모션은 spring 값이 있지만 semantic guideline이 없어 “읽는 순서”를 잘 안내하지 못한다.
7. low-usage 데이터 시각화 컴포넌트가 실제로는 거의 방치된 상태다.

### 2.4 아이콘 감사 결과

실제 `data/lecture-*.json`의 `icon` 필드 기준으로, Lucide/brand SVG로 치환되지 못한 raw 값이 반복적으로 남아 있다. 대표 예:

- `📦`
- `📐`
- `✍️`
- `🎉`
- `🔤`
- `🖼️`
- `📰`
- `🖱️`
- `📏`

또한 `packages/remotion/public/icons`의 brand SVG는 현재 `claude`, `chatgpt`, `cursor`, `v0` 수준에 그친다.

### 2.5 확인 경로의 한계

- `make preview`는 현재도 TTS 없이 가능하지만 정지 PNG 확인에 한정된다.
- `make render-scene`는 `durations.json`과 scene audio를 요구한다.
- 따라서 대규모 리디자인 작업을 빠르게 반복하려면 **production path와 완전히 분리된 no-audio motion preview 경로**가 필요하다.

---

## 3. 목표

- 슬라이드 퀄리티를 “정보 구조가 맞다” 수준이 아니라 “바로 좋아졌다고 느껴지는 수준”까지 끌어올린다.
- emoji 중심 표현을 icon/brand/illustration 중심 표현으로 전환한다.
- typography와 motion의 일관된 위계를 만든다.
- low-usage 데이터 시각화 컴포넌트까지 포함해 전체 라이브러리의 완성도를 맞춘다.
- JSON 작성 규칙이 실제로 고퀄 컴포넌트를 쓰도록 유도하게 만든다.
- component props schema validation으로 JSON 품질을 자동 검증한다.

## 비목표

- 새 렌더링 파이프라인 도입
- 강의 스크립트 원문 수정
- 새 top-level 컴포넌트 대량 추가
- production path에 no-audio 우회 로직 삽입

---

## 4. 설계 원칙

### 4.1 새 화면 타입보다 시각 기반 계층을 먼저 고친다

현재 문제는 “화면 종류가 부족하다”보다 “같은 화면도 충분히 고퀄로 보이지 않는다”에 가깝다.  
따라서 우선순위는:

1. icon / brand asset
2. typography / elevation / radius / color
3. illustration / backdrop
4. motion
5. 그 위의 component redesign
6. 그 다음 props 확장 / JSON 재배치

### 4.2 기존 top-level component를 유지한다

`docs/component-props-reference.md` 기준으로 HTML/CSS 강의는 현재 top-level component 집합으로 대부분 표현 가능하다.  
따라서 이번 이슈는 새 `scene.visual.component`를 추가하는 방식보다, 기존 컴포넌트들의 표현력과 품질을 끌어올리는 방식으로 간다.

### 4.3 optional props는 유지하되, 시각 품질의 주수단으로 보지 않는다

`badge`, `metric`, `emphasis` 같은 optional props는 필요하다.  
하지만 이번 이슈의 주효과는 props 개수 증가가 아니라:

- 아이콘 체계 정비
- backdrop / illustration 계층
- typography token
- semantic motion
- 컴포넌트 레이아웃 재설계

에서 나온다.

### 4.4 no-audio 확인 경로는 production path와 분리한다

- 기존 `Root.tsx`
- 기존 `make run`
- 기존 `make render-scene`
- 기존 `make concat-scenes`

에는 no-audio fallback을 넣지 않는다.

임시 확인 기능은 별도 entrypoint / composition / script로만 둔다.

### 4.5 schema validation은 장기 유지 기능으로 설계한다

schema validation은 dev-only 임시 기능이 아니다.  
다만 기존 JSON 자산이 많으므로, 초기에는 완화 모드로 시작하고 점진적으로 strict를 올린다.

### 4.6 자산 소싱과 라이선스 정책을 착수 전에 고정한다

아이콘, 일러스트, 폰트는 대량 편입 후 교체 비용이 크므로, 구현 전에 소싱 정책을 먼저 잠근다.

- 브랜드/기술 SVG: `Simple Icons`를 1차 소스로 사용
  - 저장소 라이선스는 `CC0-1.0`
  - 허용: 강의 영상 내 제품/서비스를 설명하는 정보성 맥락의 로고 노출
  - 금지: 후원, 제휴, 인증처럼 오해될 수 있는 오프닝/타이틀/크레딧 배치
  - 금지: 로고 비례/자간/형태 변형
  - `brand-tinted` variant는 단색 tone 변환까지만 허용
- 일러스트: `unDraw`를 단일 소스로 사용
  - 수정 가능
  - 출처 표기 불필요
  - 단, 자산 팩 재배포 / 경쟁 서비스 복제 / AI 학습 용도는 금지
- 폰트:
  - 일본어 기본: `Noto Sans JP`
  - 영문/숫자 metric: `Inter`
  - 둘 다 `SIL Open Font License 1.1`

혼합 소스 남발은 금지한다. 한 계층당 1차 소스를 고정해 톤과 라이선스 리스크를 같이 관리한다.

### 4.7 하위호환은 JSON 입력에 대해 보장하고, 픽셀 출력은 의도적으로 바꾼다

이번 이슈는 전면 리디자인이다. 따라서 다음을 명시적으로 원칙으로 둔다.

- 기존 JSON은 깨지지 않고 그대로 렌더 가능해야 한다.
- 단, 렌더 결과의 시각 산출물은 의도적으로 이전 버전과 크게 달라질 수 있다.
- 기존 영상과의 pixel diff가 크다는 사실 자체는 회귀가 아니라 본 이슈의 목표에 부합한다.

---

## 5. 구현 범위

### Phase 0 — Dev-Only No-Audio Preview 경로

#### 목표

- TTS 없이 레이아웃과 모션을 빠르게 확인
- 대규모 리디자인 반복 속도 확보

#### 구현 방향

- `packages/remotion/src/PreviewRoot.tsx`
- `scripts/preview-motion.mjs`
- 필요시 `scripts/render-no-audio-scene.mjs`

원칙:

- production composition import 금지
- `<Audio />` 사용 금지
- `durations.json` fallback 삽입 금지

### Phase 0.25 — Asset Sourcing / License Lock

이 phase는 구현 착수 전 선행 결정 사항이다.

#### 결정 사항

- 브랜드/기술 SVG 1차 소스: `Simple Icons`
- illustration 1차 소스: `unDraw`
- 일본어 폰트: `Noto Sans JP`
- 영문/숫자 폰트: `Inter`

#### 문서화 항목

- 자산 소스 URL 또는 패키지 출처
- 라이선스 종류
- 수정 허용 여부
- attribution 필요 여부
- 편집/배포 시 주의사항

#### 운영 원칙

- `packages/remotion/public/icons/SOURCES.md`
- `packages/remotion/public/illustrations/SOURCES.md`

같은 내부 출처 기록 파일을 유지한다.

### Phase 0.5 — 아이콘 커버리지 감사 + 브랜드 SVG 확장

#### 목표

- raw emoji fallback을 대폭 축소
- HTML/CSS/Web 제작 강의에서 반복적으로 등장하는 서비스/기술 로고를 정식 asset으로 편입

#### 작업 항목

1. `data/lecture-*.json` 전수 스캔으로 사용된 모든 `icon` 값 집합 `S` 추출
2. `S` 중 emoji 항목에서 `emojiToLucide`에 매핑이 없는 항목을 전부 보강
3. `packages/remotion/public/icons/*` 확대
4. `NodeIcon`에 variant 도입
5. `scripts/icon-coverage-check.mjs` 추가
6. `icon-coverage-check`를 dev/CI 검사 항목으로 고정

#### 매핑 원칙

- emoji → Lucide 매핑은 모양이 아니라 의미 기준으로 결정한다.
- 강의 문맥이 복수로 해석될 수 있으면 “가장 자주 쓰일 맥락”을 1차 기본값으로 잡는다.
- 예외 맥락은 JSON에서 emoji 대신 Lucide 이름을 직접 지정한다.

#### 브랜드/기술 SVG 우선 후보

- `vscode`
- `github`
- `netlify`
- `stackblitz`
- `codepen`
- `figma`
- `canva`
- `bolt`
- `html5`
- `css3`
- `chrome`

#### `NodeIcon` variant

- `brand-original`
- `brand-tinted`
- `lucide-accent`
- `lucide-muted`
- `highlighted`

즉, “항상 accent stroke 한 가지” 상태를 끝낸다.

#### variant 적용 매핑

| 컴포넌트/역할 | variant |
|---|---|
| `IconListScreen` 기본 item | `lucide-accent` |
| `IconListScreen` 비강조 item | `lucide-muted` |
| `DiagramScreen` 강조 노드 | `highlighted` |
| `DiagramScreen` 일반 노드 | `lucide-muted` 또는 `brand-tinted` |
| `TwoColumnScreen` 좌/우 컬럼 icon | `lucide-accent` |
| `FeatureGridScreen` 대표 feature | `highlighted` |
| `FeatureGridScreen` 일반 feature | `lucide-accent` |
| 브랜드 로고 중심 장면 | `brand-original` |
| 브랜드 로고를 제품군 톤에 맞춰야 하는 장면 | `brand-tinted` |

#### 완료 기준

- 전수 스캔 결과, emoji icon 집합 `S`에 대해 `emojiToLucide` 미매핑 항목 수 = 0
- 핵심 브랜드/기술 로고 SVG가 public asset으로 존재
- `NodeIcon`이 최소 4개 variant를 지원

### Phase 1 — 디자인 토큰 전면 정비

#### 목표

- typography
- elevation
- radius
- infographic color

를 semantic token으로 정리해, 파일별 inline style 편차를 제거한다.

#### 산출 방식

- modular scale ratio: `1.25`
- base text size: `18px`
- display / metric은 기본 scale에서 한 단계 더 확장 가능

#### Typography spec

| token | size | weight | line-height | letter-spacing | font |
|---|---:|---:|---:|---:|---|
| `eyebrow` | 18 | 700 | 1.2 | `0.08em` | `Inter`, fallback sans |
| `caption` | 22 | 500 | 1.35 | `0` | `Noto Sans JP`, fallback sans |
| `body` | 28 | 400 | 1.6 | `0` | `Noto Sans JP`, fallback sans |
| `title` | 44 | 800 | 1.25 | `-0.01em` | `Noto Sans JP`, fallback sans |
| `headline` | 55 | 800 | 1.2 | `-0.02em` | `Noto Sans JP`, fallback sans |
| `display` | 86 | 800 | 1.1 | `-0.03em` | `Noto Sans JP`, fallback sans |
| `metric` | 120 | 900 | 1.0 | `-0.04em` | `Inter`, fallback sans |

#### 폰트 매핑 규칙

- 일본어 문장, 일반 제목, 설명문: `Noto Sans JP`
- 영문 약어, 숫자 중심 metric, all-caps eyebrow: `Inter`
- metric 안에 일본어가 섞이는 경우:
  - 숫자/단위는 `Inter`
  - 일본어 보조 라벨은 `Noto Sans JP`

#### 폰트 로딩 규약

- 외부 네트워크 fetch에 의존하지 않고, `.woff2` 자산을 저장소에 포함한다.
- 권장 위치:
  - `packages/remotion/public/fonts/NotoSansJP-*.woff2`
  - `packages/remotion/public/fonts/Inter-*.woff2`
- 공통 로더 모듈 예:
  - `packages/remotion/src/fonts/loadFonts.ts`
- 로더 호출 위치:
  - `Root.tsx`
  - `PreviewRoot.tsx`
- 사용 weight는 실제 사용분만 포함한다.
  - `Noto Sans JP`: 400 / 500 / 700 / 800
  - `Inter`: 500 / 700 / 900
- fallback stack은 각 token에 명시한다.

#### 추가 token

```json
"elevation": {
  "subtle": "...",
  "raised": "...",
  "floating": "..."
},
"radius": {
  "panel": 24,
  "card": 18,
  "pill": 999
},
"infographic": {
  "panelBg": "...",
  "panelBgStrong": "...",
  "panelBorder": "...",
  "panelBorderStrong": "...",
  "badgeBg": "...",
  "badgeText": "...",
  "metricBg": "...",
  "metricText": "...",
  "connector": "...",
  "spotlight": "...",
  "success": "...",
  "warning": "...",
  "danger": "..."
}
```

### Phase 1.5 — Illustration / Backdrop 시스템

#### 목표

- 카드만 놓인 “빈 장면”을 줄인다
- 고퀄 느낌을 icon만이 아니라 배경 자산 계층으로 만든다

#### 자산 계층

- `packages/remotion/public/illustrations/*`
- `IllustrationPanel`
- `DecorativeBackdrop`

#### backdrop variant

- `blob`
- `mesh`
- `contour`
- `grid`
- `soft-shapes`

#### variant별 구현 기술

| variant | 구현 기술 |
|---|---|
| `blob` | inline SVG 생성 |
| `mesh` | inline SVG 생성 |
| `grid` | CSS background / gradient |
| `contour` | SVG asset + theme tint |
| `soft-shapes` | SVG asset + theme tint |

규칙:

- asset 기반 variant는 `staticFile()` 규약을 따른다.
- tint가 필요한 자산은 단색 또는 분리 가능한 SVG 계층으로 관리한다.

#### optional props 확장 대상

- `TitleScreen`
- `KeyPointScreen`
- `SummaryScreen`
- 필요시 `CalloutScreen`

예:

- `illustration?: string`
- `backdropVariant?: string`

값이 없으면 기존 렌더를 유지한다.

### Phase 2 — Semantic Motion System

#### 목표

- 모션을 “들어온다” 수준이 아니라 “읽는 순서를 안내한다” 수준으로 정리

#### preset spec

| preset | duration | spring | stagger | 용도 |
|---|---|---|---|---|
| `infographic.emphasis` | 420–520ms | damping 14 / stiffness 110 / mass 0.7 | 없음 | 핵심 headline, stat, callout 강조 |
| `infographic.sequential` | 560–720ms | damping 14 / stiffness 90 / mass 0.8 | 120ms | 리스트, 카드, 단계형 정보 |
| `infographic.flow` | 650–800ms | damping 16 / stiffness 80 / mass 0.9 | 100ms | 연결선, 흐름도, 차트, timeline |

#### 컴포넌트 적용 매핑

| 컴포넌트 | preset |
|---|---|
| `TitleScreen` | `emphasis` |
| `KeyPointScreen` | `emphasis` |
| `CalloutScreen` | `emphasis` |
| `BulletDetailScreen` | `sequential` |
| `SummaryScreen` | `sequential` |
| `IconListScreen` | `sequential` |
| `TwoColumnScreen` | `sequential` |
| `FeatureGridScreen` | `sequential` |
| `ComparisonScreen` | `sequential` + `flow` |
| `BeforeAfterScreen` | `sequential` + `flow` |
| `DiagramScreen` | `flow` |
| `TimelineScreen` | `flow` |
| `HierarchyScreen` | `flow` |
| `VennDiagramScreen` | `flow` |
| `BarChartScreen` | `flow` |
| `PieChartScreen` | `flow` |
| `StatScreen` | `emphasis` + `flow` |

주석:

- `ComparisonScreen`
  - 좌/우 point list = `sequential`
  - 중앙 `VS` 라벨 및 연결 시선 = `flow`
- `BeforeAfterScreen`
  - before/after card 내부 항목 = `sequential`
  - 가운데 화살표 / 전환 라벨 = `flow`

#### 기본 기준

- item stagger: 100~150ms
- 1씬 핵심 입장 모션 총 길이: 800ms 이내
- connector / chart / timeline edge는 draw-in 계열 유지
- backdrop motion은 미세하게만 허용

### Phase 3 — 컴포넌트 전면 리디자인

이번 이슈의 중심 phase다.  
고빈도 컴포넌트뿐 아니라 강의 인포그래픽 품질을 좌우하는 전체 컴포넌트 계층을 재설계한다.

Phase 3는 구현 가능성과 리뷰 가능성을 위해 서브 단계로 분할한다.

### Phase 3a — shared primitive 작성 + API review checkpoint

#### 대상

- `InfographicPanel`
- `MetricBadge`
- `SectionEyebrow`
- `ConnectorLabel`
- `DecorativeBackdrop`
- `IllustrationPanel`
- 필요시 `IconBadge`

#### 목표

- primitive API를 먼저 고정
- 이후 컴포넌트 리디자인 중간에 shared API가 크게 흔들리지 않게 함

#### 체크포인트

- primitive 전용 preview composition 또는 정적 preview 세트
- 최소 1회 API review checkpoint

#### 운영 원칙

- Phase 3b/3c/3d 진행 중 primitive 변경은 허용한다.
- 단, 변경 시 이미 리디자인된 상위 컴포넌트의 회귀 확인 책임을 진다.
- primitive 추가도 허용한다.
- 단, 추가된 primitive는 이후 하위 phase에서 일관되게 재사용 가능한 범용 단위여야 한다.

#### schema 동기화

- primitive 자체는 schema 대상이 아니지만, primitive를 쓰는 상위 컴포넌트의 새 props는 이 시점에 초안 작성

#### 산출물

1. primitive preview 세트
2. props-to-component 매핑표

#### props-to-component 매핑표

| component | eyebrow | badge | metric | caption | illustration | backdropVariant | subtitle | footnote |
|---|---|---|---|---|---|---|---|---|
| `TitleScreen` | - | - | - | - | O | O | - | - |
| `KeyPointScreen` | O | O | O | O | O | O | - | - |
| `CalloutScreen` | O | O | O | O | O | O | - | O |
| `BulletDetailScreen` | O | O | O | O | - | O | - | O |
| `SummaryScreen` | O | O | O | O | O | O | - | O |
| `IconListScreen` | O | O | O | O | - | O | - | O |
| `TwoColumnScreen` | O | O | O | O | - | O | O | O |
| `FeatureGridScreen` | O | O | O | O | - | O | O | O |
| `DiagramScreen` | O | O | O | O | - | O | O | O |
| `TimelineScreen` | O | O | O | O | - | O | O | O |
| `ComparisonScreen` | O | O | O | O | - | O | O | O |
| `BeforeAfterScreen` | O | O | O | O | - | O | O | O |
| `StatScreen` | O | O | O | O | - | O | O | O |
| `BarChartScreen` | O | O | O | O | - | O | O | O |
| `PieChartScreen` | O | O | O | O | - | O | O | O |
| `VennDiagramScreen` | O | O | O | O | - | O | O | O |
| `HierarchyScreen` | O | O | O | O | - | O | O | O |

주의:

- 이 표는 “허용 가능한 공식 props 범위”를 정의한다.
- 실제 구현에서 불필요한 props는 생략 가능하지만, 표 밖의 props는 새 근거 없이 추가하지 않는다.
- 3a 체크포인트에서 실제 사용 시나리오가 약한 `O` 항목은 `-`로 회수해 표를 한 번 더 정제한다.

### Phase 3b — 설명형 고빈도 컴포넌트 리디자인

#### 대상

- `TitleScreen`
- `KeyPointScreen`
- `CalloutScreen`
- `BulletDetailScreen`
- `SummaryScreen`
- `IconListScreen`
- `TwoColumnScreen`

#### 목표

- 가장 자주 보이는 장면의 퀄리티를 먼저 끌어올림

#### schema 동기화

- 이 단계가 끝날 때 해당 7개 컴포넌트의 schema entry를 같이 업데이트

#### 체크포인트

- checkpoint screenshot 묶음
- component-only motion preview 묶음

### Phase 3c — 인포그래픽 중핵 6종 리디자인

#### 대상

- `FeatureGridScreen`
- `DiagramScreen`
- `TimelineScreen`
- `ComparisonScreen`
- `BeforeAfterScreen`
- `StatScreen`

#### 목표

- 정보 구조가 강한 장면도 설명형 컴포넌트와 같은 제품군처럼 보이게 통일

#### 데이터 시각화 강화

- `StatScreen`은 metric pair / delta label / progress ring 계열 지원
- `DiagramScreen`, `TimelineScreen`은 flow preset을 기준으로 connector / edge draw-in 통일

#### schema 동기화

- 이 단계가 끝날 때 해당 6개 컴포넌트의 schema entry를 같이 업데이트

#### 체크포인트

- infographic 계열 checkpoint screenshot
- flow motion preview

### Phase 3d — 저사용 4종 리디자인

#### 대상

- `BarChartScreen`
- `PieChartScreen`
- `VennDiagramScreen`
- `HierarchyScreen`

#### 목표

- 사용 빈도와 무관하게 라이브러리 완성도를 맞춤
- “가끔 쓰면 퀄리티가 떨어진다” 상태 제거

#### schema 동기화

- 이 단계가 끝날 때 해당 4개 컴포넌트 schema entry 업데이트

#### 체크포인트

- low-usage 컴포넌트 checkpoint screenshot
- chart / hierarchy motion preview

### Phase 4 — JSON 재배치와 다강의 적용

이 phase는 “한 강의 파일럿”이 아니라 **다강의 적용**을 목표로 한다.

#### benchmark 분리

- benchmark 기준선은 JSON 파일만으로 보존하지 않는다.
- 리디자인 착수 직전 `main` 커밋에 `benchmark/issue-69-before` 태그를 부여한다.
- 해당 태그에서 실제로 렌더한 before mp4를 `docs/review/assets/` 아래에 보존한다.

#### 기준 강의

- `lecture-01-03`은 benchmark lecture이자 1차 적용 대상이지만,
  기준선은 반드시 “before render asset + before tag” 형태로 따로 보존한다.

#### 적용 범위

1차 적용 대상:

- `data/lecture-01-03.json`
- `data/lecture-02-03.json`
- `data/lecture-03-01.json`
- `data/lecture-05-03.json`

이유:

- PART 1, 2, 3, 5를 대표하는 강의로 분포를 맞춘다.
- 구조 설명, 비교 설명, 요약 설명, 숫자 설명이 모두 섞여 있어 전면 리디자인 효과를 보기 좋다.

#### PART 4 처리

- PART 4 실전 프로젝트 강의는 이번 1차 JSON 재배치 대상에서 제외한다.
- 이유:
  - browser/code/live-demo 비중이 높아 JSON 구조 재배치 효과보다 component library 개선 효과를 먼저 받는 구간이기 때문
- 단, component library 전면 리디자인의 영향은 PART 4에도 간접 적용된다.

#### 재배치 원칙

1. 같은 주제의 설명형 연속 씬은 구조형 컴포넌트로 적극 치환
2. 시간 흐름은 `TimelineScreen`
3. 관계/영향은 `DiagramScreen`
4. 전후 비교는 `BeforeAfterScreen`
5. 정량 비교는 `StatScreen` / `BarChartScreen`
6. raw emoji 중심 화면은 icon/illustration 중심 화면으로 재작성

### Phase 5 — Schema Validation 인프라 / CLI / CI 통합

#### 목표

- component 이름만 맞고 props shape가 틀린 JSON을 렌더 전에 잡는다
- Phase 3 각 서브 단계에서 작성된 schema entry를 중앙 registry, CLI, CI에 통합한다

#### 구현 방향

- `packages/automation/package.json`에 `zod` 추가
- schema registry를 `packages/automation`에 둔다

예시 파일:

- `packages/automation/src/domain/validation/remotionPropsSchemas.ts`
- `packages/automation/src/domain/validation/validateRemotionVisualProps.ts`
- 필요시 `packages/automation/src/presentation/cli/validate-lecture-schema.ts`

예시 schema entry:

```ts
const KeyPointScreenSchema = z.object({
  icon: z.string().optional(),
  headline: z.string(),
  detail: z.string().optional(),
  color: z.string().optional(),
  eyebrow: z.string().optional(),
  badge: z.string().optional(),
  metric: z.string().optional(),
  caption: z.string().optional(),
  illustration: z.string().optional(),
  backdropVariant: z.string().optional(),
}).passthrough();

const IconListScreenSchema = z.object({
  title: z.string().optional(),
  eyebrow: z.string().optional(),
  badge: z.string().optional(),
  items: z.array(z.object({
    icon: z.string(),
    title: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
    badge: z.string().optional(),
    metric: z.string().optional(),
    emphasis: z.boolean().optional(),
    connector: z.string().optional(),
  })).min(1),
  backdropVariant: z.string().optional(),
}).passthrough();
```

#### 롤아웃 전략

1. 현재 JSON이 통과하는 최소 schema 정의
2. `passthrough` 또는 완화 모드로 시작
3. CLI / test / CI에서 warning 모드 검증
4. Phase 3b / 3c / 3d 완료 시점마다 해당 컴포넌트 entry를 registry에 반영
5. 신규/수정 컴포넌트부터 strict 적용
6. 기존 JSON 정리 후 `ValidateLectureUseCase`의 hard fail 여부 결정

#### 주의점

- `playwright`, `screenshot`은 Remotion props schema와 분리
- `docs/component-props-reference.md`와 schema는 같은 작업 묶음으로 갱신

---

## 6. 파일별 실제 변경안

### 6.1 `config/video.json`

- typography token 추가
- elevation token 추가
- radius token 추가
- infographic color token 추가
- semantic animation preset 추가

### 6.2 `packages/remotion/src/theme.ts`

- `theme.typography.*`
- `theme.elevation.*`
- `theme.radius.*`
- `theme.infographic.*`

노출

### 6.3 `packages/remotion/src/icons/*`, `NodeIcon.tsx`, `config/icons.json`

- emojiToLucide 매핑 보강
- icon variant 계층 추가
- brand SVG 활용 범위 확대

### 6.4 `packages/remotion/public/icons/*`

- 브랜드/기술 SVG 자산 추가
- `SOURCES.md`로 출처/라이선스 기록

### 6.5 `packages/remotion/public/illustrations/*`

- 강의 톤에 맞는 illustration 자산 계층 추가
- `SOURCES.md`로 출처/라이선스 기록

### 6.6 `packages/remotion/src/components/shared/*`

신규 생성 권장 파일:

- `InfographicPanel.tsx`
- `MetricBadge.tsx`
- `SectionEyebrow.tsx`
- `ConnectorLabel.tsx`
- `DecorativeBackdrop.tsx`
- `IllustrationPanel.tsx`
- 필요시 `IconBadge.tsx`

### 6.7 리디자인 대상 컴포넌트 파일

- `packages/remotion/src/components/TitleScreen.tsx`
- `packages/remotion/src/components/KeyPointScreen.tsx`
- `packages/remotion/src/components/CalloutScreen.tsx`
- `packages/remotion/src/components/BulletDetailScreen.tsx`
- `packages/remotion/src/components/SummaryScreen.tsx`
- `packages/remotion/src/components/IconListScreen.tsx`
- `packages/remotion/src/components/TwoColumnScreen.tsx`
- `packages/remotion/src/components/FeatureGridScreen.tsx`
- `packages/remotion/src/components/DiagramScreen.tsx`
- `packages/remotion/src/components/TimelineScreen.tsx`
- `packages/remotion/src/components/ComparisonScreen.tsx`
- `packages/remotion/src/components/BeforeAfterScreen.tsx`
- `packages/remotion/src/components/StatScreen.tsx`
- `packages/remotion/src/components/BarChartScreen.tsx`
- `packages/remotion/src/components/PieChartScreen.tsx`
- `packages/remotion/src/components/VennDiagramScreen.tsx`
- `packages/remotion/src/components/HierarchyScreen.tsx`

원칙:

- top-level component 이름은 유지
- 기존 props는 하위호환 유지
- 새 props는 optional 우선

### 6.8 `packages/remotion/src/animation.ts`

- semantic motion preset 수용 구조로 확장
- preset spec과 component mapping을 코드 주석/설정 구조로 같이 반영

### 6.9 `docs/component-props-reference.md`

- 새 optional props 반영
- 컴포넌트 선택 기준 보강
- schema와 동기화

### 6.10 `docs/json-conversion-rules.md`

- 구조형 컴포넌트 우선 사용 규칙 강화
- icon / illustration / chart 사용 가이드 추가

### 6.11 `packages/automation` schema validation 관련 파일

- `packages/automation/src/domain/validation/remotionPropsSchemas.ts`
- `packages/automation/src/domain/validation/validateRemotionVisualProps.ts`
- 필요시 `packages/automation/src/presentation/cli/validate-lecture-schema.ts`

### 6.12 `data/*.json`

다강의 재배치 대상:

- `data/lecture-01-03.json`
- `data/lecture-02-03.json`
- `data/lecture-03-01.json`
- `data/lecture-05-03.json`

benchmark 동결본:

- `benchmark/issue-69-before` git tag
- `docs/review/assets/lecture-01-03.before.mp4`

제외:

- PART 4 강의의 JSON 재배치는 이번 1차 범위에서 제외

### 6.13 임시 no-audio 확인용 파일

- `packages/remotion/src/PreviewRoot.tsx`
- `scripts/preview-motion.mjs`
- 필요시 `scripts/render-no-audio-scene.mjs`

### 6.14 진단/검사 스크립트

- `scripts/icon-coverage-check.mjs`

---

## 7. 구현 순서

1. dev-only no-audio preview 경로 구축
2. asset sourcing / license 정책 lock + `SOURCES.md` 골격 작성
3. 아이콘 감사 + 브랜드 SVG 확장
4. typography / elevation / radius / color token 정비
5. illustration / backdrop 계층 도입
6. semantic motion preset 정비
7. `shared/*` primitive 생성 + preview composition 체크 + API review checkpoint
8. Phase 3b 설명형 고빈도 컴포넌트 리디자인 + 해당 schema entry 반영
9. Phase 3c 인포그래픽 중핵 6종 리디자인 + 해당 schema entry 반영
10. Phase 3d 저사용 4종 리디자인 + 해당 schema entry 반영
11. `component-props-reference.md` 갱신
12. `json-conversion-rules.md` 갱신
13. `benchmark/issue-69-before` 태그 생성 + before mp4 보존
14. 다강의 JSON 재배치
15. benchmark 3-way 렌더 + 평가 노트 작성
16. schema registry / CLI / CI 통합
17. validation warning → strict 롤아웃 단계 결정

---

## 8. 검증 계획

### 8.1 아이콘 감사

검증 항목:

- raw emoji fallback이 핵심 반복 아이콘에서 제거되었는가
- brand SVG 자산이 실제 강의 장면에 적용되었는가
- `NodeIcon` variant가 강조/보조 역할을 구분하는가
- 전수 스캔 결과 `emojiToLucide` 미매핑 emoji 수가 0인가

기계적 기준:

```text
S = data/lecture-*.json 전체에서 사용된 emoji icon 집합
unmapped(S) = 0
```

### 8.2 컴포넌트 단위

정지 프리뷰:

```bash
make preview LECTURE=lecture-01-03.json SCENE=8
make preview LECTURE=lecture-01-03.json SCENE=17
make preview LECTURE=lecture-01-03.json SCENE=37
```

모션 프리뷰:

```bash
node scripts/preview-motion.mjs lecture-01-03.json 8
node scripts/preview-motion.mjs lecture-01-03.json 17
```

검증 항목:

- typography 위계가 장면마다 일관적인가
- illustration/backdrop이 텍스트 가독성을 해치지 않는가
- 아이콘/브랜드 자산이 raw emoji보다 명확한가
- low-usage 차트/다이어그램 컴포넌트도 품질 저하 없이 같은 제품군처럼 보이는가

Phase별 체크포인트:

- 3a 종료: primitive preview 세트
- 3b 종료: 설명형 7종 checkpoint screenshot
- 3c 종료: 인포그래픽 6종 checkpoint screenshot
- 3d 종료: 저사용 4종 checkpoint screenshot

저장 경로 규칙:

- `docs/review/assets/phase-3a/`
- `docs/review/assets/phase-3b/`
- `docs/review/assets/phase-3c/`
- `docs/review/assets/phase-3d/`

### 8.3 씬 렌더 검증

```bash
make render-scene LECTURE=lecture-01-03.json SCENE='8 17 37'
```

검증 항목:

- stagger 100~150ms 수준 유지
- 1씬 핵심 입장 모션 800ms 이내
- connector / chart / count-up motion이 읽는 순서를 안내하는가

### 8.4 Benchmark 3-Way 비교

`lecture-01-03`은 3-way benchmark로 비교한다.

1. `before`
   - 리디자인 이전 컴포넌트 + 이전 JSON
   - `benchmark/issue-69-before` 태그에서 렌더
2. `component-only`
   - 리디자인 이후 컴포넌트 + 이전 JSON
3. `component+json`
   - 리디자인 이후 컴포넌트 + 재배치 JSON

실행 절차:

- `component-only` 렌더는 이전 JSON을 태그에서 임시 추출해 사용한다.
- 예:

```bash
git show benchmark/issue-69-before:data/lecture-01-03.json > data/lecture-01-03.before-json.tmp.json
```

- 이 임시 JSON을 현재 브랜치 컴포넌트로 렌더한 뒤, 렌더 후 tmp 파일은 삭제한다.

이 비교는 범위 제한용이 아니라, 효과 분리용 benchmark다.

평가 산출물:

- 렌더된 mp4 3개
- 비교 스크린샷 세트
- 리뷰 노트 문서 1개
  - 예: `docs/review/issue-69-benchmark-review.md`

평가 rubric:

| 항목 | 설명 | 점수 |
|---|---|---:|
| 가독성 | 제목, 본문, 수치가 즉시 읽히는가 | 1~5 |
| 정보 인지 속도 | 10초 내 핵심 구조를 파악 가능한가 | 1~5 |
| 톤 일관성 | 장면 간 시각 언어가 일관적인가 | 1~5 |
| 브랜드 적합성 | HTML/CSS/Web 제작 강의 톤과 맞는가 | 1~5 |
| 전달력 향상 | 기존 대비 이해가 쉬워졌는가 | 1~5 |

### 8.5 다강의 검증

대상:

- `lecture-01-03`
- `lecture-02-03`
- `lecture-03-01`
- `lecture-05-03`

비대상:

- PART 4 JSON 재배치

검증 포인트:

- 장면 리듬이 좋아졌는가
- 같은 타입 반복감이 줄었는가
- 코드/브라우저 씬과 시각 톤 충돌이 없는가

### 8.6 Schema Validation

검증 항목:

- 주요 Remotion component가 모두 schema registry에 등록되었는가
- 새 optional props가 문서와 schema에 동시에 반영되었는가
- 기존 정상 JSON을 과도하게 깨지 않는가
- 신규/수정 컴포넌트부터 strict 적용이 가능한가
- Phase 3b / 3c / 3d 종료 시 해당 컴포넌트 entry가 빠짐없이 추가되었는가

예:

```bash
node packages/automation/dist/presentation/cli/validate-lecture-schema.js lecture-01-03.json
```

### 8.7 PART 4 Smoke 검증

- PART 4 강의 1개를 smoke render 한다.
  - 예: `lecture-04-02.json`
- 목적:
  - 새 컴포넌트 / 새 schema 하에서 기존 JSON 입력이 깨지지 않는지 확인
- JSON 재배치는 수행하지 않는다.

---

## 9. 완료 조건

1. icon / brand SVG / illustration / backdrop 계층이 준비됨
2. typography / elevation / radius / infographic color token이 theme 계층에 정리됨
3. semantic motion preset이 도입됨
4. `shared/*` primitive가 생성되고 API review checkpoint를 통과함
5. 설명형 고빈도 컴포넌트 7종이 리디자인됨
6. 인포그래픽 중핵 6종이 리디자인됨
7. `BarChartScreen`, `PieChartScreen`, `VennDiagramScreen`, `HierarchyScreen`도 이번 이슈 범위 안에서 리디자인됨
8. 다강의 JSON 재배치가 수행됨
9. `component-props-reference.md`와 `json-conversion-rules.md`가 새 기준을 반영함
10. benchmark before 태그와 before mp4가 보존되어 있고, 3-way mp4 + 리뷰 노트가 준비됨
11. schema registry가 작성되고 warning 기반 validation이 동작함
12. no-audio preview 경로가 production path와 분리된 채 동작함

---

## 10. 보류 항목

- 강의 전체 일괄 JSON migration 스크립트 작성
- 새 top-level 컴포넌트 추가 여부 재검토
- schema validation의 production hard fail 강제 시점 확정

이 항목들은 이번 전면 리디자인 이후 후속 이슈로 분리한다.

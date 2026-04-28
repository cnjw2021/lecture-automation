# Remotion 컴포넌트 인포그래픽 마이그레이션 — Audit & Strengthen

Related: #122, #126, #127, #128

본 문서는 Epic #122 의 합격선(음성 의존도, 동시 표시 정보 단위, 시각 위계, 레퍼런스 비교, 나레이션-화면 보완)을 31개 기존 컴포넌트 + 4개 신규 컴포넌트 전체에 적용한 마이그레이션의 audit 결과 + 보강 명세를 정리한다.

## 마이그레이션 범위

| 작업 | 결과 |
|---|---|
| 기존 컴포넌트 audit & 강화 | 31개 모두 sample 렌더 → 갭 식별 → 코드 보강 |
| 신규 도메인 시각 패턴 컴포넌트 (#127) | 4개 (`CodeRenderMappingScreen`, `StructureToRenderScreen`, `FlexLayoutDiagramScreen`, `SelectorMatchScreen`) 구현 + schema + COMPONENT_MAP 등록 |
| 변환 룰 문서 갱신 | `component-props-reference.md`, `remotion-component-selection-rules.md`, `json-conversion-rules.md` 모두 신규 컴포넌트 활성 상태로 갱신 |
| audit fixture | `data/lecture-component-audit.json` (35씬, 컴포넌트별 sample 1씬씩) 커밋 |
| audit stills | `docs/assets/component-audit/after-{N}-{Component}.png` 35장 커밋 |

## 식별된 공통 갭 패턴 (보강 전)

| 패턴 | 영향받은 컴포넌트 | 적용 보강 |
|---|---|---|
| 콘텐츠 위쪽 정렬 → 하단 빈 공간 | Summary, NumberedList, Agenda, Progress, Timeline, FeatureGrid, Hierarchy, BulletDetail*, IconList*, Comparison*, BoxModel | items 컨테이너에 `flex: 1, justifyContent: 'center'` 추가 (또는 alignContent: 'center') |
| 단일 콘텐츠 블록이 작아 화면 비어 보임 | KeyPoint, Quote, Definition, QnA, Callout, EndScreen, Stat, Venn | 마커·아이콘·diameter 확대, 폰트 위계 강화 |
| 시각 데이터 표시 영역 작음 | BarChart, PieChart, Diagram*, Hierarchy, Venn | 차트 SVG dimensions, 노드 폰트, 엣지 stroke 등 확대 |
| 코드 컴포넌트 빈 영역 | MyCodeScene, CodeWalkthrough | AbsoluteFill에 flex column + center, 코드 폰트·padding 확대 |

(*는 PR #135 1차 보강에서 이미 손댔고, 본 마이그레이션에서 추가 갭은 없거나 미세 조정만 적용됨)

## 컴포넌트별 변경 요약

### 빈 공간 보강 (justify-content / align-content / flex 1)
- `BulletDetailScreen.tsx` — items container `justifyContent: 'center'`
- `IconListScreen.tsx` — items container `justifyContent: 'center'`
- `ComparisonScreen.tsx` — points container `flex: 1, justifyContent: 'center'`
- `TwoColumnScreen.tsx` — panel `display: flex column, justifyContent: center`
- `SummaryScreen.tsx` — items `justifyContent: 'center'`
- `NumberedListScreen.tsx` — AbsoluteFill flex column + items flex 1 + center
- `AgendaScreen.tsx` — AbsoluteFill flex column + items flex 1 + center
- `ProgressScreen.tsx` — steps container flex 1 + center
- `FeatureGridScreen.tsx` — grid `alignContent: 'center'`
- `HierarchyScreen.tsx` — tree container `alignItems: 'center'` + 노드 padding/font 확대

### 시각 데이터 확대
- `DiagramScreen.tsx` — edge stroke 2.5→4px, opacity 0.75→0.92
- `TimelineScreen.tsx` — eventSpacing cap 156→220, available height 재계산
- `VennDiagramScreen.tsx` — radius 210→320, overlap 80→140, 폰트 확대
- `StatScreen.tsx` — decorative rings 440→660 / 530→780 / 640→920
- `BarChartScreen.tsx` — bar height 46→68, 라벨 폭/폰트 확대
- `PieChartScreen.tsx` — chart 400→600, donut radius 158→240, 폰트 확대

### 단일 콘텐츠 강화
- `QnAScreen.tsx` — Q/A 마커 64→110, 폰트 확대, gap 24→32
- `BeforeAfterScreen.tsx` — 패널 padding 26x36→36x44, 포인트 26→30px
- `EndScreen.tsx` — next preview 칩 padding 14x36→20x48, 폰트 확대
- `MyCodeScene.tsx` — flex column + center, 폰트 35→40, padding 60→80x120
- `CodeWalkthroughScreen.tsx` — flex column + center, 라인 폰트 22→30, 라인 번호 18→24

### 신규 컴포넌트 (#127)
- `CodeRenderMappingScreen.tsx` — 좌(코드 + 라인 mapping highlight) / 우(렌더 결과: html/imageSrc/url) / 하단 mappings 범례
- `StructureToRenderScreen.tsx` — 좌(DOM tree + activeId 강조) / 우(rendered regions 카드 + URL bar)
- `FlexLayoutDiagramScreen.tsx` — properties 칩 + main/cross axis 라벨 + flex container box + items
- `SelectorMatchScreen.tsx` — selector tokens(role-colored) + DOM tree(matched MATCH 배지)

## audit stills

`docs/assets/component-audit/` 에 35장 커밋. 파일명 형식: `after-{sceneId}-{ComponentName}.png`.

음성 끈 상태에서 still 만 보고 #122 합격선 5개 항목을 점검 가능. 향후 컴포넌트 변경 시 동일 fixture 로 회귀 검증 가능.

## 후속 작업

본 마이그레이션 후 합격선 미달 항목이 발견되면 별도 이슈로 분리.

- 컴포넌트별 `stylePreset` 픽셀 반영 (현재는 schema validation 만)
- annotated image variant (Playwright 캡처 위 주석)
- 새 도메인 패턴 발견 시 #127 추가 후보로 기록

## 19강 신규 변환 재개 조건

- [x] 31 컴포넌트 audit 완료
- [x] 31 컴포넌트 보강 완료
- [x] #127 후보 4개 구현·등록 완료
- [x] 변환 룰 문서 갱신 완료
- [x] lecture-02-03 재렌더링으로 보강 효과 검증
- [ ] 본 PR (#135) 검수자 합격선 통과
- [ ] 19강 변환 시작 (PART 2-4 부터 순차)

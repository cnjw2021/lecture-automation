# Remotion 컴포넌트 선택 규칙

스크립트 내용을 Remotion 컴포넌트로 매핑할 때 사용하는 선택 기준이다. props 상세는 `docs/component-props-reference.md`를 따른다.
도메인 특화 시각 패턴의 신규/보류 판단은 `docs/remotion-domain-visual-patterns.md`를 함께 따른다.
컴포넌트 선택 후 강의 맥락별 시각 톤은 `docs/remotion-visual-style-presets.md`의 `visual.stylePreset` 정책을 따른다.

## コンポーネント選択（31種）

씬마다 아래 테이블에서 스크립트 내용에 맞는 컴포넌트를 선택한다. **동일 컴포넌트 3씬 이상 연속 금지. 연속된 씬은 내용뿐 아니라 레이아웃·컴포넌트 종류도 달라야 한다.**

props 상세는 `docs/component-props-reference.md` 참조.

주의: `CodeRenderMappingScreen`, `StructureToRenderScreen`, `FlexLayoutDiagramScreen`, `SelectorMatchScreen`은 #127 후보 명세이며 아직 활성 컴포넌트가 아니다. 현재 lecture JSON에는 사용하지 않는다.

### 기본/전환
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 강의 시작 | `TitleScreen` | 모든 강의의 첫 씬 |
| PART 전환 | `SectionBreakScreen` | 새 PART 시작 시 |
| 강의 끝 | `EndScreen` | まとめ 뒤 마지막 씬. 다음 강의 예고 → nextPreview |

### 텍스트/설명
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 핵심 개념 하나 강조 | `KeyPointScreen` | 아이콘+한 줄 요약+설명 |
| 인용, 명언 | `QuoteScreen` | 핵심 문구를 크게 보여줌 |
| 새 용어 도입 | `DefinitionScreen` | 전문 용어 첫 등장+비유/설명. term+reading+definition |
| 질문→답변 | `QnAScreen` | "〜でしょうか？" 패턴 |
| 상세 포인트 나열 | `BulletDetailScreen` | 각 항목에 제목+설명. SummaryScreen보다 정보 밀도 높음 |
| 두 개념 병렬 설명 | `TwoColumnScreen` | 대립 아닌 병렬. ComparisonScreen과 구분 |

### 리스트
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| まとめ 핵심 요약 | `SummaryScreen` | 간단한 포인트 3~5개 |
| 순서 있는 단계 | `NumberedListScreen` | 1→2→3 순서가 중요한 절차 |
| 아이콘 병렬 목록 | `IconListScreen` | 순서 무관, 아이콘 구분 항목 |
| 강의 목차 | `AgendaScreen` | "今日やること". activeIndex로 현재 위치 |
| 학습 진행 단계 | `ProgressScreen` | 로드맵에서 현재 위치 강조. **steps의 각 항목마다 반드시 별도 씬으로 분할. currentStep(1始まり)은 해당 씬의 나레이션이 설명하는 단계 번호와 일치시킬 것** |

### 비교/관계
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| A vs B 대비 | `ComparisonScreen` | 좌우 대립적 비교 |
| 전후 비교 | `BeforeAfterScreen` | 상하 배치. "従来→AI活用後" |
| 공통점/차이점 | `VennDiagramScreen` | 두 개념의 교집합 시각화 |

### 데이터 시각화
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 임팩트 숫자 강조 | `StatScreen` | "80%", "30秒" 등 하나의 수치를 크게 |
| 수치 비교 | `BarChartScreen` | 3~6개 항목 막대 비교 |
| 비율/구성비 | `PieChartScreen` | 도넛 차트로 비율 시각화 |

### 구조/도식
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 흐름도, 관계도 | `DiagramScreen` | 노드+화살표 |
| 시간순 흐름 | `TimelineScreen` | 연대기, 단계별 흐름 |
| 기능/도구 일람 | `FeatureGridScreen` | 4~6개 그리드 표시 |
| 계층/분류 구조 | `HierarchyScreen` | 트리 구조 |
| CSS 박스 모델·중첩 레이어 | `BoxModelDiagramScreen` | content/padding/border/margin처럼 포함 관계, DevTools 색상, width 계산을 한 화면에 남겨야 할 때 |

### 도메인 시각 패턴 후보

아래 패턴은 `docs/remotion-domain-visual-patterns.md`의 #127 결정표에 따라 관리한다. 활성 컴포넌트로 구현되기 전까지는 JSON에 후보 컴포넌트명을 쓰지 않는다.

| 스크립트 내용 | 상태 | 현재 선택 | 후속 후보 |
|---|---|---|---|
| 코드 행과 렌더링 결과를 연결해서 보여줘야 함 | 후보 | 단순 행 설명이면 `CodeWalkthroughScreen`, 결과가 핵심이면 가장 가까운 코드/브라우저 씬으로 분리하고 follow-up 기록 | `CodeRenderMappingScreen` |
| HTML 트리와 페이지 결과를 동시에 연결해야 함 | 후보 | 트리만 핵심이면 `HierarchyScreen`, 화면 결과만 핵심이면 `BrowserMockScreen` | `StructureToRenderScreen` |
| Flexbox 축, 정렬, 아이템 분포가 핵심 | 후보 | 단순 용어 정의는 `DefinitionScreen`, 두 개념 병렬은 `TwoColumnScreen`, 코드 설명은 `CodeWalkthroughScreen` | `FlexLayoutDiagramScreen` |
| CSS selector가 어떤 DOM 노드에 매칭되는지 보여줘야 함 | 후보 | selector 종류 나열은 `BulletDetailScreen`, CSS 문법 설명은 `CodeWalkthroughScreen` | `SelectorMatchScreen` |
| Playwright 캡처 이미지 위에 주석/하이라이트가 필요 | 보류 | 실제 조작은 `Playwright`, 정적 캡처는 `ImageScreen`, URL UI 설명은 `BrowserMockScreen` | annotated image variant |

### 강조
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 팁, 주의, 보충 | `CalloutScreen` | tip/warning/info/error |
| 실제 이미지+설명 | `ImagePlaceholderScreen` | **실제 이미지 파일이 제공된 경우에만 사용.** 이미지 없이 플레이스홀더 목적으로 사용하면 빈 영역만 표시됨 → `BrowserMockScreen` 등 대체 |

### 브라우저 UI
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 브라우저 주소창·UI 설명 | `BrowserMockScreen` | url만 지정하면 브라우저 목업 자동 렌더링. 실제 이미지 불필요 |
| 실제 사이트 캡처+브라우저 | `ImageScreen` | src(이미지 파일)+url(BrowserChrome 씌우기) |

### 코드
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 코드 첫 등장 (타이핑) | `MyCodeScene` | 코드블록을 타이핑 애니메이션으로 |
| 코드 행별 설명 | `CodeWalkthroughScreen` | 이미 보여준 코드의 특정 행 하이라이트 |

### 브라우저 녹화
| 스크립트 내용 | 컴포넌트 | 판단 기준 |
|---|---|---|
| 웹사이트 탐색 데모 | `Playwright` | type="playwright". 실제 사이트 조작 |

### 선택 우선순위 (헷갈릴 때)
- 용어 설명: term+definition 구조 → `DefinitionScreen` / 명언·인용 → `QuoteScreen`
- 항목 나열: 단순 → `SummaryScreen` / 아이콘 구분 → `IconListScreen` / 상세 설명 → `BulletDetailScreen`
- 비교: 대립 → `ComparisonScreen` / 시간 전후 → `BeforeAfterScreen` / 병렬 → `TwoColumnScreen`
- 코드: 첫 등장 → `MyCodeScene` / 행별 설명 → `CodeWalkthroughScreen`
- 단계: 절차 → `NumberedListScreen` / 시간축 → `TimelineScreen` / 현재 위치 → `ProgressScreen`
- CSS 박스 모델: 4층 위치 관계나 width 계산이 핵심 → `BoxModelDiagramScreen` / 단순 용어 나열 → `BulletDetailScreen`
- 코드와 결과 매핑: 현재 활성 컴포넌트 없음. 후보는 `CodeRenderMappingScreen`; 임시로 `CodeWalkthroughScreen`과 `BrowserMockScreen`을 인접 씬으로 나누고 follow-up 기록
- HTML 구조와 렌더 결과 매핑: 현재 활성 컴포넌트 없음. 후보는 `StructureToRenderScreen`; 트리만이면 `HierarchyScreen`, 결과만이면 `BrowserMockScreen`
- Flexbox 축/분포: 현재 활성 컴포넌트 없음. 후보는 `FlexLayoutDiagramScreen`; 단순 정의면 `DefinitionScreen`, 코드 중심이면 `CodeWalkthroughScreen`
- selector-DOM 매칭: 현재 활성 컴포넌트 없음. 후보는 `SelectorMatchScreen`; 단순 종류 나열이면 `BulletDetailScreen`
- 브라우저 UI: 이미지 없음 → `BrowserMockScreen` / 실제 캡처 이미지 있음 → `ImageScreen`

### Style preset 선택

`stylePreset`은 컴포넌트 선택을 대신하지 않는다. 먼저 위 기준으로 정보 구조에 맞는 컴포넌트를 고른 뒤, 장면의 인지 부담에 맞춰 `visual.stylePreset`을 선택한다.

| 선택한 장면 성격 | 기본 stylePreset |
|---|---|
| 새 개념을 조용히 받아들이는 설명 | `concept-calm` |
| 코드 문자를 정확히 읽어야 하는 장면 | `code-focus` |
| 실제 브라우저, AI 도구, 캡처 화면을 봐야 하는 장면 | `demo-native` |
| 좌우/전후 대비가 핵심인 장면 | `compare-contrast` |
| 순서와 현재 위치가 핵심인 장면 | `process-flow` |
| 요약, 회고, 다음 강의 연결 | `recap-synthesis` |

## Playwright / Remotion 경계

| 판단 질문 | Playwright 선택 | Remotion 선택 |
|---|---|---|
| 실제 조작 과정을 보여줘야 하는가 | 클릭, 입력, 드래그, DevTools 조작, 리로드, 시간 변화가 학습 대상 | 정적 상태와 주석만으로 개념이 전달됨 |
| 화면이 외부 사이트 상태에 의존하는가 | 실제 사이트 탐색 자체가 목표 | URL, 주소창, 결과 화면의 안정적 형태만 필요 |
| 핵심이 개념 구조나 관계인가 | 실제 조작이 구조 이해의 필수 증거일 때만 | 도식, 계층, 코드/결과 매핑, 비교, 계산식 |
| TTS 싱크 리스크가 큰가 | 조작 길이가 안정적이고 의미 있을 때만 | 타이밍보다 정보 구조가 중요하면 Remotion 우선 |
| Playwright 캡처를 재사용할 수 있는가 | 실제 UI 상태를 먼저 확보해야 할 때 | 캡처 이미지를 `ImageScreen`에 넣고 Remotion에서 설명 보강 |

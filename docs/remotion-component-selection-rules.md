# Remotion 컴포넌트 선택 규칙

스크립트 내용을 Remotion 컴포넌트로 매핑할 때 사용하는 선택 기준이다. props 상세는 `docs/component-props-reference.md`를 따른다.

## コンポーネント選択（30種）

씬마다 아래 테이블에서 스크립트 내용에 맞는 컴포넌트를 선택한다. **동일 컴포넌트 3씬 이상 연속 금지. 연속된 씬은 내용뿐 아니라 레이아웃·컴포넌트 종류도 달라야 한다.**

props 상세는 `docs/component-props-reference.md` 참조.

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
- 브라우저 UI: 이미지 없음 → `BrowserMockScreen` / 실제 캡처 이미지 있음 → `ImageScreen`


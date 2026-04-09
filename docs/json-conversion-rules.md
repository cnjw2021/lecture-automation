# 講義スクリプト → Remotion JSON 変換ルール

## 役割
확정된 강의 스크립트(마크다운)를 Remotion 동영상 생성 앱의 입력 JSON으로 변환한다. 스크립트 내용은 수정하지 않는다.

## 入出力
- 입력: 확정 스크립트 (마크다운). 1강 단위로 첨부
- 출력: `data/lecture-XX.json` (1강 = 1파일)

## JSON構造
```json
{
  "lecture_id": "01",
  "title": "講義タイトル",
  "part": 1,
  "totalDurationSec": 1200,
  "sequence": [
    {
      "scene_id": 1,
      "narration": "ナレーションテキスト",
      "durationSec": 15,
      "visual": {
        "type": "remotion",
        "component": "コンポーネント名",
        "props": { },
        "transition": {
          "enter": "fade",
          "exit": "fade"
        }
      }
    }
  ]
}
```
- Playwright 씬은 `"type": "playwright"`, `"action": [...]` (component 없음)

## シーン分割ルール
1. `【スライド: ○○○】` → 새 씬
2. 코드블록 (```html 등) → 새 씬 (MyCodeScene 또는 CodeWalkthroughScreen)
3. 내용 전환점 → 새 씬. 30초 초과 시 분할
4. 강의 시작 → TitleScreen (PART 첫 강의면 뒤에 SectionBreakScreen 추가)
5. 강의 끝 → SummaryScreen → EndScreen
6. **ProgressScreen 사용 시: steps의 각 항목마다 반드시 별도 씬으로 분할. currentStep은 해당 씬의 나레이션이 설명하는 단계 번호와 일치해야 한다. 단계를 건너뛰거나 하나의 씬에서 여러 단계를 묶는 것 금지.**
7. `【AIデモ: ○○○】` → Playwright 씬. AI 응답 대기 시간을 고려하여 durationSec를 넉넉하게 산출 (나레이션 글자수 기반 + 예상 대기 시간)

## 講義必須フロー
TitleScreen → [SectionBreakScreen] → [AgendaScreen] → 본편 → SummaryScreen → EndScreen

## 時間算出
- 1초 ≒ 5자(일본어). 例: 75자 → 15초
- 코드 씬: 타이핑 2초 + 읽기 시간 추가
- AIデモ씬(wait_for 포함 Playwright): 나레이션 글자수 기반 시간 + AI 응답 대기 시간(10~30초). 라이브 데모는 최대 60초까지 허용
- 씬 길이: 최소 5초, 일반 10~25초, 최대 30초 (AIデモ씬은 최대 60초)

## トランジションルール
- 기본: 생략(=fade)
- TitleScreen, SectionBreakScreen: `enter: "zoom"`
- 코드 씬: `enter: "slide-up"`
- 섹션 전환: `enter: "slide-left"`
- EndScreen: `exit: "zoom"`

## ナレーション作成ルール

### 記号禁止
- ❌ `——`(em 대시) 사용 금지 — TTS가 "マイナス"로 읽음
- ❌ `（）` 괄호로 보충 설명 삽입 금지 — TTS 모델에 따라 괄호 내용까지 읽어 부자연스러움
  - 보충 설명 삽입형 `A——B——C` → `A、つまりB、C` 또는 `A、たとえばB、C`
  - 단독 접속형 `A——B` → `A、B` 또는 `A。B`

### 英語表記禁止
- ❌ 나레이션에 영어 단어 직접 사용 금지 — TTS 엔진마다 발음이 달라짐
- ✅ 반드시 カタカナ로 변환해서 기재

| 영어 | カタカナ |
|------|---------|
| Web | ウェブ |
| URL | ユーアールエル |
| Enter | エンター |
| Chrome / Safari / Edge | クローム / サファリ / エッジ |
| IP | アイピー |
| DNS | ディーエヌエス |
| HTTP | エイチティーティーピー |
| HTTPS | エイチティーティーピーエス |
| HTML | エイチティーエムエル |
| CSS | シーエスエス |
| JavaScript | ジャバスクリプト |
| PART | パート |
| Google / YouTube / Amazon / Yahoo | グーグル / ユーチューブ / アマゾン / ヤフー |

- 예외: `google.com` 같은 도메인명은 나레이션에서 직접 언급 대신 "グーグルのアドレス" 등으로 우회

### visualのテキスト表記
- 화면에 표시되는 props(title, headline, items 등)는 영어·일본어 병기 가능
- 나레이션만 カタカナ 전용 규칙 적용

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
| 학습 진행 단계 | `ProgressScreen` | 로드맵에서 현재 위치 강조. **steps의 각 항목 = 별도 씬, currentStep은 나레이션 단계와 반드시 일치** |

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
| 실제 이미지+설명 | `ImagePlaceholderScreen` | **실제 이미지 파일이 제공된 경우에만 사용.** 이미지 없이 플레이스홀더 목적으로 사용 금지 → 내용에 맞는 다른 컴포넌트 선택 |

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

## Playwright 씬 설계 규칙

Playwright 씬(`"type": "playwright"`)을 작성할 때 반드시 준수해야 하는 규칙.

### action 형식

**모든 액션은 `{"cmd": "액션명", "파라미터": "값"}` 형식 필수.**

```json
// ✅ 올바른 형식
{"cmd": "goto", "url": "https://www.yahoo.co.jp"}
{"cmd": "wait", "ms": 3000}
{"cmd": "highlight", "selector": "body", "note": "설명"}

// ❌ 잘못된 형식 (액션 미인식 → 녹화 1~2초만에 종료됨)
{"goto": "https://www.yahoo.co.jp"}
{"wait": 3000}
{"highlight": "body", "note": "설명"}
```

### 스크립트 내용 → action 패턴 매핑

| 스크립트 내용 | 사용할 action | 금지 |
|---|---|---|
| "開発者ツールを開く" | `{"cmd": "open_devtools"}` | ❌ `{"cmd": "press", "key": "F12"}` — headless에서 비작동 |
| "Elementsで body を選ぶ" / "head を選択する" | `{"cmd": "select_devtools_node", "selector": "body"}` | ❌ 좌표 클릭 하드코딩 |
| "ノードを展開する" / "折りたたむ" | `{"cmd": "toggle_devtools_node", "selector": "body", "mode": "expand"}` | ❌ DOM 트리 행 좌표 하드코딩 |
| "CSSを外してみる" / "スタイルを無効化" | `{"cmd": "disable_css"}` | ❌ 콘솔에서 JS 실행 — 실제 DevTools 콘솔 조작 불가 |
| "CSSを元に戻す" | `{"cmd": "enable_css"}` | |
| 페이지 이동 | `{"cmd": "goto", "url": "..."}` | |
| 요소 강조 | `{"cmd": "highlight", "selector": "...", "note": "..."}` | |
| 대기 | `{"cmd": "wait", "ms": 밀리초}` | |
| 커서 표시 | `{"cmd": "mouse_move", "to": [x, y]}` — goto 후 필수 | |

> **goto 이후 커서를 화면에 표시하려면 반드시 `mouse_move`를 함께 사용해야 한다.**

### 씬 타이밍 계산

**총 액션 시간 ≥ `durationSec` - 2초** (마지막 2초는 자동 여백)

```
goto 소요 시간 예상치:
  Yahoo Japan: ~6~8초
  Apple:       ~4~7초
  일반 사이트: ~2~5초

각 액션 소요 시간:
  wait ms=5000  → 5초
  open_devtools → 0.25초 (슬라이드인 애니메이션)
  select_devtools_node → 0.6초
  toggle_devtools_node → 0.4초
  highlight     → 1.5초 (자동 종료)
  mouse_move    → ~0초 (즉시)
  disable_css   → ~0초 (즉시)

예시 (durationSec: 35):
  goto(6s) + wait(4s) + mouse_move(0s) + wait(5s) + open_devtools(0.25s)
  + wait(5s) + mouse_move(0s) + wait(5s) + highlight(1.5s) + wait(7s)
  = 33.75s ≥ 33s ✅
```

부족하면 `wait ms` 값을 늘려서 보충한다.

### syncPoints — narration-action 자동 싱크

Playwright 씬은 `syncPoints` 필드를 정의하면, 파이프라인 실행 시 TTS WAV를 분석해 **wait ms를 자동으로 재계산**한다. JSON 변환 시 wait 값은 대략적으로 넣어도 된다.

**언제 사용하는가**
- `open_devtools`, `select_devtools_node`, `toggle_devtools_node`, `highlight`, `disable_css` 등 나레이션의 특정 발화 시점에 맞춰 발화해야 하는 action이 있는 씬

**형식**
```json
"syncPoints": [
  { "actionIndex": 4, "phrase": "パネルを表示してみましょう" },
  { "actionIndex": 8, "phrase": "追ってみましょう" }
]
```

- `actionIndex`: `action` 배열의 인덱스 (0-based)
- `phrase`: 해당 action이 **발화되어야 할 나레이션 구절** — 이 구절이 TTS에서 읽히는 시점에 action이 실행되도록 wait가 조정된다

**phrase 선택 기준**
- 나레이션 안에서 **유일하게 특정되는** 부분 문자열을 고를 것
- action이 실행되어야 하는 **발화 시점의 첫 단어 또는 어구**를 사용
- 예: 나레이션이 "それでは、右側に構造を確認するためのパネルを表示してみましょう。" → phrase: `"パネルを表示してみましょう"`

**작성 예시 (open_devtools + highlight 씬)**
```json
{
  "scene_id": 17,
  "narration": "まず、ヤフージャパンに...(생략)...パネルを表示してみましょう。...(생략)...追ってみましょう。...",
  "durationSec": 47,
  "visual": {
    "type": "playwright",
    "syncPoints": [
      { "actionIndex": 4, "phrase": "パネルを表示してみましょう" },
      { "actionIndex": 8, "phrase": "追ってみましょう" }
    ],
    "action": [
      {"cmd": "goto", "url": "https://www.yahoo.co.jp"},
      {"cmd": "wait", "ms": 5000},
      {"cmd": "mouse_move", "to": [960, 400]},
      {"cmd": "wait", "ms": 6000},
      {"cmd": "open_devtools"},
      {"cmd": "wait", "ms": 6000},
      {"cmd": "mouse_move", "to": [1300, 200]},
      {"cmd": "wait", "ms": 5000},
      {"cmd": "highlight", "selector": "body", "note": "構造と画面の対応を確認"},
      {"cmd": "wait", "ms": 8000},
      {"cmd": "mouse_move", "to": [1300, 400]},
      {"cmd": "wait", "ms": 6000}
    ]
  }
}
```

**주의사항**
- `goto` (action[0])는 항상 씬 시작(0ms)에 실행되므로 syncPoint 지정 불필요
- syncPoints가 없는 씬은 수동으로 지정한 wait 값 그대로 사용
- 파이프라인 1.7단계에서 자동 적용됨 — 별도 커맨드 불필요. 수동 실행은 `make sync-playwright LECTURE=xxx SCENE=N`

### AIライブデモ씬 (storageState 사용)

Claude.ai, ChatGPT 등 로그인 필요한 AI 서비스를 조작하는 씬. 일반 Playwright 씬과 다른 특수 규칙이 적용된다.

**storageState 설정**
```json
{
  "visual": {
    "type": "playwright",
    "storageState": "config/auth/claude.json",
    "action": [...]
  }
}
```
- storageState가 지정되면 headed 모드(실제 Chrome)로 녹화됨 (Cloudflare 등 봇 감지 우회)
- 사이드바 등 불필요한 UI는 Provider에서 자동 숨김 처리 — action에서 별도 처리 불필요

**AI 응답 대기 패턴**
```json
{"cmd": "wait_for", "selector": "[data-is-streaming='true']", "state": "attached", "timeout": 30000},
{"cmd": "wait_for", "selector": "[data-is-streaming='false']", "state": "attached", "timeout": 120000}
```
- `wait_for`가 포함된 씬은 **라이브 데모 씬**으로 분류되어 파이프라인 0단계에서 사전 녹화됨
- 역방향 싱크 대상: 녹화된 비디오에 맞춰 TTS 오디오의 타이밍이 조정됨

**Artifact/Canvas 결과 표시**
- AI가 Artifact(Claude) 또는 Canvas(ChatGPT)로 HTML을 렌더링하는 경우:
  ```json
  {"cmd": "wait_for", "selector": "iframe[src*='claudemcpcontent']", "state": "attached", "timeout": 60000}
  ```
- 생성된 HTML을 전체 화면으로 보여주려면:
  ```json
  {"cmd": "render_code_block"}
  ```
  이 액션은 Artifact iframe에서 HTML을 추출하여 새 페이지로 렌더링한다.

**syncPoints에서 역방향 싱크 사용**
- wait_for가 있는 라이브 데모 씬의 syncPoints는 **역방향 싱크** 대상
  - 역방향: 비디오 녹화 시점을 기준으로 TTS에 무음을 삽입하여 나레이션 타이밍을 조정
  - phrase는 **AI 응답 완료 후** 나레이션이 시작되는 지점의 구절을 선택

**예시: Claude에 HTML 생성을 요청하는 씬**
```json
{
  "scene_id": 28,
  "narration": "では、送信してみましょう。エーアイがコードを書いている間、少し待ちましょう。...(생략)...出てきましたね。では、もう少し大きく見てみましょう。...",
  "durationSec": 57,
  "visual": {
    "type": "playwright",
    "storageState": "config/auth/claude.json",
    "syncPoints": [
      {"actionIndex": 10, "phrase": "出てきましたね"},
      {"actionIndex": 15, "phrase": "見てみましょう"}
    ],
    "action": [
      {"cmd": "goto", "url": "https://claude.ai/new"},
      {"cmd": "mouse_move", "to": [960, 500]},
      {"cmd": "wait", "ms": 2000},
      {"cmd": "click", "selector": "[data-testid='model-selector-dropdown']"},
      {"cmd": "wait", "ms": 1000},
      {"cmd": "click", "selector": "[role='menuitem']:has-text('Haiku')"},
      {"cmd": "wait", "ms": 1000},
      {"cmd": "type", "selector": "div.ProseMirror", "key": "プロンプト内容"},
      {"cmd": "press", "key": "Enter"},
      {"cmd": "wait_for", "selector": "[data-is-streaming='true']", "state": "attached", "timeout": 30000},
      {"cmd": "wait_for", "selector": "[data-is-streaming='false']", "state": "attached", "timeout": 120000},
      {"cmd": "wait_for", "selector": "iframe[src*='claudemcpcontent']", "state": "attached", "timeout": 60000},
      {"cmd": "wait", "ms": 3000},
      {"cmd": "scroll", "deltaY": 300},
      {"cmd": "wait", "ms": 3000},
      {"cmd": "render_code_block"},
      {"cmd": "wait", "ms": 3000},
      {"cmd": "scroll", "deltaY": 300},
      {"cmd": "wait", "ms": 3000}
    ]
  }
}
```

### 씬 구조 체크리스트

- [ ] 씬 첫 액션은 반드시 `{"cmd": "goto", "url": "..."}`
- [ ] goto 후 `{"cmd": "mouse_move", "to": [960, 400]}` 추가 (커서 표시)
- [ ] 개발자 도구 표시 → `open_devtools` 사용 (F12 금지)
- [ ] CSS 비활성화 → `disable_css` 사용 (콘솔 JS 실행 금지)
- [ ] 총 액션 시간 ≥ durationSec - 2초
- [ ] 나레이션 특정 발화 시점에 action을 맞춰야 할 경우 → `syncPoints` 정의
- [ ] AI 라이브 데모 씬은 `storageState` 지정 + `wait_for` 패턴 사용
- [ ] AI 응답 대기 중 나레이션 공백 없음 (스크립트에서 대기 중 나레이션 확보)

## PART別カラー
color 속성에는 해당 PART의 색상을 적용:
- PART 1: `#6366f1` / PART 2: `#ef4444` / PART 3: `#3b82f6` / PART 4: `#10b981` / PART 5: `#f59e0b`

## 禁止事項
- ❌ 나레이션 수정/요약/의역 — 확정 스크립트를 그대로 사용
- ❌ 스크립트에 없는 내용 추가
- ❌ 講師メモ를 나레이션에 포함
- ❌ 나레이션 없는 씬
- ❌ durationSec 임의 설정 — 나레이션 길이 기반 산출 필수
- ❌ 코드블록을 나레이션에 포함 — props.code로 분리
- ❌ 나레이션에 영어 단어 직접 사용 — カタカナ로 변환 필수
- ❌ 나레이션에 `——`(em 대시) 사용 — `、つまり` `、たとえば` 등 접속표현으로 대체
- ❌ 나레이션에 `（）` 괄호로 보충 삽입 — TTS가 괄호 내용까지 읽음. 접속표현으로 대체
- ❌ 실제 이미지 없이 `ImagePlaceholderScreen` 사용 — `BrowserMockScreen` 등 대체 컴포넌트 선택
- ❌ `ProgressScreen`에서 단계 건너뜀 또는 씬 묶음 — 단계 수 = 씬 수
- ❌ Playwright action에 `{"goto": "url"}` 구형 형식 — 반드시 `{"cmd": "goto", "url": "..."}` 형식 사용
- ❌ Playwright 씬에서 `press F12`로 DevTools 열기 — `open_devtools` 액션 사용
- ❌ Playwright 씬에서 콘솔 JS(`document.querySelectorAll...`)로 CSS 조작 — `disable_css` / `enable_css` 액션 사용
- ❌ Playwright 씬에서 총 액션 시간이 `durationSec - 2초` 미만 — wait 추가로 보충
- ❌ `syncPoints`의 phrase를 나레이션에 없는 문자열로 지정 — 나레이션 내 실제 구절만 사용
- ❌ AI 라이브 데모 씬에서 `storageState` 미지정 — 로그인 필요 서비스는 반드시 storageState 사용
- ❌ AI 라이브 데모 씬의 나레이션에서 응답 대기 시간 무시 — 대기 중 설명 나레이션 필수
- ❌ AI 도구 화면의 실제 표시와 다른 나레이션 — Artifact 프레뷰가 보이는데 "코드가 표시" 등

## 作業フロー
1. 1강 단위로 스크립트를 받아 변환
2. `data/lecture-XX.json` 파일로 저장
3. 수정 반영 후 확정 → 다음 강의

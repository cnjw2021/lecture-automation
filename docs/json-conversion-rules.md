# 講義スクリプト → Remotion JSON 変換ルール

## 役割
확정된 강의 스크립트(마크다운)를 Remotion 동영상 생성 앱의 입력 JSON으로 변환한다. 스크립트 내용은 수정하지 않는다.

## 参照ドキュメント

Playwright 씬(`"type": "playwright"`) 을 작성·수정할 때는 반드시 아래 두 문서를 함께 참조한다. 본 파일에는 변환·씬 구성 규칙이 있고, 각 액션의 정확한 파라미터·주의사항은 액션 명세서와 라이브 데모 이력 문서에 있다.

- [`docs/playwright-actions.md`](playwright-actions.md) — 모든 Playwright 액션(cmd) 의 파라미터 명세·주의사항 (scroll 의 커서 위치 의존 등)
- [`docs/playwright-ai-live-demo-history.md`](playwright-ai-live-demo-history.md) — AI 라이브 데모 씬 자동화 이력·현행 설계·깨지기 쉬운 포인트

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
3. 내용 전환점 → 새 씬. 30초를 넘는 경우 분할을 검토하되, 문맥상 하나의 흐름이면 초과해도 됨
4. 강의 시작 → TitleScreen (PART 첫 강의면 뒤에 SectionBreakScreen 추가)
5. 강의 끝 → SummaryScreen → EndScreen
6. `【AIデモ: ○○○】` → Playwright 씬

## 講義必須フロー
TitleScreen → [SectionBreakScreen] → [AgendaScreen] → 본편 → SummaryScreen → EndScreen

## 時間算出（SSoT）

모든 씬의 durationSec 산출 규칙을 이 섹션에서 정의한다.

| 구분 | 산출 기준 | 비고 |
|------|-----------|------|
| 기본 | 1초 ≒ 5자(일본어). 例: 75자 → 15초 | |
| 코드 씬 | 나레이션 + 타이핑 2초 + 읽기 시간 추가 | |
| AI 라이브 데모 씬 | **나레이션 글자수 기반으로만 산출** | 역방향 싱크가 비디오 녹화 길이에 맞춰 TTS에 무음을 자동 삽입하므로 최종 클립 길이는 비디오에 맞춰짐. AI 응답 대기 시간은 포함하지 않음 |

- 씬 길이 목안: 최소 5초, 일반 10~25초 (AI 라이브 데모 씬은 제한 없음)
- durationSec를 임의로 설정하지 않는다. 반드시 나레이션 길이 기반으로 산출

## トランジションルール
- 기본: 생략(=fade)
- TitleScreen, SectionBreakScreen: `enter: "zoom"`
- 코드 씬: `enter: "slide-up"`
- 섹션 전환: `enter: "slide-left"`
- EndScreen: `exit: "zoom"`

## ナレーション作成ルール

### 記号禁止
- ❌ `——`(em 대시) 사용 금지 — TTS가 "マイナス"로 읽음. `、つまり` `、たとえば` 등 접속표현으로 대체
- ❌ `（）` 괄호로 보충 설명 삽입 금지 — TTS 모델에 따라 괄호 내용까지 읽어 부자연스러움. 접속표현으로 대체

### 英語表記ルール

TTS 엔진이 안정적으로 읽을 수 있는 **기본 용어**는 영어 그대로 표기한다.
그 외 영어 단어는 カタカナ로 변환한다.

#### 英語のまま表記する基本用語
아래 단어는 TTS 엔진이 안정적으로 발음하며, 수강생에게도 영어 표기가 더 자연스러운 용어.
나레이션·visual props 모두 영어 그대로 사용한다.

| 용어 |
|------|
| HTML |
| CSS |
| JavaScript |
| URL |
| HTTP / HTTPS |
| IP |
| DNS |
| Web |
| Chrome / Safari / Edge |
| Google / YouTube / Amazon / Yahoo |
| Enter |
| PART |
| Flexbox |
| CodePen |
| Claude / ChatGPT |

#### カタカナ変換が必要な用語
위 목록에 없는 영어 단어는 カタカナ로 변환한다. 전문 용어가 처음 등장할 때는
`英語（カタカナ読み）` 형식으로 병기한다.

| 영어 | カタカナ |
|------|---------|
| server | サーバー |
| domain | ドメイン |
| deploy | デプロイ |
| responsive | レスポンシブ |
| selector | セレクタ |
| property | プロパティ |
| 기타 | 문맥에 따라 판단 |

- 예외: `google.com` 같은 도메인명은 나레이션에서 직접 언급 대신 "Googleのアドレス" 등으로 우회

### visualのテキスト表記
- 화면에 표시되는 props(title, headline, items 등)는 영어·일본어 병기 가능
- 나레이션도 위 기본 용어 목록에 해당하면 영어 표기 가능

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

## Playwright 씬 설계 규칙

Playwright 씬(`"type": "playwright"`)을 작성할 때 반드시 준수해야 하는 규칙.

### action 형식

모든 액션은 `{"cmd": "액션명", "파라미터": "값"}` 형식을 사용한다.

```json
{"cmd": "goto", "url": "https://www.yahoo.co.jp"}
{"cmd": "wait", "ms": 3000}
{"cmd": "highlight", "selector": "body", "note": "설명"}
```

### 스크립트 내용 → action 매핑

| 스크립트 내용 | action |
|---|---|
| 페이지 이동 | `{"cmd": "goto", "url": "..."}` |
| 대기 | `{"cmd": "wait", "ms": 밀리초}` |
| 커서 표시 | `{"cmd": "mouse_move", "to": [x, y]}` — goto 후 필수 |
| 요소 강조 | `{"cmd": "highlight", "selector": "...", "note": "..."}` |
| 개발자 도구 표시 | `{"cmd": "open_devtools"}` |
| DevTools 노드 선택 | `{"cmd": "select_devtools_node", "selector": "body"}` |
| DevTools 노드 펼침/접힘 | `{"cmd": "toggle_devtools_node", "selector": "body", "mode": "expand"}` |
| CSS 비활성화/재활성화 | `{"cmd": "disable_css"}` / `{"cmd": "enable_css"}` |

### 씬 타이밍 계산

일반 Playwright 씬(AI 라이브 데모 제외)은 **총 액션 시간 ≥ `durationSec` - 2초**를 충족해야 한다. 부족하면 `wait ms` 값을 늘려서 보충한다.

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
```

### syncPoints — narration-action 자동 싱크

Playwright 씬에서 나레이션의 특정 발화 시점과 화면 액션을 자동으로 동기화한다.
씬 유형에 따라 **순방향** 또는 **역방향** 싱크가 자동 적용된다.

| 씬 유형 | 조건 | 싱크 방식 | 원리 |
|---------|------|-----------|------|
| 일반 Playwright | `wait_for` 없음 | **순방향** (1.7b단계) | 나레이션 발화 시점에 맞춰 **wait ms를 재계산** |
| AI 라이브 데모 | `wait_for` 있음 | **역방향** (1.7a단계) | 비디오 녹화 시점에 맞춰 **TTS에 무음 삽입** |

**형식**
```json
"syncPoints": [
  { "actionIndex": 4, "phrase": "パネルを表示してみましょう" },
  { "actionIndex": 8, "phrase": "追ってみましょう" }
]
```

- `actionIndex`: `action` 배열의 인덱스 (0-based)
- `phrase`: 해당 action이 실행되어야 할 나레이션 구절. 나레이션 안에서 유일하게 특정되는 부분 문자열을 선택
- phrase는 **문장 첫머리부터 포함**해야 무음 삽입 위치가 자연스러움
  - ✅ `"では、送信してみましょう"` — 문장 시작부터 포함
- `goto` (action[0])는 항상 씬 시작(0ms)에 실행되므로 syncPoint 지정 불필요
- syncPoints가 없는 씬은 수동으로 지정한 wait 값 그대로 사용

**작성 예시: 순방향 싱크 (일반 Playwright 씬)**
```json
{
  "scene_id": 17,
  "narration": "まず、Yahoo! JAPANに...(생략)...パネルを表示してみましょう。...(생략)...追ってみましょう。...",
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

### AIライブデモ씬 (storageState + 역방향 싱크)

Claude.ai, ChatGPT 등 로그인 필요한 AI 서비스를 조작하는 씬.

**파이프라인 처리 흐름**
1. 파이프라인 **0단계**에서 사전 녹화 (실제 AI 응답 대기 포함 → 녹화 길이가 가변적)
2. 파이프라인 1단계에서 TTS 생성 (나레이션 길이 기준)
3. 파이프라인 **1.7a단계**에서 역방향 싱크: 녹화 매니페스트의 action 완료 시점을 기준으로 TTS WAV에 무음 삽입
4. 최종 클립 길이 = 무음 삽입 후 WAV 길이 (비디오 녹화 길이와 자동 정합)

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
- 로그인 필요 서비스는 반드시 storageState를 지정

**AI 응답 대기 패턴**
```json
{"cmd": "wait_for", "selector": "[data-is-streaming='true']", "state": "attached", "timeout": 60000},
{"cmd": "wait_for", "selector": "[data-is-streaming='false']", "state": "attached", "timeout": 180000}
```
- `wait_for`가 포함된 씬은 **라이브 데모 씬**으로 분류되어 역방향 싱크 대상이 됨
- streaming 완료 후 Artifact/Canvas 프리뷰가 자동 표시됨 — streaming 완료 후 `wait 5000`으로 충분

**syncPoints 사용 (역방향 싱크)**
- phrase는 비디오에서 특정 action이 완료된 **후** 재생되어야 할 나레이션 구절
- 대표적 패턴: AI 응답 완료 후 "出てきましたね" 같은 결과 확인 나레이션

**action 설계 포인트**
- `press Enter` (송신) 전에 wait를 넣어 나레이션 타이밍 여유 확보 — 역방향 싱크는 무음 삽입만 가능하고 나레이션을 앞당길 수 없음
- streaming 완료 후 `wait 5000` → Artifact 프리뷰 로드 대기
- 결과 확인 구간에 `scroll` + `wait`로 Artifact 프리뷰를 스크롤하며 보여주기
- **셀렉터 선택**: AI 도구 UI 는 클래스명·자식 텍스트가 자주 바뀐다. `button:has-text('...')` 대신 `button[aria-label*='...']` 처럼 **접근성 속성 기반**을 우선한다. 예: Artifact 오픈 버튼 → `button[aria-label*='アーティファクトを開く']` (상세: `docs/playwright-ai-live-demo-history.md` §4.1)
- **스크롤 대상 패널 내부로 커서 이동 필수**: `scroll` 은 현재 커서가 놓인 스크롤 컨테이너만 스크롤한다. Claude 는 좌측 채팅과 우측 Artifact 가 각각 독립 스크롤이므로, Artifact 를 스크롤하려면 `mouse_move` 로 먼저 우측 패널 내부 좌표로 커서를 옮긴 뒤 `scroll` 해야 한다 (상세: `docs/playwright-actions.md` → `scroll` 섹션)
- **Artifact 패널은 명시 지시 시 자동 오픈 — `click` 불필요**: 프롬프트에 "アーティファクトとして作成してください" 가 포함되면 Claude 가 streaming 중 Artifact 패널을 자동으로 연다. 이 경우 `click button[aria-label*='アーティファクトを開く']` 를 별도로 넣으면 버튼이 존재하지 않아 10초 타임아웃이 발생한다. `wait_for streaming='false'` 이후 프리뷰 로드용 `wait 5000` 만으로 충분. (명시 지시 없이 Claude 가 인라인 코드블록으로 출력하는 경우에만 click 필요 — 이 경우는 프롬프트 수정으로 해결해야 함. 상세: `docs/playwright-ai-live-demo-history.md` §4.7)

**프롬프트 설계 원칙 — 나레이션 정합**

AI 라이브 데모 씬의 `type.key` (Claude 에 입력되는 프롬프트) 는 일반 사용자 프롬프트와 다르다. 동영상 나레이션이 "출력 화면" 을 설명하므로, **프롬프트가 출력 구조를 결정론적으로 고정**해야 나레이션과 화면이 어긋나지 않는다.

1. **Artifact 명시 지시 필수**: 프롬프트에 아래 2문을 **반드시 포함**.
   ```
   インラインのコードブロックではなく、アーティファクトとして作成してください。
   ```
   이 지시가 없으면 Claude 가 대화창 내 인라인 코드블록으로 출력할 수 있고 (모델·컨텐츠 크기에 따라 비결정적), Artifact 패널이 열리지 않아 씬 29 전제가 깨진다.

2. **나레이션이 언급하는 요소는 프롬프트에서 순서·스타일까지 고정**: 나레이션이 "上にヘッダーがあって、その下にカード型のメニューが…" 처럼 특정 레이아웃을 묘사한다면, 프롬프트도 동일한 순서·형태를 명시한다.
   ```
   ページは上部にヘッダーとナビゲーション、コンセプトの紹介、施術メニュー
   をカード型で料金付き、アクセス情報と営業時間、お問い合わせボタン、と
   いう順で構成してください。落ち着いた統一感のある配色にしてください。
   ```
   프롬프트가 느슨하면 Claude 가 배치·스타일을 임의로 결정해 나레이션 설명과 달라진다. **"AI에게 자유를 주면 나레이션이 깨진다" 는 것을 전제로 설계할 것.**

3. **나레이션은 고정된 요소만 단언**: 프롬프트에서 고정하지 않은 속성(구체적 색상 값, 폰트, 구체적 카피 등) 은 나레이션에서 단언하지 않는다. "色も統一感があって" 는 프롬프트에서 "落ち着いた統一感のある配色" 을 고정했을 때만 안전.

**스크롤 총 픽셀 예산 — Artifact 프리뷰 하단까지 도달**

결과 확인 씬은 Artifact 프리뷰 하단까지 보여주고 끝나야 한다 (중간에서 끊기면 "アクセス情報もあります" 같은 나레이션이 화면과 어긋남).

| 생성 요청 | 예상 높이 | 권장 스크롤 예산 |
|---|---|---|
| 1페이지 랜딩 (헤더+소개+메뉴+아크세스+문의) | 2500~3500px | **6 × deltaY 400 = 2400px** + 최종 hold 5s |
| 간단한 프로필 페이지 | 1500~2500px | 4 × deltaY 400 = 1600px + hold 5s |
| 긴 LP (FAQ, 후기 포함) | 4000px+ | 8 × deltaY 400 = 3200px + hold 5s |

- 각 스크롤 사이 wait 는 3~4s 권장 (나레이션 읽는 속도와 정합)
- 마지막 scroll 후 5s hold 로 프리뷰 하단을 정지 프레임으로 보여줌
- 실제 Claude 출력 높이는 모델·날짜에 따라 변동하므로, 첫 녹화 후 webm 을 열어 **프리뷰 하단까지 스크롤됐는지** 육안 확인 후 deltaY/횟수 조정

**Claude.ai 1920×1080 뷰포트 주요 좌표 참고**

| 영역 | x 범위 | 대표 좌표 | 용도 |
|---|---|---|---|
| 좌측 사이드바 (열렸을 때) | ~0 ~ 280 | — | storageState preflight 에서 자동 접음 |
| 채팅 영역 | ~80 ~ 1040 | `[960, 500]` | 입력창(ProseMirror), 대화 이력. `type` 전후 커서 |
| 우측 Artifact 패널 (열린 후) | ~1040 ~ 1920 | `[1500, 500]` | Artifact 프리뷰 스크롤 대상. `scroll` 직전 `mouse_move` 위치 |

> ⚠️ 좌표는 Claude UI 업데이트 시 조금씩 이동할 수 있다. 녹화 결과가 어긋나면 webm 을 열어 실제 경계를 확인할 것.

**예시: Claude에 HTML 생성을 요청하는 씬 (구조 고정 프롬프트 + 프리뷰 하단까지 스크롤)**
```json
{
  "scene_id": 28,
  "narration": "では、さっき見た依頼文をClaudeに入力していきます。...(입력 중 나레이션)...では、送信してみましょう。AIがコードを書いている間、少し待ちましょう。...(대기 중 설명 나레이션)...出てきましたね。右側にプレビューが表示されています。スクロールしていくと、...(결과 설명 나레이션)...",
  "durationSec": 60,
  "visual": {
    "type": "playwright",
    "storageState": "config/auth/claude.json",
    "syncPoints": [
      {"actionIndex": 6, "phrase": "では、送信してみましょう"},
      {"actionIndex": 12, "phrase": "スクロールしていくと"}
    ],
    "action": [
      {"cmd": "goto", "url": "https://claude.ai/new"},
      {"cmd": "mouse_move", "to": [960, 500]},
      {"cmd": "wait", "ms": 3000},
      {"cmd": "type", "selector": "div.ProseMirror", "key": "マッサージサロンのホームページをHTMLとCSSで作ってください。ページは上部にヘッダーとナビゲーション、コンセプトの紹介、施術メニューをカード型で料金付き、アクセス情報と営業時間、お問い合わせボタン、という順で構成してください。落ち着いた統一感のある配色にしてください。インラインのコードブロックではなく、アーティファクトとして作成してください。"},
      {"cmd": "wait", "ms": 2000},
      {"cmd": "wait", "ms": 5000, "note": "나레이션 전반부와 type 시간 차이 보충"},
      {"cmd": "press", "key": "Enter"},
      {"cmd": "wait_for", "selector": "[data-is-streaming='true']", "state": "attached", "timeout": 60000},
      {"cmd": "wait_for", "selector": "[data-is-streaming='false']", "state": "attached", "timeout": 180000},
      {"cmd": "wait", "ms": 5000, "note": "Artifact 프리뷰 로드 대기 (명시 지시 시 패널 자동 오픈, click 불필요)"},
      {"cmd": "wait", "ms": 3000},
      {"cmd": "mouse_move", "to": [1500, 500], "note": "Artifact 패널 내부로 커서 (1920×1080 기준 우측 x>1040). 다음 scroll 이 Artifact 에서 동작하도록"},
      {"cmd": "scroll", "deltaY": 400},
      {"cmd": "wait", "ms": 3500},
      {"cmd": "scroll", "deltaY": 400},
      {"cmd": "wait", "ms": 3500},
      {"cmd": "scroll", "deltaY": 400},
      {"cmd": "wait", "ms": 3500},
      {"cmd": "scroll", "deltaY": 400},
      {"cmd": "wait", "ms": 3500},
      {"cmd": "scroll", "deltaY": 400},
      {"cmd": "wait", "ms": 3500},
      {"cmd": "scroll", "deltaY": 400},
      {"cmd": "wait", "ms": 5000, "note": "프리뷰 하단 정지 프레임"}
    ]
  }
}
```

> 본 예시는 하나의 씬에 송신·결과 확인을 합친 간단 버전. 실제 lecture-01-03 은 Claude 응답 대기 시간이 불안정하기 때문에 씬 28(송신) + 28.5(중간 슬라이드) + 29(결과 확인) 로 분할한 P-D 공유 세션 패턴을 사용한다 (상세: `docs/playwright-ai-live-demo-history.md` §3, §8).

## PART別カラー
color 속성에는 해당 PART의 색상을 적용:
- PART 1: `#6366f1` / PART 2: `#ef4444` / PART 3: `#3b82f6` / PART 4: `#10b981` / PART 5: `#f59e0b`

## 禁止事項

위 각 섹션에서 이미 정의된 규칙(action 형식, 타이밍, syncPoints, 英語表記 등)은 여기서 반복하지 않는다.
아래는 다른 섹션에서 다루지 않는 나레이션·씬 구성 관련 금지 사항만 나열한다.

- ❌ 나레이션 수정/요약/의역 — 확정 스크립트를 그대로 사용
- ❌ 스크립트에 없는 내용 추가
- ❌ 講師メモ를 나레이션에 포함
- ❌ 나레이션 없는 씬
- ❌ 코드블록을 나레이션에 포함 — props.code로 분리
- ❌ AI 라이브 데모 씬의 나레이션에서 응답 대기 시간 무시 — 스크립트에서 대기 중 설명 나레이션을 확보할 것
- ❌ AI 도구 화면의 실제 표시와 다른 나레이션 — 예: Artifact プレビューが表示されているのに「コードが表示されている」
- ❌ 프롬프트(`type.key`)에서 고정하지 않은 속성을 나레이션에서 단언 — 예: 프롬프트가 `"メニュー表、アクセス情報、お問い合わせボタンを含めてください"` 수준인데 나레이션이 "カード型で料金付き" "色も統一感があって" 처럼 구체적 레이아웃·스타일을 단언하면, Claude 출력이 달라질 때마다 나레이션과 화면이 어긋남. 구체적 묘사가 필요하면 프롬프트에 구조·스타일을 먼저 고정할 것 (AIライブデモ씬 "프롬프트 설계 원칙" 참조)
- ❌ Artifact 명시 지시 누락 — 프롬프트에 `"インラインのコードブロックではなく、アーティファクトとして作成してください"` 가 없으면 Claude 가 인라인 코드블록으로 출력할 수 있고 Artifact 패널이 열리지 않아 씬 전제가 깨짐

## 作業フロー
1. 1강 단위로 스크립트를 받아 변환
2. `data/lecture-XX.json` 파일로 저장
3. 수정 반영 후 확정 → 다음 강의

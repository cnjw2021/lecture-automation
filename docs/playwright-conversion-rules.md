# Playwright JSON 변환 규칙

Playwright 씬(`"type": "playwright"`)을 JSON으로 변환할 때 적용하는 상세 규칙이다. 일반 Remotion 씬 변환은 `docs/json-conversion-rules.md`를 우선하고, Playwright 씬이 있을 때만 이 문서를 추가 참조한다.

## Playwright 씬 설계 규칙

Playwright 씬(`"type": "playwright"`)을 작성할 때 반드시 준수해야 하는 규칙.

### Playwright 씬 필수 작성 순서

Playwright 씬을 만들 때는 아래 순서대로 작성한다. 이 순서를 지키면 구조적으로 sync 불가능한 JSON을 대부분 사전에 피할 수 있다.

1. **동작을 3종으로 분류**
   - `setup`: `goto`, 첫 커서 이동, 에디터 포커스 등 화면 준비 동작
   - `pre-fill`: 이전 상태 복원용 조용한 `type`. 첫 teaching phrase 전에 빠르게 실행되는 복원 동작이며, 실제로는 녹화 타임라인 안에 있다
   - `teaching action`: 나레이션이 설명하는 새 `type`, `press`, `mouse_move`, `highlight`

2. **일반 순방향 syncPoint 는 teaching action 에만 둔다**
   - 일반 Playwright / CodePen 씬에서는 `wait`, `goto`, `wait_for`, `wait_for_claude_ready` 에 syncPoint 를 두지 않는다.
   - isolated 역방향 싱크에서 `wait` / `wait_for` / `wait_for_claude_ready` 완료 시점에 맞출 때만 예외적으로 `target: "end"` 를 명시한다.
   - 첫 syncPoint 는 그 syncPoint 이전의 setup/pre-fill 액션을 실행할 시간이 지난 뒤에 온다.
   - CodePen 기본 setup floor 는 `goto + mouse_move + click + 1초 여유` 기준으로 약 **6.5초**다. 첫 syncPoint 를 `click` 에 둘 경우에는 click 시간이 floor 에 포함되지 않으므로 약 **6.0초**로 본다.

3. **각 세그먼트 예산을 먼저 계산한다**
   - 세그먼트 = 이전 syncPoint 부터 다음 syncPoint 까지의 action 구간.
   - `type` 은 `key.length × 0.1초`, `mouse_move` 는 `0.8초`, `click` 은 `0.5초`, `press` 는 `0.1초/회`로 잡는다.
   - 각 세그먼트는 `narration budget >= wait 제외 고정 액션 시간 + 1초 여유`를 만족해야 한다.
   - 각 조정 대상 세그먼트에는 최소 1개의 `wait` 액션을 둔다. `wait` 가 없으면 sync-playwright 는 그 구간을 조정할 수 없다.

4. **불가능하면 JSON wait 로 해결하려 하지 않는다**
   - 고정 액션 시간이 narration budget 보다 길면 음수 wait 가 필요하므로 자동 보정 불가다.
   - 변환 단계에서는 나레이션을 임의 수정하지 않는다. 이 경우 타이핑을 더 작은 syncPoint 구간으로 나누거나, 보이는 동작을 줄이거나, 변환 불가 사유로 보고한다.

5. **나레이션과 보이는 동작을 일치시킨다**
   - 스크립트가 전체 삭제·재타이핑을 말할 때만 전체 삭제·재타이핑 action 을 사용한다.
   - 스크립트가 "중간에 Enter 한 번"이라고 말하면 실제 화면에서도 그 동작만 보여야 한다.

6. **저장 후 lint 와 sync 를 실행한다**
   - `make lint-fix LECTURE=lecture-XX.json`
   - `make lint LECTURE=lecture-XX.json STRICT=1`
   - Playwright 최종 wait 재계산은 TTS 생성 후 파이프라인 1.7b 또는 `make sync-playwright LECTURE=lecture-XX.json` 로 수행한다.

### 연속 실습 씬 통합 원칙 (라이브 몰입감)

수강생이 같은 실습 화면(CodePen·VS Code·브라우저) 을 계속 보며 작업하는 구간은 **하나의 Playwright 씬으로 통합**한다. 씬을 잘게 쪼개면 매 씬마다 새 브라우저 컨텍스트가 열려 페이지가 재로딩되고, 라이브 강의 몰입감이 깨진다.

**통합 vs 분할 판정**

| 상황 | 판정 | 이유 |
|---|---|---|
| "Hello World 입력 → 지우기 → h1 태그로 감싸기" | **통합** (1개 씬) | 같은 CodePen 에디터, 연속된 타이핑 흐름 |
| "h1 추가 → p 태그 추가 → 전체 코드 리뷰" | **통합** (1개 씬) | 같은 에디터, 코드가 누적되는 흐름 |
| CodePen 실습 → 슬라이드로 개념 설명 → CodePen 실습 | **분할 또는 통합 재검토** | 슬라이드 삽입 시 실습 화면이 중단됨. 확정 스크립트 구조상 같은 Playwright 씬으로 통합 가능한지 먼저 검토하고, 불가능하면 분할 + pre-fill 로 상태 복원 |
| CodePen 실습 → 브라우저로 다른 사이트 이동 | **분할** | 이동 대상이 다르므로 새 씬 필요 |

**통합 씬의 특징**
- durationSec 이 60~120초로 길어진다 (일반 씬 10~25초 대비)
- syncPoints 가 4~6개 이상 필요하다 (각 문단 전환에 하나씩)
- 나레이션 중간에 "では" "次に" 등 전환 표현이 여러 번 등장
- action 배열이 20~30개로 길어진다

**주의: 씬 경계에서 상태 리셋**
Playwright 씬은 씬마다 새 브라우저 컨텍스트로 시작한다. 연속 실습을 **분할**해야 한다면 각 씬은 `goto` 부터 다시 시작하며, 이전 씬에서 입력한 내용은 사라진다. 이 경우 다음 씬 시작에 "pre-fill 패턴" 을 사용해 이전 내용을 다시 조용히 타이핑한다 (상세: 아래 "CodePen 실습 씬 패턴" → pre-fill).

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

일반 Playwright 씬(AI 라이브 데모 제외)은 **syncPoints 사이의 세그먼트별 narration budget**이 해당 구간의 보이는 액션 시간을 덮어야 한다. 씬 전체 길이가 충분해도 특정 세그먼트의 나레이션이 짧으면, 순방향 싱크는 그 구간을 맞출 수 없다.

순방향 싱크는 `wait` 만 늘리거나 줄인다. `goto`, `type`, `mouse_move`, `click`, `press` 자체를 앞당기거나 압축하지는 못한다.

### 순방향 싱크용 액션 예산 SSoT

아래 값은 순방향 싱크와 lint가 사용하는 예산 기준과 맞춘다. Playwright 씬 작성 시에도 같은 값으로 계산한다.

| action | 예산 기준 |
|---|---|
| `goto` | CodePen **4.2초**, Yahoo **7초**, Claude/ChatGPT/OpenAI 등 heavy app **6초**, 일반 URL **3초** |
| `mouse_move` | **0.8초** |
| `click` | **0.5초** |
| `type` | **`key.length × 0.1초`** |
| `press` | **0.1초/회** (`Enter`, `Backspace`, `Meta+a`, `Ctrl+a` 등) |
| `focus` | **0.1초** |
| `mouse_drag` | **1.0초** |
| `highlight` | **1.5초** |
| `scroll` | **0.5초** |
| `disable_css` / `enable_css` | **0.3초** |
| `open_devtools` | **0.4초** |
| `select_devtools_node` | **0.6초** |
| `toggle_devtools_node` | **0.4초** |
| `wait_for` / `wait_for_claude_ready` | 순방향 싱크 예산에서 제외. isolated 라이브 데모는 역방향 싱크 대상 |

각 세그먼트마다 아래 조건을 만족해야 한다.

```
segment narration budget >= wait 제외 고정 액션 시간 합계 + 최소 1초 여유
```

예: 한 세그먼트에 `type.key` 50자가 있으면 타이핑만 5초다. 이 구간의 나레이션이 4초라면 wait를 0으로 줄여도 화면 조작이 나레이션보다 늦게 끝난다.

### syncPoints — narration-action 자동 싱크

Playwright 씬에서 나레이션의 특정 발화 시점과 화면 액션을 자동으로 동기화한다.
씬 유형에 따라 **순방향** 또는 **역방향** 싱크가 자동 적용된다.

| 씬 유형 | 조건 | 싱크 방식 | 원리 |
|---------|------|-----------|------|
| 일반 Playwright | `wait_for` / `wait_for_claude_ready` 없음 | **순방향** (1.7b단계) | 나레이션 발화 시점에 맞춰 **wait ms를 재계산** |
| isolated AI 라이브 데모 | `wait_for` 또는 `wait_for_claude_ready` 있음 + `session.mode` 없음 | **역방향** (1.7a단계) | 비디오 녹화 시점에 맞춰 **TTS에 무음 삽입** |
| shared AI 라이브 데모 | `session.mode: "shared"` | **순방향 + shared session capture** | offscreen action 으로 가변 대기를 씬 타임라인 밖으로 밀고, visible action 은 wait 재계산 |

**형식**
```json
"syncPoints": [
  { "actionIndex": 4, "phrase": "パネルを表示してみましょう" },
  { "actionIndex": 8, "phrase": "追ってみましょう" }
]
```

- `actionIndex`: `action` 배열의 인덱스 (0-based)
- `phrase`: 해당 action이 실행되어야 할 나레이션 구절. 나레이션 안에서 유일하게 특정되는 부분 문자열을 선택
- phrase는 **문장 첫머리부터 포함**해야 싱크 지점이 자연스러움
  - ✅ `"では、送信してみましょう"` — 문장 시작부터 포함
- `goto` (action[0])는 항상 씬 시작(0ms)에 실행되므로 syncPoint 지정 불필요
- syncPoints가 없는 씬은 수동으로 지정한 wait 값 그대로 사용

**`wait ms` 값은 0 으로 두어도 됨 (순방향 싱크 대상 씬)**

syncPoints 가 있는 일반 Playwright 씬에서는 1.7b단계 순방향 싱크가 조정 가능한 각 세그먼트의 `wait` ms 를 재계산한다. 따라서 JSON 작성 시 wait 값을 정확히 맞출 필요가 없다.

```json
{"cmd": "wait", "ms": 0}
```

- 초기 작성 시 모든 wait 를 `ms: 0` 으로 두고 syncPoints 만 정확히 지정 → `make sync-playwright` 또는 전체 파이프라인 실행 시 자동으로 적절한 ms 값으로 갱신됨
- 단, 조정 대상 세그먼트에 `wait` 가 하나도 없으면 해당 구간은 재계산할 수 없다. 첫 syncPoint 이전, syncPoint 사이, 마지막 syncPoint 이후처럼 조정이 필요한 구간마다 최소 1개의 `wait` 를 둔다
- isolated 역방향 싱크 대상 씬(`wait_for` / `wait_for_claude_ready` 포함, `session.mode` 없음)은 예외 — 나레이션 전반부와 type 간 간격 등 일부 wait 는 수동 조정 필요

**순방향 싱크 hard limit**

- 순방향 싱크는 영상 생성 전에 `wait` 를 재계산해 브라우저 녹화 타이밍을 조정한다. 단, 이미 필요한 고정 액션 시간보다 나레이션이 짧으면 음수 wait가 필요하므로 조정 불가다.
- 첫 syncPoint 는 `goto` 직후가 아니라, setup 이 끝난 뒤 실제로 수강생에게 보여주고 싶은 첫 조작에 둔다.
- CodePen 기본 setup floor 는 첫 teaching action 이전에 필요한 액션 합계로 계산한다. 첫 syncPoint 가 `type` 이면 `goto 4.2초 + mouse_move 0.8초 + click 0.5초 + 여유 1초` 로 **약 6.5초**다. 첫 syncPoint 가 `click` 이면 click 은 teaching action 이므로 floor 는 **약 6.0초**다.
- 첫 phrase 가 0~3초에 나오면 구조적으로 맞지 않는다. 스크립트 안에 setup 설명 구절이 있으면 그 뒤의 실제 타이핑/조작 phrase 를 첫 syncPoint 로 삼고, 없으면 visible action 을 줄이거나 변환 불가 사유로 보고한다.
- syncPoint 의 `actionIndex` 는 `wait`, `goto`, `wait_for`, `wait_for_claude_ready` 가 아니라 실제 teaching action 에 둔다. 예: `type`, `press`, `mouse_move`, `highlight`, 설명 대상인 `click`.

예:
- ❌ `"こんにちは。見出しを入力します"` 직후 `actionIndex: 5` (`wait`) 배치
- ❌ `goto + mouse_move + click` 이전인 0~3초 phrase 에 첫 `type` 을 맞추려 함
- ✅ `"では、CodePen を開いて準備します。左上のHTML入力欄をクリックしたら、見出しを入力します"` 처럼 setup 설명 후 첫 teaching action phrase 를 둠

**syncPoint 밀도 — narration 이 type 을 직접 호명하는 경우**

narration 이 type 액션을 직접 호명하는 구조(예: type 6개 `<h1>...</h1>` ~ `<h6>...</h6>` 와 narration 안 `"いちばん大きな見出し、2番目の見出し、…、いちばん小さな見出し"` 가 일렬 매칭) 에서는 **syncPoint 를 그 수만큼 추가**한다. syncPoint 1개로 두면 sync-playwright 가 첫 phrase 만 매칭하고 나머지는 wait 균등 분산만 하므로, narration 흐름이 type 흐름보다 빨리 흘러가 청각적으로 어색하다.

실측: `lecture-02-02` 씬 4 에서 syncPoint 1개로 두었을 때 narration 11초 vs type/visual 25초 → 약 14초 차이로 narration 이 빠르게 들림. syncPoint 6개로 확장 후 정밀 매칭.

**판단 기준**

| narration 안 phrase ↔ type 매칭 | syncPoint 수 |
|---|---|
| 일렬 1:1 매칭 (type 6개 ↔ phrase 6개) | type 수만큼 |
| 부분 매칭 또는 type 결과만 묘사 | 1~2개 |
| narration 이 type 동작을 호명하지 않음 | 1개 (마지막 또는 결과 묘사 시점) |

**budget 검증 필수**

syncPoint 수를 늘리면 syncPoint 사이 narration budget 이 작아진다. 각 segment 의 fixed action 시간 (`type 1.6s + press 0.1s` 등) 보다 narration budget 이 짧으면 sync 불가.

- segment 부족분 발생 시 narration 안 phrase 사이에 connector(`つぎに`, `つづいて`, `それから`, `さらに`, `最後に` 등) 를 추가해 자수 확보
- 각 segment 여유 ≥ 1초 권장 (lint 워닝 회피). 1초 미만이면 워닝, 0초 미만이면 error
- error 발생 시 narration 보강 또는 syncPoint 일부 삭제

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

### CodePen 실습 씬 패턴

CodePen 편집기(HTML/CSS/JS 3분할 + 프리뷰)에서 코드를 타이핑·확인하는 실습 씬. 로그인 세션이 필요하며, 연속된 실습 흐름은 **하나의 씬으로 통합**해 라이브 몰입감을 유지한다.

**고정 파라미터**

| 항목 | 값 |
|---|---|
| URL | `https://codepen.io/pen/` |
| storageState | `config/auth/codepen.json` |
| 싱크 방식 | 순방향 (wait_for 없음) |

**고정 셀렉터 (CodeMirror 기반 에디터)**

| 용도 | 셀렉터 |
|---|---|
| HTML 에디터 클릭 (포커스) | `#box-html .CodeMirror` |
| HTML 에디터 타이핑 | `#box-html .CodeMirror textarea` |
| CSS 에디터 클릭 | `#box-css .CodeMirror` |
| CSS 에디터 타이핑 | `#box-css .CodeMirror textarea` |

> CodePen 에디터는 CodeMirror 위젯이라 `click` 대상과 `type` 대상이 다르다. 클릭은 래퍼(`.CodeMirror`), 타이핑은 내부 hidden textarea.

**주요 좌표 (1920×1080 뷰포트)**

| 영역 | 대표 좌표 | 용도 |
|---|---|---|
| HTML 에디터 영역 | `[400, 250]` | 타이핑 전후 커서 위치 |
| CSS 에디터 영역 | `[960, 250]` | CSS 편집 구간 |
| 프리뷰 영역 | `[960, 800]` | 결과 확인 시 커서 이동 |

**기본 action 템플릿 (단일 씬)**

```
goto https://codepen.io/pen/
wait 0
mouse_move [400, 250]       ← 커서 표시
wait 0
click #box-html .CodeMirror ← 에디터 포커스 (필수)
wait 0
type #box-html .CodeMirror textarea, key="<h1>Hello</h1>"
wait 0
mouse_move [960, 800]       ← 프리뷰로 시선 유도
wait 0
```

- `click` 으로 에디터에 포커스를 준 뒤 `type` 으로 입력. click 없이 type 하면 입력이 다른 곳으로 가거나 무시됨
- 타이핑 전후로 `mouse_move` 를 넣어 커서를 시각적으로 따라가게 함
- 프리뷰 확인 구간에는 `mouse_move [960, 800]` 으로 시선을 아래로 유도

**pre-fill 패턴 (분할된 연속 씬의 이전 내용 복원)**

씬을 분할해야 하는 경우, 다음 씬의 시작부에서 이전 씬에서 입력한 내용을 **조용히 재타이핑**해 이어지는 것처럼 보이게 한다. 현재 순방향 싱크 구조에서 pre-fill 은 녹화 타임라인 바깥이 아니라, 첫 teaching phrase 이전의 setup 구간에서 실행된다.

```json
{
  "cmd": "type",
  "selector": "#box-html .CodeMirror textarea",
  "key": "<h1>Hello World</h1>"
}
```

- pre-fill 은 첫 teaching syncPoint 보다 앞에 배치하고, syncPoints 에 포함하지 않는다
- 첫 syncPoint 는 새 내용의 타이핑·조작을 설명하는 첫 나레이션 구절로 지정
- pre-fill 구간도 sync-playwright 가 wait 를 재계산한다. 빠르게 보이게 하려면 pre-fill 문자열을 짧게 유지하고, 스크립트상 첫 teaching phrase 가 setup/pre-fill 이후에 오도록 action 구조를 맞춘다

**action 분류 — setup / pre-fill / teaching**

일반 Playwright 씬의 action 은 아래 3종으로 나눠 설계한다.

1. `setup`
   - 예: `goto`, 첫 `mouse_move`, 첫 `click`
   - 목적: 화면과 포커스 준비
   - 규칙: 첫 syncPoint 보다 앞에 둔다. 스크립트에 "準備します", "入力欄をクリックします" 수준의 도입 설명이 있을 때만 setup 동작과 대응시킨다

2. `pre-fill`
   - 예: 이전 씬 상태를 복원하는 `type`
   - 목적: 분할된 씬이 이어지는 것처럼 보이게 함
   - 규칙: 첫 teaching syncPoint 전, syncPoints 에 포함 금지, 가능한 짧게

3. `teaching action`
   - 예: 새 `type`, `press Enter`, 결과 확인용 `mouse_move`, `highlight`
   - 목적: 수강생에게 지금 설명하는 학습 포인트를 실제로 보여줌
   - 규칙: syncPoints 는 이 action 에 둔다

- setup/pre-fill 을 teaching action 처럼 설명하면 싱크가 어긋난다.
- teaching action 을 pre-fill 처럼 숨기면 학습 포인트가 화면에서 사라진다.
- 분할 씬에서 "이전 내용이 이미 있는 상태" 를 만들고 싶으면 pre-fill 로 복원하고, 나레이션은 복원 후 새 변화만 설명한다.

**입력 대상 문자 주의사항**

| 문자 | 주의 |
|---|---|
| `<` `>` (山括弧) | 반드시 **半角**. 스크립트가 "半角の山括弧" 를 설명하면 화면 입력도 그 설명과 맞춘다 |
| 일본어 문자열 (예: `はじめてのWebページです！`) | `type.key` 에 그대로 사용 가능 — Playwright 가 IME 없이 직접 입력 |
| `\n` 줄바꿈 | **금지** — 별도 `press Enter` 액션으로 분리한다. 자세한 이유와 분할 패턴은 아래 별도 항목 참조 |

**`type.key` 안에 `\n` 넣지 않기 (pressSequentially hang 회피)**

CodePen 의 CodeMirror textarea 에 `\n` 이 포함된 `type.key` 를 보내면 `pressSequentially` 가
무한히 멈춘다. Playwright 의 `pressSequentially` 는 per-character timeout 이 없고,
CodeMirror 의 auto-indent / auto-close-tag 처리 중에 textarea 포커스나 actionability state
가 흔들리면 다음 키 입력을 영원히 재시도한다.

증상은 위 "auto-close-tag race" 와 동일하다 — 페이지는 살아있고 ffmpeg 는 계속 frame 을
받지만 새 액션이 진행되지 않아 webm 이 수십 MB 까지 자라며 다른 씬은 시작도 못 한다.
다른 액션(`click`, `wait_for` 등)은 모두 timeout 이 걸려 있어 빠져나가지만 `type` 은 빠지는 구멍이다.

실측: `lecture-02-03` 씬 6 의 `key: "<h1>...</h1>\n<p>...</p>\n<h2>...</h2>\n<ul>\n  <li>...</li>\n  <li>...</li>\n</ul>"` 한 번에 type 했을 때 1시간+ 멈춤.

규칙:
- `type.key` 안에 `\n` 절대 금지. 줄별로 `type` + `press Enter` 로 분리한다
- 들여쓰기용 leading whitespace 는 `type.key` 에 포함하지 않는다 — CodeMirror 가 auto-indent 한다
- 분할로 `actionIndex` 가 바뀌므로 **syncPoint 의 actionIndex 도 같이 갱신**한다
- 정상 패턴 참고: `data/lecture-02-01.json`, `data/lecture-02-02.json` 의 모든 CodePen typing 씬

multi-line block 분할 예 (`<ul>` 안에 `<li>` 두 줄):

```json
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<ul>" },
{ "cmd": "press", "key": "Enter" },
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<li>映画鑑賞</li>" },
{ "cmd": "press", "key": "Enter" },
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<li>カフェ巡り</li>" },
{ "cmd": "press", "key": "Enter" },
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "</ul>" }
```

**한 `type` 에 중첩 닫기 태그 넣지 않기 (CodeMirror auto-close-tag race 회피)**

CodePen 의 CodeMirror 는 `<X>` 입력 시 자동으로 `</X>` 를 닫는 auto-close-tag 가 활성화돼 있다.
한 `type` 액션 안에 `<p><strong>...</strong>...</p>` 처럼 **중첩 닫기 태그**를 한꺼번에 입력하면
raw keyboard input 과 자동완성 이벤트가 race condition 을 일으켜 페이지가 close 될 수 있다.

이 경우 page 가 닫혀도 context 의 `recordVideo` 는 계속 진행되므로 빈 화면을 수십 분 녹화한
비정상 webm (60MB+) 이 만들어지고, 사실상 hang 처럼 보인다 (다른 씬 webm 은 보통 2~3MB).
**비결정적**이라 같은 JSON 으로 한 번은 통과하고 한 번은 hang 한다.
실측: `lecture-02-02` 씬 11 에서 `<p><strong>カレーライス</strong>...</p>` 한 번에 type 했을 때 매번 발생.

규칙:
- 같은 `type` 안에 동일 태그명의 열기/닫기 페어가 들어 있고 그 사이에 텍스트가 있는 패턴은 분할한다
  - 분할 안전: `<br>`, `<hr>` (셀프클로징, 닫기 페어 없음)
  - 분할 안전: `<h1>Hello</h1>` 같은 단순 단일 태그
  - 분할 대상: `<p><strong>X</strong>Y</p>`, `<p>...<em>X</em>Y</p>`
- 분할 단위는 **태그 경계** — 열기/닫기 페어를 한 `type` 안에 그대로 두고, 페어 사이에 짧은 `wait` (150~200ms) 를 끼운다
- 분할로 `actionIndex` 가 바뀌므로 **syncPoint 의 actionIndex 도 같이 갱신**한다

분할 예 (lecture-02-02 씬 11 기준):

```json
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<p>" },
{ "cmd": "wait", "ms": 200 },
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<strong>カレーライス</strong>" },
{ "cmd": "wait", "ms": 200 },
{ "cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "が私のいちばんの好物です。</p>" }
```

**스크립트-액션 대조 포인트**
- 스크립트가 "左上の「HTML」と書かれた入力エリアをクリック" 처럼 화면 위치를 말하면, action 도 해당 위치/셀렉터를 가리켜야 한다
- 스크립트가 "「H」「e」「l」「l」「o」" 처럼 한 글자씩 말하면, `type.key` 와 타이핑 구간 길이를 그 발화 속도에 맞춘다
- 스크립트가 "下のプレビューエリアを見てみてください" 라고 말하면, 같은 시점에 `mouse_move [960, 800]` 등으로 프리뷰를 가리킨다

**서술-동작 정합 규칙 (필수)**

- 나레이션은 화면에 실제로 보이는 조작만 서술한다.
- `Meta+a` → `Backspace` → 전체 재타이핑이 보이는데 스크립트가 "いったん全部消して書き直します" 계열이 아니면, action 을 스크립트에 맞게 줄이거나 변환 불가 사유로 보고한다.
- 실제로는 전체를 다시 쓰면서 나레이션만 "途中に Enter を一回入れます" 라고 말하면 안 된다.
- 아직 화면에 보이지 않은 결과를 선취해서 말하지 않는다.
- 씬을 분할해 상태가 끊기는 경우에도 "이전 상태가 유지된다" 고 말하지 말고, 필요하면 pre-fill 로 복원한 뒤 새 변화만 설명한다.

**예시: Hello World → 전체 삭제를 하나의 씬으로 통합 (104초, 5 syncPoints)**

아래 예시는 syncPoint 배치 형태를 보여주기 위한 축약 예시다. 실제 JSON 작성 시 첫 phrase 는 `goto + mouse_move` 또는 `goto + mouse_move + click` 시간을 덮을 수 있도록 도입 나레이션 뒤에 배치한다.

```json
{
  "scene_id": 19,
  "narration": "さあ、いよいよコードを書いてみましょう。...左上の「HTML」と書かれた入力エリアをクリックしてください。...「H」「e」「l」「l」「o」、半角スペース、「W」「o」「r」「l」「d」。入力できましたか？下のプレビューエリアを見てみてください。...先ほど書いた「Hello World」を一度全部消してください。...",
  "durationSec": 104,
  "visual": {
    "type": "playwright",
    "storageState": "config/auth/codepen.json",
    "syncPoints": [
      {"actionIndex": 4,  "phrase": "左上の「HTML」と書かれた入力エリアをクリック"},
      {"actionIndex": 6,  "phrase": "「H」「e」「l」「l」「o」、半角スペース"},
      {"actionIndex": 8,  "phrase": "下のプレビューエリアを見てみて"},
      {"actionIndex": 10, "phrase": "たったこれだけで、皆さんのブラウザ画面"},
      {"actionIndex": 12, "phrase": "先ほど書いた「Hello World」を一度全部消して"}
    ],
    "action": [
      {"cmd": "goto", "url": "https://codepen.io/pen/"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "mouse_move", "to": [400, 250]},
      {"cmd": "wait", "ms": 0},
      {"cmd": "click", "selector": "#box-html .CodeMirror"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "Hello World"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "mouse_move", "to": [960, 800]},
      {"cmd": "wait", "ms": 0},
      {"cmd": "mouse_move", "to": [400, 250]},
      {"cmd": "wait", "ms": 0},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "press", "key": "Backspace"},
      {"cmd": "wait", "ms": 0}
    ]
  }
}
```

- `wait ms: 0` 은 순방향 싱크가 syncPoints 기준으로 자동 재계산
- `press Backspace` 를 11회 반복해 "Hello World" (11자) 를 한 글자씩 지움 — 전체 선택 후 delete 보다 자연스러운 타이핑 애니메이션

**예시: pre-fill 로 이전 씬 내용 복원 (h1 Hello World → p 태그 추가)**

```json
{
  "scene_id": 21,
  "narration": "では次に、もう1行追加してみましょう。エイチワンタグの下の行にカーソルを移動して、Enter を押して新しい行を作ります。そこに、こう書いてください。...",
  "durationSec": 93,
  "visual": {
    "type": "playwright",
    "storageState": "config/auth/codepen.json",
    "syncPoints": [
      {"actionIndex": 8,  "phrase": "Enter を押して新しい行を作ります"},
      {"actionIndex": 10, "phrase": "そこに、こう書いてください"},
      {"actionIndex": 12, "phrase": "プレビューを見ると"}
    ],
    "action": [
      {"cmd": "goto", "url": "https://codepen.io/pen/"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "mouse_move", "to": [400, 250]},
      {"cmd": "wait", "ms": 0},
      {"cmd": "click", "selector": "#box-html .CodeMirror"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<h1>Hello World</h1>"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "press", "key": "Enter"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "type", "selector": "#box-html .CodeMirror textarea", "key": "<p>はじめてのWebページです！</p>"},
      {"cmd": "wait", "ms": 0},
      {"cmd": "mouse_move", "to": [960, 800]},
      {"cmd": "wait", "ms": 0}
    ]
  }
}
```

- actionIndex 6 의 `type "<h1>Hello World</h1>"` 는 **pre-fill** (이전 씬 복원). syncPoints 에 포함하지 않음
- 첫 syncPoint 는 actionIndex 8 (`press Enter`) 로, 나레이션의 "Enter を押して新しい行を作ります" 시점에 실행
- pre-fill 은 첫 syncPoint 이전 setup 구간에서 실행된다. 나레이션은 복원 동작을 직접 설명하지 말고, 복원 후 새 변화인 Enter 입력부터 설명한다

### AIライブデモ씬 (storageState + 역방향/공유 세션 싱크)

Claude.ai, ChatGPT 등 로그인 필요한 AI 서비스를 조작하는 씬.

AI 라이브 데모는 두 방식이 있다.

| 방식 | 조건 | 용도 |
|---|---|---|
| isolated 역방향 싱크 | `wait_for` / `wait_for_claude_ready` 포함, `session.mode` 없음 | 씬 단위 독립 녹화. 비디오 타임스탬프에 맞춰 TTS WAV 에 무음 삽입 |
| shared session | `session.mode: "shared"` | 여러 씬이 하나의 브라우저 page 를 공유. offscreen action 으로 가변 대기를 씬 밖으로 밀고 visible action 은 순방향 싱크 |

**shared session 필수 제약**
- 모든 shared session action 에서 `urlFromScene` 사용 금지. shared session 은 같은 page 인스턴스를 이어받는다.
- 같은 session 그룹의 첫 씬은 `goto` 로 시작할 수 있지만, 두 번째 이후 씬은 `goto` 금지. 후속 씬은 이전 page 상태를 이어받아야 한다.
- shared session 전체에서 `render_code_block` 금지. page 를 교체해 후속 씬 상태를 깨뜨린다.
- shared session 의 syncPoints 는 `offscreen: true` action 을 가리키면 안 된다. syncPoint 는 visible action 에만 둔다.

**파이프라인 처리 흐름 (isolated 역방향 싱크)**
1. 파이프라인 **0단계**에서 사전 녹화 (실제 AI 응답 대기 포함 → 녹화 길이가 가변적)
2. 파이프라인 1단계에서 TTS 생성 (나레이션 길이 기준)
3. 파이프라인 **1.7a단계**에서 역방향 싱크: 녹화 매니페스트의 action 완료 시점을 기준으로 TTS WAV에 무음 삽입
4. 최종 클립 길이 = 무음 삽입 후 WAV 길이 (비디오 녹화 길이와 자동 정합)

shared session 씬은 위 0단계/1.7a 역방향 싱크 대상이 아니다. 1.7b 순방향 싱크 후 3a단계 shared session capture 로 처리된다.

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
- `wait_for` 또는 `wait_for_claude_ready` 가 포함된 씬은 **라이브 데모 씬**으로 분류된다. 단, `session.mode: "shared"` 이면 역방향 싱크가 아니라 shared session 경로다
- streaming 완료 후 Artifact/Canvas 프리뷰가 자동 표시됨 — streaming 완료 후 `wait 5000`으로 충분

**syncPoints 사용 (역방향 싱크)**
- phrase는 비디오의 특정 action 시점에 맞춰 재생되어야 할 나레이션 구절
- 대표적 패턴: AI 응답 완료 후 "出てきましたね" 같은 결과 확인 나레이션
- syncPoint 에 `target: "start" | "end"` 를 지정할 수 있다. 미지정 시 `wait` / `wait_for` 는 `end`, 그 외 action 은 `start` 기준이다
- `wait_for_claude_ready` 완료 시점에 맞추려면 `target: "end"` 를 명시한다. 미지정 시 시작 시점 기준으로 처리된다

**action 설계 포인트**
- `press Enter` (송신) 전에 wait를 넣어 송신 전 발화 시간이 지나도록 한다 — 역방향 싱크는 무음 삽입만 가능하고 나레이션을 앞당길 수 없음
- streaming 완료 후 `wait 5000` → Artifact 프리뷰 로드 대기
- 결과 확인 구간에 `scroll` + `wait`로 Artifact 프리뷰를 스크롤하며 보여주기
- **셀렉터 선택**: AI 도구 UI 는 클래스명·자식 텍스트가 자주 바뀐다. `button:has-text('...')` 대신 `button[aria-label*='...']` 처럼 **접근성 속성 기반**을 우선한다. 예: Artifact 오픈 버튼 → `button[aria-label*='アーティファクトを開く']` (상세: `docs/playwright-ai-live-demo-history.md` §4.1)
- **스크롤 대상 패널 내부로 커서 이동 필수**: `scroll` 은 현재 커서가 놓인 스크롤 컨테이너만 스크롤한다. Claude 는 좌측 채팅과 우측 Artifact 가 각각 독립 스크롤이므로, Artifact 를 스크롤하려면 `mouse_move` 로 먼저 우측 패널 내부 좌표로 커서를 옮긴 뒤 `scroll` 해야 한다 (상세: `docs/playwright-actions.md` → `scroll` 섹션)
- **Artifact 패널은 명시 지시 시 자동 오픈 — `click` 불필요**: 프롬프트에 "アーティファクトとして作成してください" 가 포함되면 Claude 가 streaming 중 Artifact 패널을 자동으로 연다. 이 경우 `click button[aria-label*='アーティファクトを開く']` 를 별도로 넣으면 버튼이 존재하지 않아 10초 타임아웃이 발생한다. `wait_for streaming='false'` 이후 프리뷰 로드용 `wait 5000` 만으로 충분. 명시 지시가 없으면 `type.key` 의 프롬프트를 Artifact 명시 지시가 포함되도록 구성한다. 상세: `docs/playwright-ai-live-demo-history.md` §4.7

**프롬프트 설계 원칙 — 나레이션 정합**

AI 라이브 데모 씬의 `type.key` (Claude 에 입력되는 프롬프트) 는 일반 사용자 프롬프트와 다르다. 동영상 나레이션이 "출력 화면" 을 설명하므로, **프롬프트가 출력 구조를 결정론적으로 고정**해야 나레이션과 화면이 어긋나지 않는다.

1. **Artifact 명시 지시 필수**: 프롬프트에 아래 문장을 **반드시 포함**.
   ```
   インラインのコードブロックではなく、アーティファクトとして作成してください。
   ```
   이 지시가 없으면 Claude 가 대화창 내 인라인 코드블록으로 출력할 수 있고 (모델·컨텐츠 크기에 따라 비결정적), Artifact 패널이 열리지 않아 결과 확인 씬의 전제가 깨진다.

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

> 본 예시는 하나의 씬에 송신·결과 확인을 합친 간단 버전. 실제 제작에서는 Claude 응답 대기 시간이 불안정하면 송신 씬과 결과 확인 씬을 shared session 으로 분할한다 (상세: `docs/playwright-ai-live-demo-history.md`).


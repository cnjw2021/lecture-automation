# Playwright Action 명세서

강의 JSON의 `"type": "playwright"` 씬에서 사용할 수 있는 모든 액션 목록입니다.

## 사용 형식

```json
{
  "scene_id": 10,
  "narration": "...",
  "visual": {
    "type": "playwright",
    "action": [
      { "cmd": "액션명", "파라미터": "값" }
    ]
  }
}
```

---

## 액션 목록

### `goto` — URL 이동

지정한 URL로 이동합니다. 페이지 로드 완료(`load` 이벤트) 후 마우스 커서를 자동 주입합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `url` | string | ✅ | 이동할 URL |

```json
{ "cmd": "goto", "url": "https://www.yahoo.co.jp" }
```

> **주의**: 페이지 로드 후 커서(`__edu_cur__`)가 자동 삽입됩니다. `mouse_move`를 함께 사용해야 커서가 화면에 표시됩니다.

---

### `prefill_codepen` — CodePen 사전 입력 콘텐츠로 신규 pen 생성·이동

CodePen Prefill API ([공식 문서](https://blog.codepen.io/documentation/api/prefill/)) 를 사용해 HTML/CSS/JS 가 미리 입력된 신규 pen 페이지로 직접 이동합니다. `goto https://codepen.io/pen/` 가 빈 에디터를 먼저 노출시키는 것과 달리, 본 액션은 콘텐츠가 처음부터 에디터에 들어 있는 상태로 페이지가 로드되어 "저장된 pen 을 다시 연 느낌" 의 자연스러운 데모를 만듭니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `html` | string | ⛔ | HTML 에디터 초기 콘텐츠 |
| `css` | string | ⛔ | CSS 에디터 초기 콘텐츠 |
| `js` | string | ⛔ | JS 에디터 초기 콘텐츠 |
| `editors` | string | ⛔ | editors 표시 패턴 (예: `"100"` = HTML 만 보이기, `"111"` = 모두). 미지정 시 CodePen 기본값 |

```json
{
  "cmd": "prefill_codepen",
  "html": "<a href=\"https://www.google.com\" target=\"_blank\">Googleを開く</a>\n<a href=\"https://www.youtube.com\" target=\"_blank\">YouTubeを見る</a>\n"
}
```

**용도**: 이전 씬에서 입력한 콘텐츠를 다음 씬의 초기 상태로 가져가야 하는데 shared session 이 부적합한 경우 (예: 씬 사이에 nontriv ial 시간차, narration 흐름이 isolated 가 자연스러운 경우). 재타이핑이 어색해 보이는 문제를 해결합니다.

**제약**:
- `goto` 의 대체로 사용 — 씬의 첫 번째 또는 두 번째 액션에 배치 권장
- POST navigation 이라 `urlFromScene` 과 함께 사용 불가
- 생성되는 pen 은 매번 새 URL 이며, 이전 pen 의 URL 을 재사용하지 않음 (사용자 계정에 저장하려면 이후 단계 필요)
- shared session 에서는 사용 금지 (페이지 navigation 이 세션 상태를 파괴)

---

### `wait` — 대기

지정한 시간(ms) 동안 대기합니다. 나레이션 타이밍 조절에 사용합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `ms` | number | ✅ | 대기 시간 (밀리초) |

```json
{ "cmd": "wait", "ms": 3000 }
```

---

### `mouse_move` — 마우스 이동

지정한 좌표로 마우스를 부드럽게 이동합니다 (30 steps). `goto` 이후 커서가 주입된 상태에서 커서가 화면에 표시됩니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `to` | [x, y] | ✅ | 목적지 좌표 (뷰포트 기준, 1920×1080) |

```json
{ "cmd": "mouse_move", "to": [960, 400] }
```

> **좌표 참고**:
> - 뷰포트: 1920 × 1080
> - DevTools 패널 시작점 x ≈ 1190 (오른쪽 38%)
> - DevTools HTML 트리 행 높이: 약 20px, 탭바 이후(y ≈ 45부터)

---

### `open_devtools` — DevTools 오버레이 표시

실제 페이지 DOM을 파싱해 Chrome DevTools 외관의 패널을 페이지 오른쪽(38% 너비)에 주입합니다. 슬라이드인 애니메이션(0.25s) 포함.

파라미터 없음.

```json
{ "cmd": "open_devtools" }
```

**패널 구성:**
- 탭바: Elements(활성), Console, Sources, Network
- 좌측: 실제 DOM 트리
- 우측: Styles 패널 (`id="__edu_devtools_styles__"`)

> **재사용 팁**: `highlight` 액션으로 `#__edu_devtools_styles__`를 지정하면 Styles 패널을 강조할 수 있습니다.

> **교육용 기능**: `select_devtools_node`, `toggle_devtools_node`를 함께 사용하면 `head`, `body`, 특정 `h1`/`img` 같은 실제 요소에 대응하는 트리 노드를 선택하거나 펼칠 수 있습니다.

---

### `select_devtools_node` — DevTools 트리에서 실제 DOM 노드 선택

실제 페이지의 CSS 셀렉터를 기준으로 대응하는 DevTools 트리 노드를 선택합니다. 필요하면 조상 노드를 자동으로 펼치고, 해당 행을 스크롤해 보여줍니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ✅ | 실제 페이지 요소를 찾기 위한 CSS 셀렉터 |
| `note` | string | ❌ | 설명 (로그/참고용) |

```json
{ "cmd": "select_devtools_node", "selector": "head", "note": "head 노드 선택" }
{ "cmd": "select_devtools_node", "selector": "body", "note": "body 노드 선택" }
{ "cmd": "select_devtools_node", "selector": "h1", "note": "보이는 제목 요소와 연결" }
```

> **권장 사용처**: `head는 설정`, `body는 화면에 보이는 중身`, `CodePen의 HTML欄 ≒ body` 같은 설명을 시각적으로 연결할 때 적합합니다.

---

### `toggle_devtools_node` — DevTools 트리 노드 펼침/접힘

대상 노드의 펼침 상태를 바꾸거나, 명시적으로 펼치거나 접습니다. `selector`를 생략하면 현재 선택된 노드에 적용합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ❌ | 실제 페이지 요소를 찾기 위한 CSS 셀렉터 |
| `mode` | `"toggle" \| "expand" \| "collapse"` | ❌ | 기본값은 `toggle` |
| `note` | string | ❌ | 설명 (로그/참고용) |

```json
{ "cmd": "toggle_devtools_node", "selector": "body", "mode": "expand" }
{ "cmd": "toggle_devtools_node", "mode": "collapse" }
```

---

### `highlight` — 요소 하이라이트

CSS 셀렉터로 지정한 요소에 분홍색 아웃라인(`5px solid #ff007a`)을 적용합니다. 1500ms 후 자동으로 다음 액션으로 넘어갑니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ✅ | CSS 셀렉터 |
| `note` | string | ❌ | 설명 (로그/참고용) |

```json
{ "cmd": "highlight", "selector": "body", "note": "HTML이 페이지 구조를 정의" }
{ "cmd": "highlight", "selector": "#__edu_devtools_styles__", "note": "CSS 패널 강조" }
```

---

### `disable_css` — CSS 비활성화

페이지의 모든 스타일시트를 비활성화합니다. DevTools 오버레이(`__edu_*`)는 보호됩니다.

파라미터 없음.

```json
{ "cmd": "disable_css" }
```

> **효과**: 페이지 레이아웃이 브라우저 기본 스타일만 남아 1990년대 스타일로 변합니다. "CSSを無効にしてみます" 시연에 사용합니다.

---

### `enable_css` — CSS 재활성화

`disable_css`로 비활성화된 스타일시트를 전부 복원합니다.

파라미터 없음.

```json
{ "cmd": "enable_css" }
```

---

### `click` — 클릭

지정한 요소를 클릭합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ✅ | CSS 셀렉터 |

```json
{ "cmd": "click", "selector": "#submit-btn" }
```

---

### `type` — 텍스트 입력

지정한 입력 요소에 텍스트를 타이핑합니다 (딜레이 100ms/문자로 타이핑 효과 재현).

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ✅ | 입력 요소 CSS 셀렉터 |
| `key` | string | ✅ | 입력할 텍스트 |

```json
{ "cmd": "type", "selector": "#search-input", "key": "HTML とは" }
```

---

### `press` — 키보드 키 입력

키보드 키를 누릅니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `key` | string | ✅ | 키 이름 (Playwright 키 이름 형식) |

```json
{ "cmd": "press", "key": "Enter" }
{ "cmd": "press", "key": "Escape" }
```

> **주의**: `F12`는 headless 환경에서 DevTools를 열지 않습니다. DevTools 표시에는 `open_devtools`를 사용하세요.

---

### `focus` — 포커스

지정한 요소에 포커스를 줍니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ✅ | CSS 셀렉터 |

```json
{ "cmd": "focus", "selector": "input[type='text']" }
```

---

### `mouse_drag` — 마우스 드래그

시작점에서 끝점으로 드래그합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `from` | [x, y] | ✅ | 드래그 시작 좌표 |
| `to` | [x, y] | ✅ | 드래그 끝 좌표 |

```json
{ "cmd": "mouse_drag", "from": [200, 300], "to": [600, 300] }
```

---

### `scroll` — 스크롤

페이지를 수직 스크롤합니다. 마우스 휠 이벤트를 발생시키며, 스크롤 후 300ms 대기합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `deltaY` | number | ❌ | 스크롤 양 (기본값 300). 양수=아래, 음수=위 |

```json
{ "cmd": "scroll", "deltaY": 300 }
```

> ⚠️ **커서 위치에서 스크롤됨**
>
> 내부 구현은 `page.mouse.wheel(0, deltaY)` 로, **현재 커서가 놓인 스크롤 컨테이너**만 스크롤된다. 페이지에 독립된 스크롤 영역이 여러 개인 UI(예: Claude 좌측 채팅 + 우측 Artifact 프리뷰 / VS Code 편집기 + 파일 트리 등) 에서 의도한 영역을 스크롤하려면, **반드시 `scroll` 직전에 `mouse_move` 로 커서를 대상 영역 안쪽으로 옮긴다**. 좌표가 대상 영역을 벗어나면 전혀 다른 패널이 스크롤되며, 이는 녹화 영상에서만 발견되기 쉬운 무음 버그다.
>
> ```json
> {"cmd": "mouse_move", "to": [1500, 500], "note": "Artifact 패널 내부로 커서 이동 (1920×1080 기준 우측 x>1040)"},
> {"cmd": "scroll", "deltaY": 300}
> ```
>
> 2026-04-18 실측 사고: `mouse_move [720, 400]` 로 커서를 채팅 영역에 둔 채 `scroll` 을 호출해, Artifact 대신 대화 이력이 스크롤됐다. 나레이션은 "プレビューをスクロール…" 를 설명하고 있어 싱크가 완전히 깨짐.

---

### `wait_for` — 셀렉터 조건 대기

지정한 셀렉터가 특정 상태가 될 때까지 대기합니다. AI 라이브 데모 씬에서 streaming 완료 감지에 사용합니다.

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| `selector` | string | ✅ | 대기할 요소의 CSS 셀렉터 |
| `state` | string | ❌ | `"visible"` \| `"attached"` \| `"hidden"` (기본값 `"visible"`) |
| `timeout` | number | ❌ | 최대 대기 시간 ms (기본값 30000) |

```json
{ "cmd": "wait_for", "selector": "[data-is-streaming='false']", "state": "attached", "timeout": 180000 }
```

> **AI 라이브 데모 표준 패턴**: streaming 시작 감지 → streaming 완료 감지 순서로 사용:
> ```json
> {"cmd": "wait_for", "selector": "[data-is-streaming='true']", "state": "attached", "timeout": 60000},
> {"cmd": "wait_for", "selector": "[data-is-streaming='false']", "state": "attached", "timeout": 180000}
> ```
> `wait_for`가 action에 포함된 씬은 **라이브 데모 씬**으로 분류되어 파이프라인 0단계에서 사전 녹화되고, 역방향 싱크 대상이 된다.

---

## 씬 타이밍 설계 가이드

Playwright 녹화 시간이 오디오(`durationSec`)보다 짧으면 마지막 프레임이 고정됩니다.

**총 액션 시간 ≥ `durationSec` - 2초** (마지막 2초는 자동 여백)

```
goto 소요 시간 예상치:
  Yahoo Japan: ~4~8초 (load 기준)
  Apple:       ~3~7초
  일반 사이트: ~2~5초

예시 (durationSec: 20):
  goto(5s) + actions(11s) + 자동여백(2s) = 18s → 18 ≥ 18 ✅
```

---

## 구현 위치

`packages/automation/src/infrastructure/providers/PlaywrightVisualProvider.ts`

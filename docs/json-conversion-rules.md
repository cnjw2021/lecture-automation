# 講義スクリプト → Remotion JSON 変換ルール

## 役割
확정된 강의 스크립트(마크다운)를 Remotion 동영상 생성 앱의 입력 JSON으로 변환한다. 스크립트 내용은 수정하지 않는다.

## AI 변환 필수 프로토콜

JSON 변환 에이전트는 상세 규칙을 읽기 전에 반드시 아래 순서로 작업한다. 이 섹션은 실행 순서이며, 아래 본문은 판단 근거와 예시다.

1. **스크립트 보존**
   - 나레이션은 확정 스크립트를 그대로 사용한다. 요약·의역·추가 설명·삭제를 하지 않는다.
   - 단, TTS 오독 방지를 위한 의미 보존형 표기 정규화(`パート1` → `パートワン` 등)는 lint 자동 수정 범위에서만 허용한다.
   - 스크립트와 JSON 구조가 충돌하면 임의로 고치지 말고 변환 불가 사유를 남긴다.

2. **씬 경계 결정**
   - `【スライド】`, 코드블록, `【AIデモ】`, 의미 전환점을 기준으로 씬을 나눈다.
   - 같은 CodePen·브라우저 실습이 이어지면 분할보다 통합을 먼저 검토한다. 분할하면 브라우저 상태가 리셋된다.

3. **visual 타입 결정**
   - 일반 설명은 Remotion 컴포넌트 표에서 고른다.
   - 실제 브라우저 조작·AI 도구 조작은 `type: "playwright"` 로 작성한다.

4. **Playwright 씬이면 먼저 planning table 을 만든다**
   - 실제 JSON 작성 전, 내부적으로 아래 항목을 점검한다. 최종 JSON에는 표를 넣지 않는다.
   - `sync mode`: 일반 순방향 / isolated 역방향 / shared session
   - `setup actions`: `goto`, 첫 `mouse_move`, 첫 `click`, 포커스 준비
   - `pre-fill actions`: 이전 상태 복원용 조용한 `type`
   - `teaching actions`: 나레이션이 설명하는 새 조작
   - `first sync phrase`: 첫 teaching phrase 가 setup floor 이후인지
   - `segment budget`: 각 syncPoint 구간의 fixed action ms, narration budget ms, wait 존재 여부

5. **Playwright syncPoint 배치**
   - 일반 순방향 syncPoint 는 `type`, `press`, `mouse_move`, `highlight`, 설명 대상인 `click` 같은 teaching action 에만 둔다.
   - 일반 순방향 syncPoint 를 `goto`, `wait`, `wait_for`, `wait_for_claude_ready` 에 두지 않는다.
   - isolated 역방향 싱크에서 대기 완료 시점에 맞출 때만 `wait` / `wait_for` / `wait_for_claude_ready` + `target: "end"` 를 검토한다.

6. **세그먼트 예산 검증**
   - 각 syncPoint 사이에서 `narration budget >= wait 제외 fixed action 시간 + 1초 여유`를 만족해야 한다.
   - 조정 대상 구간에는 최소 1개의 `wait` 가 있어야 한다.
   - 만족하지 않으면 JSON wait 로 해결하지 않는다. 액션을 줄이거나, syncPoint 를 더 잘게 나누거나, pre-fill 을 단축하거나, 변환 불가 사유로 보고한다.

7. **나레이션-화면 정합성 검증**
   - 나레이션 문장마다 실제로 보이는 액션과 1:1로 대조한다.
   - 화면에서는 전체 삭제·재타이핑을 하는데 나레이션은 "한 줄만 추가"라고 말하는 식의 축소 서술을 금지한다.
   - AI 출력 화면을 설명하는 경우, 프롬프트에서 고정한 요소만 나레이션에서 단언한다.

8. **저장 후 자동 검증**
   - JSON 저장 후 `make lint-fix LECTURE=lecture-XX.json` 로 자동 수정 가능 항목을 반영한다.
   - 이어서 `make lint LECTURE=lecture-XX.json STRICT=1` 로 남은 오류를 확인한다.
   - Playwright 씬이 있으면 TTS 생성 후 파이프라인 1.7b 또는 `make sync-playwright LECTURE=lecture-XX.json` 로 wait 를 재계산한다. TTS 생성 전 단독 실행은 문자수 기반 추산이므로 최종 sync 로 간주하지 않는다.
   - 최종 webm 또는 렌더에서 시작부 공백, 후반 무음 타이핑, 화면과 다른 서술이 없는지 확인한다.

## 参照ドキュメント

JSON 변환 시에는 본 파일을 먼저 읽고, 필요한 경우 아래 세부 문서를 추가 참조한다.

- [`docs/remotion-component-selection-rules.md`](remotion-component-selection-rules.md) — 스크립트 내용별 Remotion 컴포넌트 선택 기준
- [`docs/component-props-reference.md`](component-props-reference.md) — 각 Remotion 컴포넌트 props 명세
- [`docs/remotion-domain-visual-patterns.md`](remotion-domain-visual-patterns.md) — 코드/결과 매핑, HTML 구조, Flexbox, selector 등 도메인 시각 패턴의 활성/후보 판단
- [`docs/remotion-visual-style-presets.md`](remotion-visual-style-presets.md) — 강의 맥락별 visual style preset 분류와 `visual.stylePreset` 값
- [`docs/json-information-density-comparison.md`](json-information-density-comparison.md) — #123 정보 밀도 before/after still 비교 표본
- [`docs/playwright-conversion-rules.md`](playwright-conversion-rules.md) — Playwright 씬의 sync 방식·세그먼트 예산·CodePen/AI 데모 패턴
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
| 기본 | 1초 ≒ 5.5자(일본어). `ceil(文字数 / 5.5)` 로 산출. 例: 110자 → 20초 | |
| 코드 씬 | 나레이션 + 타이핑 2초 + 읽기 시간 추가 | |
| isolated AI 라이브 데모 씬 | **나레이션 글자수 기반으로만 산출** | 역방향 싱크가 비디오 녹화 길이에 맞춰 TTS에 무음을 자동 삽입하므로 최종 클립 길이는 비디오에 맞춰짐. AI 응답 대기 시간은 포함하지 않음 |

- 씬 길이 목안: 최소 5초, 일반 10~25초 (통합 Playwright 씬과 isolated AI 라이브 데모 씬은 예외)
- durationSec를 임의로 설정하지 않는다. 반드시 나레이션 길이 기반으로 산출

## トランジションルール
- 기본: 생략(=fade)
- TitleScreen, SectionBreakScreen: `enter: "zoom"`
- 코드 씬: `enter: "slide-up"`
- 섹션 전환: `enter: "slide-left"`
- EndScreen: `exit: "zoom"`

## ナレーション表記・正規化ルール

### 記号禁止
- ❌ `——`(em 대시) 사용 금지 — TTS가 "マイナス"로 읽음. `、つまり` `、たとえば` 등 접속표현으로 대체
- ❌ `（）` 괄호로 보충 설명 삽입 금지 — TTS 모델에 따라 괄호 내용까지 읽어 부자연스러움. 접속표현으로 대체

### 数字表記ルール（TTS誤読防止）

나레이션 안에서 **カタカナ + 아라비아 숫자** 조합은 TTS(ElevenLabs v3 등)가 불안정하게 읽는다.
예: `パート1` → "パートワッチ" 로 오독된 사례 있음 (강의 01-04, 01-03 확인).

→ 반드시 **숫자 부분도 カタカナ로 명시**한다.

| ❌ 나레이션 표기 | ✅ 나레이션 표기 |
|------------------|------------------|
| パート1 | パートワン |
| パート2 | パートツー |
| パート3 | パートスリー |
| パート4 | パートフォー |
| パート5 | パートファイブ |

- 동일 원칙을 다른 カタカナ+숫자 조합에도 적용한다 (예: `セクション1` → `セクションワン`).
- **visual props**(title, detail, label 등 화면 표시 텍스트)는 `パート1` `PART 1` 모두 허용 — TTS 대상이 아니므로 변경 불필요.
- 기본 영어 용어 `PART` 를 그대로 쓰는 경우(`PART 1`) 도 동일 규칙 적용: `PART ワン` 또는 `パートワン` 으로 표기해 TTS가 숫자를 혼동하지 않게 한다.

### TTS 오독 자동 점검 (lint-lecture)

JSON 저장 후 반드시 lint를 실행한다. 검출된 자동 수정 가능 오독 패턴은 `lint-fix` 로 의미 보존 범위에서만 치환한다.

```bash
make lint-fix LECTURE=lecture-XX.json
make lint LECTURE=lecture-XX.json STRICT=1
```

검출·수정 대상 예:
- カタカナ+숫자 (`パート1` → `パートワン`)
- 動詞 焦る 오독 (`焦ら` → `あせら`)
- 漢字 발음 흔들림 (`上半分` → `上のエリア`)
- 영어 약어 오독 (`gap` → `ギャップ`, `px` → `ピクセル`, `h1` → `エイチワン`)
- UI 라벨 오독 (`Authorize` → `オーソライズ`)

변환 단계에서는 lint 결과를 JSON에 반영하는 것까지만 수행한다.

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
| Authorize | オーソライズ |
| 기타 | 문맥에 따라 판단 |

- 예외: `google.com` 같은 도메인명은 나레이션에서 직접 언급 대신 "Googleのアドレス" 등으로 우회

### visualのテキスト表記
- 화면에 표시되는 props(title, headline, items 등)는 영어·일본어 병기 가능
- 나레이션도 위 기본 용어 목록에 해당하면 영어 표기 가능

## コンポーネント選択

컴포넌트 선택 기준은 [`docs/remotion-component-selection-rules.md`](remotion-component-selection-rules.md)를 참조한다. props 상세는 [`docs/component-props-reference.md`](component-props-reference.md)를 따른다.

### Visual style preset

`visual.stylePreset`은 선택 필드다. 기존 JSON 호환을 위해 생략 가능하며, 생략 시 `config/video.json`의 `visualStylePresets.defaultPreset` 정책을 따른다. 허용 값 목록은 `config/video.json`의 `visualStylePresets.supportedPresets`와 일치해야 한다.

사용 가능한 값은 [`docs/remotion-visual-style-presets.md`](remotion-visual-style-presets.md)를 따른다.

| 장면 맥락 | stylePreset |
|---|---|
| 개념 설명, 정의, 비유, 기본 도식 | `concept-calm` |
| 코드 첫 등장, 코드 워크스루, 문법 설명 | `code-focus` |
| 브라우저 결과, 라이브 코딩, AI 도구 데모, 정적 캡처 | `demo-native` |
| good/bad, before/after, tradeoff, 양쪽 비교 | `compare-contrast` |
| 단계, 흐름, 타임라인, 진행 상황 | `process-flow` |
| 요약, 마무리, 다음 강의 예고 | `recap-synthesis` |

규칙:

- `stylePreset`은 컴포넌트 선택 이후에 정한다. 잘못 고른 컴포넌트를 preset으로 보정하지 않는다.
- `visual.props` 안에 넣지 않는다. `visual` 바로 아래에 둔다.
- 기존 강의 전체에 기계적으로 추가하지 않는다. 신규 또는 재변환 씬에서 맥락이 분명할 때 opt-in한다.
- 목록에 없는 값을 임의로 만들지 않는다. 새 preset이 필요하면 #128 정책 문서를 먼저 갱신한다.

### Visual planning baseline

인포그래픽 시각화 개선의 현재 기준선은 [`docs/remotion-infographic-baseline-audit.md`](remotion-infographic-baseline-audit.md)를 참조한다.
`visual.component`를 쓰기 전에 아래 질문을 순서대로 확인한다.

1. 실제 브라우저나 AI 도구 조작을 보여줘야 하는가? 그렇다면 `type: "playwright"` 를 사용한다. 정적인 브라우저 상태만 필요하면 `BrowserMockScreen` 또는 `ImageScreen` 을 사용한다.
2. 핵심 대상은 코드 문법, 브라우저 UI, 과정/관계, 비교, 병렬 사실 목록 중 무엇인가? 문장 형태가 아니라 정보 구조 기준으로 컴포넌트 계열을 고른다.
3. 나레이션에 의존하지 않고 화면에 남겨야 할 정보는 1개 개념, 양쪽 대비, 3〜5개 병렬 항목, 흐름 중 무엇인가? 그 정보 단위를 props에 남긴다.
4. `SummaryScreen`을 단순 문자열 목록을 담기 위해 쓰고 있지는 않은가? 지시문, 프롬프트 조건, 도구 후보, 역할 분해라면 더 구체적인 list/detail/comparison 컴포넌트를 우선한다.
5. 같은 컴포넌트 또는 같은 시각 리듬이 3씬 이상 이어지는가? 이어진다면 같은 정보 구조를 표현할 수 있는 다른 컴포넌트를 검토한다.
6. 코드와 렌더링 결과의 대응, HTML 트리와 화면 결과의 동시 표시, CSS 박스 모델의 층 구조, Flexbox 축/배치 변화, 셀렉터와 매칭 요소의 대응처럼 현재 컴포넌트로 정확히 표현하기 어려운 구조인가? 그렇다면 가장 덜 오해를 만드는 기존 컴포넌트를 쓰고, #127 후속 후보로 기록한다.

### Slide information density policy

#122 / #123 품질 기준에 따라 설명 씬의 `visual.props`는 나레이션의 짧은 요약이 아니라 학습 정보 구조를 담아야 한다. 변환자는 일반 설명 씬마다 화면만 보고도 핵심을 복습할 수 있는지 먼저 점검한다.

설명 씬은 가능한 경우 아래 정보 단위 중 3개 이상을 화면에 남긴다.

| 정보 단위 | 화면에 남기는 형태 |
|---|---|
| 핵심 개념 | 용어, 한 줄 정의, 중심 노드, 강조 라벨 |
| 구체 예시 | 코드 조각, 실제 문장, 사용 장면, 웹사이트 예 |
| 오해 방지 포인트 | wrong/right, warning, "見た目ではなく構造" 같은 기준 문장 |
| 관계/대응 | A→B 흐름, 코드↔결과, 부모↔자식, 원인↔결과 |
| 단계/계층 | h1→h2→h3, 1→2→3 절차, 현재 위치 |
| 실무 판단 기준 | "順番に意味があるならol" 처럼 선택 기준 |
| 결론/take-away | 일시정지 후 기억해야 할 한 문장 |

규칙:

- `headline + detail` 또는 `question + answer`만으로 일반 설명 씬을 끝내지 않는다. 나레이션이 구조, 예시, 이유, 판단 기준을 함께 설명한다면 해당 단위를 props에 분해한다.
- 텍스트를 늘릴 때 긴 문단을 그대로 넣지 않는다. 카드, 비교, 행 목록, 계층, 흐름, 코드 주석, before/after, callout 중 하나로 구조화한다.
- 평균 기준은 설명 씬당 의미 있는 정보 단위 3개 이상이다. 같은 문장을 여러 줄로 나눈 것은 여러 정보 단위로 세지 않는다.
- 3개 미만이 적절한 경우는 예외 사유가 분명해야 한다. 예: 강의 시작, 섹션 전환, 마무리, 한 가지 메시지를 크게 고정하는 키 포인트, 인용/정의 한 줄 강조.
- 화면 정보는 나레이션 전문을 대체하지 않는다. 나레이션이 순차적으로 말하는 내용을 화면에서는 관계, 계층, 대응, 판단 기준으로 보완한다.
- 현재 컴포넌트로 구조를 정확히 표현할 수 없으면 가장 가까운 활성 컴포넌트를 사용하고, 부족한 구조를 #126 / #127 후속 후보로 기록한다. 후보 컴포넌트명을 lecture JSON에 직접 쓰지 않는다.

정보 단위 카운팅 기준:

- 나레이션의 핵심 정보 단위는 장면을 이해하는 데 필요한 개념, 관계, 예시 묶음, 판단 기준, 결론을 기준으로 추출한다.
- 한 문장 안에서 같은 의미를 반복하거나 다른 표현으로 재진술한 것은 1단위로 센다. 같은 역할의 예시 다발(예: 手順・ランキング・レシピ)은 개별 예시가 아니라 하나의 예시 묶음으로 센다.
- 노드, 카드, 컬럼 포인트, 단계, 계층 항목처럼 독립적으로 읽히는 학습 항목은 1단위로 센다.
- 엣지 라벨, badge, caption, 짧은 subtitle은 독립 정보가 아니라 관계나 take-away를 보강할 때만 0.5〜1단위로 센다. 같은 의미를 제목과 caption에 반복하면 추가 단위로 세지 않는다.
- 코드 블록 전체는 1단위로 세고, `highlightLines`나 caption이 별도의 판단 기준을 제공하면 1단위를 추가할 수 있다.
- 복원율은 `still에서 확인 가능한 핵심 정보 단위 / 나레이션에서 추출한 핵심 정보 단위`로 산출한다. 일반 설명 씬은 70% 이상을 목표로 하며, 70% 미만이면 구조형 컴포넌트 재선택 또는 단문 허용 예외 기록이 필요하다.

변환 전 체크 질문:

1. 이 씬을 음소거하고 still만 봤을 때 핵심 개념, 예시, 판단 기준 중 무엇을 복원할 수 있는가?
2. `visual.props`가 나레이션 첫 문장이나 결론 한 줄만 축약하고 있지는 않은가?
3. 나레이션에 나오는 관계/계층/비교/흐름 중 화면에 구조로 남긴 것이 있는가?
4. 단문 슬라이드라면 위 예외 케이스에 해당하는가?
5. reference slide와 나란히 놓았을 때 정보 밀도 차이가 즉시 드러나지 않는가?

검증 산출물:

- 기존 강의 JSON에서 단문 위주 설명 씬을 최소 2개 고른다.
- 새 규칙으로 `visual`을 재변환하되 나레이션은 보존한다.
- before/after still을 영속 경로에 저장하고 reference slide 비교 대상과 함께 비교 문서에 기록한다.
- 비교용 still은 기본 960x540 또는 동등한 절반 해상도로 저장하고, `pngquant`/`oxipng` 등으로 압축한다. 원본 1920x1080 PNG는 특별한 픽셀 검수가 필요할 때만 커밋한다.
- 예시는 [`docs/json-information-density-comparison.md`](json-information-density-comparison.md)에 누적한다.

### 핵심 선택 원칙

- 강의 시작은 `TitleScreen`, PART 전환은 `SectionBreakScreen`, 강의 끝은 `SummaryScreen` 후 `EndScreen` 을 사용한다.
- 코드 첫 등장은 `MyCodeScene`, 이미 보여준 코드의 행별 설명은 `CodeWalkthroughScreen` 을 사용한다.
- 실제 브라우저 조작은 Remotion 컴포넌트가 아니라 `type: "playwright"` 를 사용한다.
- 브라우저 UI 설명은 이미지가 없으면 `BrowserMockScreen`, 실제 캡처 이미지가 있으면 `ImageScreen` 을 사용한다.
- 동일 컴포넌트 3씬 이상 연속 사용을 피한다. 연속 씬은 내용뿐 아니라 레이아웃·컴포넌트 종류도 달라야 한다.

## Playwright 씬 설계 규칙

Playwright 씬(`"type": "playwright"`)은 실제 브라우저 조작이 들어가므로 일반 Remotion 씬보다 먼저 sync 가능성을 검증한다. 상세 action 명세와 긴 예시는 [`docs/playwright-conversion-rules.md`](playwright-conversion-rules.md)를 참조한다.

### Playwright 작성 시 필수 참조

- [`docs/playwright-conversion-rules.md`](playwright-conversion-rules.md) — sync 방식, 세그먼트 예산, CodePen/AI 라이브 데모 패턴
- [`docs/playwright-actions.md`](playwright-actions.md) — 각 action cmd 의 파라미터 명세
- [`docs/playwright-ai-live-demo-history.md`](playwright-ai-live-demo-history.md) — AI 라이브 데모 이력과 깨지기 쉬운 포인트

### Playwright 씬 핵심 프로토콜

1. **sync mode 결정**
   - 일반 Playwright: `wait_for` / `wait_for_claude_ready` 없음 → 순방향 sync.
   - isolated AI live demo: `wait_for` 또는 `wait_for_claude_ready` 있음 + `session.mode` 없음 → 역방향 sync.
   - shared session: `session.mode: "shared"` → 순방향 sync + shared session capture.

2. **action 분류**
   - `setup`: `goto`, 첫 `mouse_move`, 첫 `click`, 포커스 준비.
   - `pre-fill`: 이전 상태 복원용 조용한 `type`. 첫 teaching phrase 전, syncPoints 에 포함하지 않는다.
   - `teaching action`: 스크립트가 설명하는 새 `type`, `press`, `mouse_move`, `highlight`, 설명 대상인 `click`.

3. **syncPoint 배치**
   - 일반 순방향 syncPoint 는 teaching action 에만 둔다.
   - 일반 순방향 syncPoint 를 `goto`, `wait`, `wait_for`, `wait_for_claude_ready` 에 두지 않는다.
   - isolated 역방향 sync 에서 대기 완료 시점에 맞출 때만 `wait` / `wait_for` / `wait_for_claude_ready` + `target: "end"` 를 검토한다.
   - phrase 는 나레이션 안에서 유일한 부분 문자열이어야 하며, 문장 첫머리부터 포함하는 것이 원칙이다.

4. **세그먼트 예산 계산**
   - 순방향 sync 는 `wait` 만 재계산한다. `goto`, `type`, `mouse_move`, `click`, `press` 자체를 압축하지 않는다.
   - 각 syncPoint 구간은 `narration budget >= wait 제외 fixed action 시간 + 1초 여유`를 만족해야 한다.
   - 조정 대상 구간에는 최소 1개의 `wait` 가 있어야 한다.
   - `type` 은 `key.length × 0.1초`, `mouse_move` 는 0.8초, `click` 은 0.5초, `press` 는 0.1초/회로 계산한다. 전체 예산표는 Playwright 전용 문서를 따른다.

5. **불가능한 sync 처리**
   - fixed action 시간이 narration budget 보다 길면 음수 wait 가 필요하므로 자동 보정 불가다.
   - 변환 단계에서는 나레이션을 임의 수정하지 않는다. action 축소, syncPoint 세분화, pre-fill 단축, 또는 변환 불가 보고로 처리한다.

6. **shared session 제약**
   - 모든 shared session action 에서 `urlFromScene` 사용 금지.
   - 같은 session 그룹의 첫 씬은 `goto` 가능, 두 번째 이후 씬은 `goto` 금지.
   - shared session 전체에서 `render_code_block` 금지.
   - syncPoints 는 `offscreen: true` action 을 가리키면 안 된다.

7. **검증**
   - `make lint-fix LECTURE=lecture-XX.json`
   - `make lint LECTURE=lecture-XX.json STRICT=1`
   - TTS 생성 후 `make sync-playwright LECTURE=lecture-XX.json` 또는 전체 파이프라인 1.7b 단계로 최종 wait 재계산. TTS 생성 전 단독 실행은 문자수 기반 추산이므로 최종 sync 로 간주하지 않는다.

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
- ❌ AI 라이브 데모 씬에서 응답 대기 시간을 설명 없이 방치 — 스크립트에 대기 중 설명이 없으면 shared session 분할, offscreen 대기, 또는 변환 불가 보고로 처리
- ❌ AI 도구 화면의 실제 표시와 다른 나레이션 — 예: Artifact プレビューが表示されているのに「コードが表示されている」
- ❌ 프롬프트(`type.key`)에서 고정하지 않은 속성을 나레이션에서 단언 — 예: 프롬프트가 `"メニュー表、アクセス情報、お問い合わせボタンを含めてください"` 수준인데 나레이션이 "カード型で料金付き" "色も統一感があって" 처럼 구체적 레이아웃·스타일을 단언하면, Claude 출력이 달라질 때마다 나레이션과 화면이 어긋남. 구체적 묘사가 필요하면 프롬프트에 구조·스타일을 먼저 고정할 것 (AIライブデモ씬 "프롬프트 설계 원칙" 참조)
- ❌ Artifact 명시 지시 누락 — 프롬프트에 `"インラインのコードブロックではなく、アーティファクトとして作成してください"` 가 없으면 Claude 가 인라인 코드블록으로 출력할 수 있고 Artifact 패널이 열리지 않아 씬 전제가 깨짐
- ❌ 실습 화면이 이어지는 연속 씬 사이에 장식성 슬라이드(`KeyPointScreen`·`DefinitionScreen`·`CalloutScreen` 등) 삽입 — 매 씬마다 브라우저가 재로딩되어 라이브 몰입감이 깨짐. 같은 화면 맥락이 이어지면 하나의 Playwright 씬으로 통합 (상세: "연속 실습 씬 통합 원칙")
- ❌ CodePen 에디터에서 `click` 없이 `type` — CodeMirror 위젯은 hidden textarea 에 포커스가 있어야 입력 수신. `click #box-html .CodeMirror` 선행 필수
- ❌ CodePen `type.key` 안에 `\n` 사용 — CodeMirror 가 줄바꿈으로 인식 못 함. 줄바꿈은 별도 `press Enter` 액션으로 분리
- ❌ 첫 syncPoint phrase 를 setup floor 이전에 배치 — 특히 CodePen 진입 직후 0~3초 phrase 에 첫 타이핑을 맞추려 하면 `goto + mouse_move + click` 시간 때문에 구조적으로 sync 불가
- ❌ 일반 순방향 syncPoint 를 `wait`, `goto`, `wait_for`, `wait_for_claude_ready` 에 배치 — 일반 순방향 syncPoint 는 실제 teaching action 에 둔다. 역방향 싱크에서 `wait` / `wait_for` / `wait_for_claude_ready` 의 완료 시점에 맞출 때만 예외적으로 `target: "end"` 명시를 검토
- ❌ 세그먼트 고정 액션 시간보다 짧은 narration 에 긴 `type` 을 몰아넣기 — 순방향 싱크는 `wait` 만 재분배하므로 후반 무음 타이핑이 생김
- ❌ 전체 삭제·전체 재타이핑을 수행하면서 "중간에 한 줄만 추가" 같은 축소 서술 사용 — 보이는 동작과 설명이 달라짐
- ❌ pre-fill action 을 syncPoints 에 연결하거나 길게 노출 — 복원 동작은 조용히 끝내고, sync 는 새 학습 포인트부터 시작

## 作業フロー
1. 1강 단위로 스크립트를 받아 변환
2. `data/lecture-XX.json` 파일로 저장
3. Playwright 씬이 있으면 작성 후 아래를 점검
   - 첫 syncPoint 가 setup floor 이후인가
   - 일반 순방향 syncPoint 가 `wait`, `goto`, `wait_for`, `wait_for_claude_ready` 가 아니라 teaching action 을 가리키는가
   - 각 syncPoint 세그먼트에서 `type` 포함 고정 액션 시간이 narration budget 을 넘지 않는가
   - 각 조정 대상 세그먼트에 최소 1개의 `wait` 가 있는가
   - pre-fill 은 첫 teaching syncPoint 전이며 syncPoints 에 포함되지 않았는가
   - 나레이션이 실제로 보이는 조작과 정확히 일치하는가
4. JSON 저장 후 자동 수정 가능한 lint 항목을 먼저 반영한다
   ```bash
   make lint-fix LECTURE=lecture-XX.json
   ```
5. strict lint 로 남은 문제를 확인한다
   ```bash
   make lint LECTURE=lecture-XX.json STRICT=1
   ```
6. Playwright 씬은 TTS 생성 후 `make sync-playwright LECTURE=lecture-XX.json` 또는 전체 파이프라인 1.7b 단계로 wait 재계산
7. Playwright 씬은 webm 또는 최종 렌더에서 시작부 공백, 후반 무음 타이핑, 잘못된 서술이 없는지 육안 확인
8. 설명 씬의 정보 밀도 표본을 확인한다. 절차와 산출물은 위 "Slide information density policy"를 따른다
9. 신규 또는 재변환 표본은 before/after still과 reference 비교 대상을 영속 경로에 남긴다
10. lint/sync/육안 확인 결과를 JSON에 반영 후 확정 → 다음 강의

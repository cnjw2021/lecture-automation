# 講義スクリプト → Remotion JSON 変換ルール

## 役割
확정된 강의 스크립트(마크다운)를 Remotion 동영상 생성 앱의 입력 JSON으로 변환한다. 스크립트 내용은 수정하지 않는다.

## AI 변환 필수 프로토콜

JSON 변환 에이전트는 상세 규칙을 읽기 전에 반드시 아래 순서로 작업한다. 이 섹션은 실행 순서이며, 아래 본문은 판단 근거와 예시다.

1. **스크립트 보존**
   - 나레이션은 확정 스크립트를 그대로 사용한다. 요약·의역·추가 설명·삭제를 하지 않는다.
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
   - JSON 저장 후 `make lint LECTURE=lecture-XX.json STRICT=1` 를 실행한다.
   - Playwright 씬이 있으면 `make sync-playwright LECTURE=lecture-XX.json` 로 wait 를 재계산한다.
   - 최종 webm 또는 렌더에서 시작부 공백, 후반 무음 타이핑, 화면과 다른 서술이 없는지 확인한다.

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
| 기본 | 1초 ≒ 5.5자(일본어). `ceil(文字数 / 5.5)` 로 산출. 例: 110자 → 20초 | |
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

JSON 저장 후 반드시 lint 실행. 검출된 오독 패턴은 `--fix` 로 자동 치환된다.

```bash
cd packages/automation && npx tsx src/presentation/cli/lint-lecture.ts lecture-XX.json --fix
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

### Playwright 씬 필수 작성 순서

Playwright 씬을 만들 때는 아래 순서대로 작성한다. 이 순서를 지키면 구조적으로 sync 불가능한 JSON을 대부분 사전에 피할 수 있다.

1. **동작을 3종으로 분류**
   - `setup`: `goto`, 첫 커서 이동, 에디터 포커스 등 화면 준비 동작
   - `pre-fill`: 이전 상태 복원용 조용한 `type`. 첫 teaching phrase 전에 빠르게 실행되는 복원 동작이며, 실제로는 녹화 타임라인 안에 있다
   - `teaching action`: 나레이션이 설명하는 새 `type`, `press`, `mouse_move`, `highlight`

2. **일반 순방향 syncPoint 는 teaching action 에만 둔다**
   - 일반 Playwright / CodePen 씬에서는 `wait`, `goto`, `wait_for`, `wait_for_claude_ready` 에 syncPoint 를 두지 않는다.
   - isolated 역방향 싱크에서 `wait` / `wait_for` 완료 시점에 맞출 때만 예외적으로 `target: "end"` 를 명시한다.
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
   - 전체 삭제·재타이핑을 보이면 그렇게 말한다.
   - "중간에 Enter 한 번"이라고 말하려면 실제 화면에서도 그 동작만 보여야 한다.

6. **저장 후 lint 와 sync 를 실행한다**
   - `make lint LECTURE=lecture-XX.json STRICT=1`
   - `make sync-playwright LECTURE=lecture-XX.json`

### 연속 실습 씬 통합 원칙 (라이브 몰입감)

수강생이 같은 실습 화면(CodePen·VS Code·브라우저) 을 계속 보며 작업하는 구간은 **하나의 Playwright 씬으로 통합**한다. 씬을 잘게 쪼개면 매 씬마다 새 브라우저 컨텍스트가 열려 페이지가 재로딩되고, 라이브 강의 몰입감이 깨진다.

**통합 vs 분할 판정**

| 상황 | 판정 | 이유 |
|---|---|---|
| "Hello World 입력 → 지우기 → h1 태그로 감싸기" | **통합** (1개 씬) | 같은 CodePen 에디터, 연속된 타이핑 흐름 |
| "h1 추가 → p 태그 추가 → 전체 코드 리뷰" | **통합** (1개 씬) | 같은 에디터, 코드가 누적되는 흐름 |
| CodePen 실습 → 슬라이드로 개념 설명 → CodePen 실습 | **분할 + 슬라이드 제거 검토** | 슬라이드 삽입 시 실습 화면이 중단됨. 개념 설명을 Playwright 씬 나레이션에 흡수 가능한지 먼저 검토 |
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

아래 값은 `SyncPlaywrightUseCase` 와 `F-playwright-timing` lint가 사용하는 예산 기준과 맞춘다. Playwright 씬 작성 시에도 같은 값으로 계산한다.

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
- 첫 phrase 가 0~3초에 나오면 구조적으로 맞지 않는다. 도입 나레이션을 "CodePen を開いて準備します" 계열로 확보하고, 실제 타이핑/조작 phrase 를 뒤쪽으로 민다.
- syncPoint 의 `actionIndex` 는 `wait`, `goto`, `wait_for`, `wait_for_claude_ready` 가 아니라 실제 teaching action 에 둔다. 예: `type`, `press`, `mouse_move`, `highlight`, 설명 대상인 `click`.

예:
- ❌ `"こんにちは。見出しを入力します"` 직후 `actionIndex: 5` (`wait`) 배치
- ❌ `goto + mouse_move + click` 이전인 0~3초 phrase 에 첫 `type` 을 맞추려 함
- ✅ `"では、CodePen を開いて準備します。左上のHTML入力欄をクリックしたら、見出しを入力します"` 처럼 setup 설명 후 첫 teaching action phrase 를 둠

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
- pre-fill 구간도 sync-playwright 가 wait 를 재계산한다. 빠르게 보이게 하려면 도입 narration 을 길게 늘리는 대신 pre-fill 문자열을 짧게 유지하고, 첫 teaching phrase 를 setup/pre-fill 이후로 늦춘다

**action 분류 — setup / pre-fill / teaching**

일반 Playwright 씬의 action 은 아래 3종으로 나눠 설계한다.

1. `setup`
   - 예: `goto`, 첫 `mouse_move`, 첫 `click`
   - 목적: 화면과 포커스 준비
   - 규칙: 첫 syncPoint 보다 앞에 둔다. 나레이션은 "準備します", "入力欄をクリックします" 수준의 도입 설명만 허용

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
| `<` `>` (山括弧) | 반드시 **半角**. 나레이션에서도 "半角の山括弧" 로 명시해 수강생의 入力モード 전환을 유도 |
| 일본어 문자열 (예: `はじめてのWebページです！`) | `type.key` 에 그대로 사용 가능 — Playwright 가 IME 없이 직접 입력 |
| Enter 줄바꿈 | `press Enter` 액션으로 분리. `type.key` 안에 `\n` 사용 금지 (CodeMirror 에서 인식 안 됨) |

**나레이션 작성 포인트**
- "左上の「HTML」と書かれた入力エリアをクリック" 처럼 **화면 위치를 좌상/좌하/우측 등 방향으로 명시** (수강생이 실제 CodePen 화면을 볼 때 대응 가능)
- 타이핑 구간은 "「H」「e」「l」「l」「o」" 처럼 한 글자씩 나열해 TTS 속도와 실제 타이핑 속도를 맞춤
- 프리뷰 확인 시 "下のプレビューエリアを見てみてください" 로 시선 유도와 `mouse_move [960, 800]` 동기화

**서술-동작 정합 규칙 (필수)**

- 나레이션은 화면에 실제로 보이는 조작만 서술한다.
- `Meta+a` → `Backspace` → 전체 재타이핑이 보이면, 나레이션도 "いったん全部消して書き直します" 계열이어야 한다.
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
- phrase는 비디오에서 특정 action이 완료된 **후** 재생되어야 할 나레이션 구절
- 대표적 패턴: AI 응답 완료 후 "出てきましたね" 같은 결과 확인 나레이션
- syncPoint 에 `target: "start" | "end"` 를 지정할 수 있다. 미지정 시 `wait` / `wait_for` 는 `end`, 그 외 action 은 `start` 기준이다
- `wait_for_claude_ready` 완료 시점에 맞추려면 `target: "end"` 를 명시한다. 미지정 시 시작 시점 기준으로 처리된다

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
4. JSON 저장 후 lint 실행. Playwright 타이밍 문제는 `F-playwright-timing` 이 검출한다
   ```bash
   make lint LECTURE=lecture-XX.json STRICT=1
   ```
5. `make sync-playwright LECTURE=lecture-XX.json` 또는 전체 파이프라인 1.7b 단계로 wait 재계산
6. Playwright 씬은 webm 또는 최종 렌더에서 시작부 공백, 후반 무음 타이핑, 잘못된 서술이 없는지 육안 확인
7. 수정 반영 후 확정 → 다음 강의

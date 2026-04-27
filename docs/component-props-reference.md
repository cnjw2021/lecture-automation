# コンポーネントPropsリファレンス（31種）

Remotion 동영상 생성에 사용하는 각 컴포넌트의 props 명세서입니다.
컴포넌트 선택 기준은 `docs/json-conversion-rules.md` 참조.
도메인 시각 패턴 후보 명세와 활성/비활성 판단은 `docs/remotion-domain-visual-patterns.md` 참조.

주의: 이 문서의 본문에 있는 31종만 현재 lecture JSON에서 사용할 수 있습니다. `CodeRenderMappingScreen`, `StructureToRenderScreen`, `FlexLayoutDiagramScreen`, `SelectorMatchScreen`은 후보 명세이며 아직 사용 가능한 component 값이 아닙니다.

---

## 기본/전환

### TitleScreen
- `title`: 講義タイトルまたはセクションタイトル（20字以内）
- `sub`: 補助説明。なければ省略

### SectionBreakScreen
- `section`: パートラベル。短く（例: "PART 2"）
- `title`: パートタイトル（20字以内）
- `subtitle`: パート説明。なければ省略
- 배경에 큰 장식 텍스트가 들어가므로 section은 반드시 짧게

### EndScreen
- `title`: 締め挨拶（デフォルト "お疲れ様でした"）
- `message`: 締めメッセージ。なければ省略
- `nextPreview`: 次の講義タイトル。まとめの"次回予告"から取得。なければ省略
- `credits`: クレジット配列。なければ省略

---

## 텍스트/설명

### KeyPointScreen
- `icon`: 絵文字1個
- `headline`: 核心コンセプト（15字以内）
- `detail`: 補足説明（40字以内）。なければ省略
- `color`: PARTデフォルト色を使用

### QuoteScreen
- `quote`: 引用文（2〜3行以内）
- `attribution`: 出典/話者。なければ省略

### DefinitionScreen
- `term`: 定義する用語（10字以内）。大きな文字で表示
- `reading`: 読み/ふりがな（例: term "HTML" → reading "エイチティーエムエル"）。なければ省略
- `definition`: 用語説明（1〜2文）
- `example`: 使用例。なければ省略

### QnAScreen
- `question`: 質問（1文）
- `answer`: 回答（1〜3文）

### BulletDetailScreen
- `title`: セクションタイトル。なければ省略
- `items`: 2〜4個。各 `title`(15字), `detail`(40字), `icon`(絵文字), `color`(選択)

### TwoColumnScreen
- `title`: 全体タイトル。なければ省略
- `left`/`right`: 各 `title`, `body`(自由テキスト), `icon`(選択), `color`(選択)

---

## 리스트

### SummaryScreen
- `title`: 要約タイトル（選択）
- `points`: 3〜5個。各1行（30字以内）

### NumberedListScreen
- `title`: セクションタイトル。なければ省略
- `items`: 3〜6個。各 `title`(20字), `description`(選択, 40字)

### IconListScreen
- `title`: セクションタイトル。なければ省略
- `items`: 3〜6個。各 `icon`(絵文字), `title`(20字), `description`(選択), `color`(選択)

### AgendaScreen
- `title`: タイトル（例: "本日のアジェンダ"）
- `items`: 3〜5個。各 `title`, `description`(選択), `icon`(選択), `duration`(選択, 例: "15分")
- `activeIndex`: 現在進行中の項目（0始まり）。なければ全体表示

### ProgressScreen
- `title`: タイトル。なければ省略
- `steps`: 4〜6個。各短いラベル（15字以内）
- `currentStep`: **1始まり**（steps[0]をアクティブにするには `currentStep: 1`）
- currentStep은 해당 씬의 나레이션이 설명하는 단계 번호와 반드시 일치시킬 것
- steps 수 = 분할 씬 수. 1씬 = 1단계. 단계 건너뛰기·묶기 금지

---

## 비교/관계

### ComparisonScreen
- `left`/`right`: 各 `title`, `points`(2〜4個), `color`
- `vsLabel`: デフォルト "VS"

### BeforeAfterScreen
- `title`: 全体タイトル。なければ省略
- `before`: `label`(例: "従来"), `points`(2〜4個), `color`(デフォルト赤)
- `after`: `label`(例: "AI活用後"), `points`(2〜4個), `color`(デフォルト緑)

### VennDiagramScreen
- `title`: 全体タイトル。なければ省略
- `left`/`right`: 各 `label`(15字), `color`(選択)
- `intersection`: 共通ラベル（15字）

---

## 데이터 시각화

### StatScreen
- `value`: 表示する数値（文字列）。数値ならカウントアップアニメーション
- `label`: 数値説明（20字以内）
- `prefix`/`suffix`: 接頭辞/接尾辞（例: suffix "%" → "80%"）
- `description`: 追加説明。なければ省略

### BarChartScreen
- `title`: チャートタイトル。なければ省略
- `bars`: 3〜6個。各 `label`(10字), `value`(数値), `color`(選択)
- `unit`: 単位（例: "%", "h"）。なければ省略

### PieChartScreen
- `title`: チャートタイトル。なければ省略
- `slices`: 3〜6個。各 `label`(15字), `value`(数値), `color`(選択)

---

## 구조/도식

### DiagramScreen
- `title`: タイトル。なければ省略
- `nodes`: 3〜6個。各 `id`, `label`, `x`, `y`, `icon`(絵文字), `color`(選択)
- `edges`: 矢印。`from`/`to`(node id), `label`(10字以内)
- 좌표: 캔버스 1680x840 기준. 노드 간 최소 300px 간격
- 배치 패턴: 수평(y 동일, x+300) / 수직(x 동일, y+200)

### TimelineScreen
- `title`: タイトル。なければ省略
- `events`: 3〜5個。各 `label`(20字), `description`(選択), `icon`(選択), `color`(選択)

### FeatureGridScreen
- `title`: タイトル。なければ省略
- `features`: 4〜6個。各 `icon`(絵文字), `title`(15字), `description`(選択, 30字), `color`(選択)
- `columns`: 2または3（デフォルト2）

### HierarchyScreen
- `title`: タイトル。なければ省略
- `root`: ツリー構造。`label`, `icon`(選択), `children`(再帰配列)
- children 2〜4個、深さ2段階まで推奨

### BoxModelDiagramScreen
- `title`: タイトル。なければ省略
- `subtitle`: ボックス図の学習焦点。なければ省略
- `layers`: 4層配列。各 `key` は `"margin"` | `"border"` | `"padding"` | `"content"`、任意で `label`, `value`, `description`, `color`
- `highlightLayer`: 強調する層。`layers.key` と同じ4種
- `contentLabel` / `contentDetail`: 中央コンテント領域に表示する短い説明
- `callouts`: 右側説明。3〜4個推奨。各 `title`, `detail`, `color`
- `formula`: 横幅計算を表示する場合の項。各 `label`, `value`, `color`
- `totalLabel`: formula の結果（例: `"344px"`）
- 용도: CSS box model처럼 포함 관계·색상·계산을 한 화면에 남겨야 하는 씬. 단순 용어 나열이면 `BulletDetailScreen`, 일반 관계도면 `DiagramScreen` 사용
- #127 결정: 현재는 CSS 박스 모델 전용 컴포넌트로 유지한다. content/padding/border/margin 외의 일반 중첩 개념에 재사용하지 않는다.

---

## 강조

### CalloutScreen
- `type`: `"tip"` | `"warning"` | `"info"` | `"error"`（デフォルト `"tip"`）
- `title`: コールアウトタイトル（20字）
- `body`: 本文（1〜3文）
- `icon`: カスタム絵文字。なければtype別デフォルト

### ImagePlaceholderScreen
- `title`: タイトル
- `description`: 説明。なければ省略
- `icon`: 画像領域の絵文字（デフォルト 🖼）
- `label`: 画像領域ラベル（例: "スクリーンショット"）
- `layout`: `"left"` | `"right"`（デフォルト `"left"`）
- ⚠️ **실제 이미지 파일이 제공된 경우에만 사용.** 이미지 없이 플레이스홀더 목적으로 사용 시 title 텍스트만 표시됨. 브라우저 UI를 보여주고 싶다면 `BrowserMockScreen` 사용

---

## 브라우저 UI

### BrowserMockScreen
- `url`: 表示するURL（必須）。BrowserChromeが自動レンダリング。実際の画像ファイル不要
- `title`: 左側テキストエリアのタイトル。なければ省略
- `description`: 左側テキストエリアの説明。なければ省略
- `layout`: `"left"` | `"right"` | `"full"`（デフォルト `"right"`）
- `color`: アクセントカラー。PARTデフォルト色を使用
- 용도: 브라우저 화면 설명 (주소창, HTTPS 자물쇠 아이콘 등)

### ImageScreen
- `src`: 画像ファイルパス（必須）。staticFile経由またはhttps://から始まる外部URL
- `url`: 指定するとBrowserChromeでラップしてブラウザ風表示
- `title`: 左側テキストエリアのタイトル。なければ省略
- `description`: 左側テキストエリアの説明。なければ省略
- `layout`: `"left"` | `"right"` | `"full"`（デフォルト `"right"`）
- `color`: アクセントカラー。PARTデフォルト色を使用
- 용도: 실제 캡처 이미지를 표시할 경우. url도 지정하면 브라우저 풍 프레임이 붙음

---

## 코드

### MyCodeScene
- `code`: コードブロックをそのまま。`\n`で改行
- `language`: 言語タグ（html, css, javascript等）
- `title`: コードの目的（例: "初めてのHTML"）

### CodeWalkthroughScreen
- `title`: コード説明タイトル。なければ省略
- `code`: コード文字列（`\n`で改行）
- `highlightLines`: 強調行番号の配列（例: [2, 3, 4]）。なければ全体均一
- `caption`: コード下部の説明。なければ省略
- MyCodeSceneとの使い分け: 初登場=MyCodeScene / 行別説明=CodeWalkthroughScreen
- 제한: 코드 행과 렌더링 결과를 한 화면에서 연결해야 하는 씬에는 충분하지 않다. 해당 패턴은 #127 후보 `CodeRenderMappingScreen`으로 추적하며, 구현 전에는 JSON에 후보명을 쓰지 않는다.

---

## 도메인 패턴 후보（현재 JSON 사용 금지）

아래 명세는 #127 후보 압축 결과다. 아직 Remotion 컴포넌트, export, schema registry가 없으므로 lecture JSON의 `visual.component` 값으로 사용하지 않는다.

### CodeRenderMappingScreen（후보）
- 책임: 코드와 렌더링 결과를 동시에 보여주고, 코드 line range를 결과 영역에 연결
- 후보 props: `title`, `language`, `code`, `highlightLines`, `result`, `mappings`, `caption`
- `result`: `{ url?, html?, imageSrc? }`
- `mappings`: 각 `{ lineRange: [start, end], target, label, color? }`
- 선택 근거: `CodeWalkthroughScreen`은 코드만, `BrowserMockScreen`은 결과만 보여주므로 line-to-result 대응을 보존할 수 없음

### StructureToRenderScreen（후보）
- 책임: HTML/문서 트리와 렌더링 결과를 좌우로 보여주고 같은 id를 하이라이트
- 후보 props: `title`, `tree`, `rendered`, `activeId`, `caption`
- `tree`: `HierarchyScreen.root`와 유사하지만 각 node에 선택적 `id` 허용
- `rendered.regions`: 각 `{ id, label, description?, bounds? }`
- 선택 근거: `HierarchyScreen`과 `BrowserMockScreen`을 분리하면 구조와 결과의 대응이 사라짐

### FlexLayoutDiagramScreen（후보）
- 책임: flex container, items, main/cross axis, 정렬/분포 상태를 표시
- 후보 props: `title`, `containerLabel`, `direction`, `mainAxisLabel`, `crossAxisLabel`, `items`, `properties`, `mode`
- `direction`: `"row"` | `"row-reverse"` | `"column"` | `"column-reverse"`
- `mode`: `"single"` | `"beforeAfter"` | `"wrap"`
- 선택 근거: `DiagramScreen` 좌표로는 axis 전환, gap, wrap, justify/align 차이를 안정적으로 표현하기 어려움

### SelectorMatchScreen（후보）
- 책임: selector token, DOM tree, matched/unmatched node 상태를 한 화면에 표시
- 후보 props: `title`, `selector`, `tokens`, `dom`, `activeNodeIds`, `explanation`
- `tokens`: 각 `{ text, role, color? }`
- `dom`: tree node에 `{ id?, label, matched?, children? }`
- 선택 근거: selector 종류 나열은 `BulletDetailScreen`으로 충분하지만, descendant/combinator matching은 DOM 연결이 필요함

---

## 브라우저 녹화

### Playwright
- `type`: `"playwright"`（componentフィールドなし）
- `action`: 순차 커맨드 배열
  - `goto`(url), `wait`(ms), `click`(selector), `type`(selector, key)
  - `highlight`(selector, note), `mouse_drag`(from, to), `press`(key), `focus`(selector)
- wait의 ms: 통상 2000〜3000
- 상세 액션 명세: `docs/playwright-actions.md` 참조

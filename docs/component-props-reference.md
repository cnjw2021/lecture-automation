# コンポーネントPropsリファレンス（30種）

Remotion 동영상 생성에 사용하는 각 컴포넌트의 props 명세서입니다.
컴포넌트 선택 기준은 `docs/json-conversion-rules.md` 참조.

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

---

## 브라우저 녹화

### Playwright
- `type`: `"playwright"`（componentフィールドなし）
- `action`: 순차 커맨드 배열
  - `goto`(url), `wait`(ms), `click`(selector), `type`(selector, key)
  - `highlight`(selector, note), `mouse_drag`(from, to), `press`(key), `focus`(selector)
- wait의 ms: 통상 2000〜3000
- 상세 액션 명세: `docs/playwright-actions.md` 참조

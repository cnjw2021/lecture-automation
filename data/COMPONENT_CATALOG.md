# Remotion Component Catalog

AI가 강의 대본(JSON)을 생성할 때, 각 씬의 `visual.component`에 아래 컴포넌트 중 하나를 지정합니다.
도메인 특화 후보(`CodeRenderMappingScreen`, `StructureToRenderScreen`, `FlexLayoutDiagramScreen`, `SelectorMatchScreen`)는 `docs/remotion-domain-visual-patterns.md`에 명세만 있으며 아직 이 카탈로그의 활성 컴포넌트가 아닙니다.

---

## TitleScreen
**용도**: 강의 도입부, 섹션 시작 화면
**애니메이션**: 배경 fade-in → 타이틀 spring slide-up → 서브타이틀 fade-in

```json
{
  "type": "remotion",
  "component": "TitleScreen",
  "props": {
    "title": "메인 제목 텍스트",
    "sub": "서브타이틀 (선택)"
  }
}
```

---

## SummaryScreen
**용도**: 강의 마무리, 핵심 포인트 정리
**애니메이션**: 타이틀 slide-left → 각 포인트 stagger fade-in (번호 배지 포함)

```json
{
  "type": "remotion",
  "component": "SummaryScreen",
  "props": {
    "title": "요약 제목 (선택, 기본: 'Summary')",
    "points": [
      "핵심 포인트 1",
      "핵심 포인트 2",
      "핵심 포인트 3"
    ]
  }
}
```

---

## KeyPointScreen
**용도**: 하나의 핵심 개념을 크게 강조할 때
**애니메이션**: 아이콘 bounce scale-in → 헤드라인 slide-up → 설명 fade-in

```json
{
  "type": "remotion",
  "component": "KeyPointScreen",
  "props": {
    "icon": "🌐",
    "headline": "강조할 핵심 개념",
    "detail": "부가 설명 텍스트 (선택)",
    "color": "#6366f1"
  }
}
```

---

## ComparisonScreen
**용도**: 두 개념을 나란히 비교 (A vs B)
**애니메이션**: 좌측 slide-left → 우측 slide-right → VS 라벨 pop-in → 포인트 stagger

```json
{
  "type": "remotion",
  "component": "ComparisonScreen",
  "props": {
    "left": {
      "title": "개념 A",
      "points": ["특징 1", "특징 2"],
      "color": "#6366f1"
    },
    "right": {
      "title": "개념 B",
      "points": ["특징 1", "특징 2"],
      "color": "#f59e0b"
    },
    "vsLabel": "VS"
  }
}
```

---

## DiagramScreen
**용도**: 흐름도, 관계도 (노드 + 화살표)
**애니메이션**: 노드 순차 scale-in → 연결 화살표 draw-in

```json
{
  "type": "remotion",
  "component": "DiagramScreen",
  "props": {
    "title": "다이어그램 제목 (선택)",
    "nodes": [
      { "id": "a", "label": "브라우저", "x": 200, "y": 300, "icon": "🌐" },
      { "id": "b", "label": "서버", "x": 800, "y": 300, "icon": "🖥️" },
      { "id": "c", "label": "응답", "x": 1400, "y": 300, "icon": "📄" }
    ],
    "edges": [
      { "from": "a", "to": "b", "label": "요청" },
      { "from": "b", "to": "c", "label": "응답" }
    ]
  }
}
```

**좌표**: 캔버스 영역 기준 (약 1680x840). 노드 크기 140x80으로 중심점 지정.

---

## BoxModelDiagramScreen
**용도**: CSS box model처럼 공간적 포함 관계, 색상 구분, 크기 계산을 한 화면에 같이 남겨야 할 때
**애니메이션**: 4개 레이어 순차 등장 → 설명 콜아웃 stagger → 계산식 표시

```json
{
  "type": "remotion",
  "component": "BoxModelDiagramScreen",
  "props": {
    "title": "width: 300px の箱は実際に 344px",
    "subtitle": "content-box では padding と border が外側に足される",
    "highlightLayer": "content",
    "contentLabel": "width: 300px",
    "contentDetail": "指定した幅はコンテントだけ",
    "layers": [
      { "key": "margin", "label": "マージン", "value": "外側", "color": "#ef4444" },
      { "key": "border", "label": "ボーダー", "value": "2px", "color": "#f59e0b" },
      { "key": "padding", "label": "パディング", "value": "20px", "color": "#10b981" },
      { "key": "content", "label": "コンテント", "value": "300px", "color": "#3b82f6" }
    ],
    "formula": [
      { "label": "content", "value": "300", "color": "#3b82f6" },
      { "label": "padding L/R", "value": "40", "color": "#10b981" },
      { "label": "border L/R", "value": "4", "color": "#f59e0b" }
    ],
    "totalLabel": "344px"
  }
}
```

**선택 기준**: 단순한 용어 나열이면 `BulletDetailScreen`, 일반 흐름/관계면 `DiagramScreen`, 박스 모델의 중첩 구조나 width 계산을 화면에 남겨야 하면 `BoxModelDiagramScreen`.
**#127 결정**: CSS 박스 모델 전용으로 유지. content/padding/border/margin 외의 일반 중첩 개념에는 사용하지 않습니다.

---

## ProgressScreen
**용도**: 강의 진행 단계 표시 (현재 위치 강조)
**애니메이션**: 각 단계 stagger slide-in, 현재 단계 하이라이트 + 미세 pulse

```json
{
  "type": "remotion",
  "component": "ProgressScreen",
  "props": {
    "title": "강의 로드맵 (선택)",
    "steps": [
      "인터넷의 구조",
      "웹의 탄생",
      "브라우저의 역할",
      "실습: 첫 페이지 만들기"
    ],
    "currentStep": 2
  }
}
```

---

## QuoteScreen
**용도**: 정의, 명언, 핵심 인용문
**애니메이션**: 큰 따옴표 scale-in → 인용문 slide-up → 출처 fade-in

```json
{
  "type": "remotion",
  "component": "QuoteScreen",
  "props": {
    "quote": "인용할 텍스트",
    "attribution": "출처 또는 저자 (선택)"
  }
}
```

---

## MyCodeScene
**용도**: 코드 타이핑 애니메이션
**애니메이션**: 타자기 효과로 코드가 한 글자씩 나타남 (2초간)

```json
{
  "type": "remotion",
  "component": "MyCodeScene",
  "props": {
    "title": "코드 제목 (선택)",
    "code": "<!DOCTYPE html>\n<html>\n  <body>\n    <h1>Hello</h1>\n  </body>\n</html>",
    "language": "html"
  }
}
```

**language**: `html`, `css`, `javascript`, `typescript`, `python`, `json` 등

---

## Playwright (브라우저 녹화)
**용도**: 실제 웹사이트 탐색을 동영상으로 녹화
**type**: `"playwright"` (component 필드 없음)

```json
{
  "type": "playwright",
  "action": [
    { "cmd": "goto", "url": "https://example.com" },
    { "cmd": "wait", "ms": 3000 },
    { "cmd": "click", "selector": "#button" },
    { "cmd": "type", "selector": "input", "key": "Hello" },
    { "cmd": "highlight", "selector": ".target", "note": "주목할 요소" },
    { "cmd": "mouse_drag", "from": [600, 400], "to": [300, 300] },
    { "cmd": "press", "key": "Enter" },
    { "cmd": "focus", "selector": "#element" }
  ]
}
```

---

## 씬 전환 (Transition)

모든 visual에 선택적으로 `transition` 필드를 추가할 수 있습니다.
지정하지 않으면 기본값 `fade`가 적용됩니다.

```json
{
  "transition": {
    "enter": "fade | slide-left | slide-up | zoom | none",
    "exit": "fade | slide-right | slide-down | zoom | none"
  }
}
```

**권장**: 대부분의 씬에 `"fade"` 사용. 중요한 전환점에서 `"slide-up"` 또는 `"zoom"` 사용.

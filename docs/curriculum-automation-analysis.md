# 커리큘럼 자동화 분석 및 베스트프랙티스

## 커리큘럼 분석 결과

### 핵심 발견: "라이브 코딩 80%"의 실체

커리큘럼에서 "ライブ 80%"라고 표기된 부분의 실제 내용을 보면:

| 실제 작업 | 비중 | 자동화 가능 여부 |
|-----------|------|-----------------|
| 브라우저에서 사이트 방문·조작 | ~15% | Playwright |
| AI(Claude/ChatGPT)에 프롬프트 → 코드 생성 | ~20% | Playwright |
| 에디터에서 코드 입력·수정 | ~30% | 에디터에 따라 다름 |
| 에디터 결과를 브라우저에서 확인 | ~10% | Playwright |
| VS Code 설치·설정 | ~5% | 데스크톱 앱 |

**즉, "에디터"를 웹 기반으로 바꾸면 라이브 구간의 95%가 자동화 가능하다.**

---

### 강의별 자동화 맵 (확정)

```
✅ = Playwright + Remotion 완전 자동화
```

**PART 1 (2.5h) — AI시대의 Web**
```
01  オリエンテーション          ✅ PPT (Remotion 슬라이드)
02  Webの仕組み               ✅ PPT (Remotion 슬라이드)
03  HTML/CSS/JS 3요소         ✅ PPT + Playwright (Yahoo/Google/Apple 방문, DevTools)
04  AIが変えたWeb制作          ✅ PPT + Playwright (Claude 라이브 데모)
05  CodePen入門               ✅ Playwright (CodePen 계정 생성 + 조작)
06  Hello World               ✅ Playwright (CodePen에서 코딩)
07  HTML基本構造              ✅ Playwright (CodePen 활용)
```

**PART 2 (3h) — HTML**
```
08  タグの約束                 ✅ Playwright (CodePen)
09  テキストタグ               ✅ Playwright (CodePen)
10  リンクと画像               ✅ Playwright (CodePen + 외부 URL 이미지)
11  構造タグ                   ✅ Playwright (CodePen)
12  フォーム                   ✅ Playwright (CodePen)
13  テーブル                   ✅ Playwright (CodePen)
14  AIにHTMLを任せる           ✅ Playwright (Claude/ChatGPT → CodePen)
15  まとめ                     ✅ PPT (Remotion 슬라이드)
```

**PART 3 (3h45m) — CSS**
```
16  CSSの仕組み               ✅ Playwright (CodePen CSS패인)
17  セレクタ                   ✅ Playwright (CodePen)
18  色とタイポグラフィ          ✅ Playwright (CodePen + Google Fonts)
19  ボックスモデル              ✅ Playwright (CodePen + DevTools)
20  Flexbox(前편)             ✅ Playwright (CodePen)
21  Flexbox(後편)             ✅ Playwright (CodePen)
22  レスポンシブ               ✅ Playwright (CodePen + DevTools 반응형)
23  CSSレシピ集               ✅ Playwright (CodePen)
24  AIにCSSを任せる            ✅ Playwright (Claude → CodePen)
25  まとめ                     ✅ PPT (Remotion 슬라이드)
```

**PART 4 (5h40m) — 실전 프로젝트**
```
26  AIツールガイド(前편)        ✅ PPT + Playwright (Claude/ChatGPT 데모)
27  AIツールガイド(後편)        ✅ PPT + Playwright (StackBlitz 입문)
28  ポートフォリオ(前편)        ✅ Playwright (Claude → StackBlitz)
29  ポートフォリオ(中편)        ✅ Playwright (StackBlitz 코드 분석)
30  ポートフォリオ(後편)        ✅ Playwright (StackBlitz 커스터마이즈)
31  カフェサイト(前편)          ✅ Playwright (Claude → StackBlitz)
32  カフェサイト(中편)          ✅ Playwright (StackBlitz + Formspree, Google Maps)
33  カフェサイト(後편)          ✅ Playwright (StackBlitz)
34  LP(前편)                  ✅ Playwright (Claude → StackBlitz)
35  LP(中편)                  ✅ Playwright (StackBlitz)
36  LP(後편)                  ✅ Playwright (StackBlitz)
37  総復習                     ✅ PPT (Remotion 슬라이드)
```

**PART 5 (3h50m) — 배포·운용**
```
38  GitHub Web                ✅ Playwright (StackBlitz → GitHub 연동)
39  GitHub Pages + Netlify     ✅ Playwright (모두 브라우저)
40  Cloudflare + ドメイン      ✅ Playwright (모두 브라우저)
41  SEO + Analytics           ✅ Playwright (모두 브라우저)
42  まとめ                     ✅ PPT (Remotion 슬라이드)
```

---

## 확정된 도구 전략

### 에디터: 2단계 이행

```
PART 1~3 (강의 01~25): CodePen
  → 1파일 HTML/CSS 실습. GitHub 계정으로 로그인(PART 4 StackBlitz와 동일 계정), Playwright 완전 자동화

PART 4 (강의 26~37): StackBlitz
  → 복수 파일 프로젝트. VS Code풍 UI, GitHub 연동, Playwright 자동화 가능
  → 참고: Glitch는 2025년 7월 서비스 종료로 사용 불가

PART 5 (강의 38~42): GitHub Web + 배포 플랫폼
  → StackBlitz → GitHub 연동, GitHub Pages/Netlify/Cloudflare 배포
```

### VS Code → CodePen/StackBlitz 전환

| 변경 전 | 변경 후 | 이유 |
|---------|---------|------|
| 1-5, 1-6: VS Code 설치·설정 (40분) | CodePen 입문 (20분) + Hello World (20분) | 비전공자에게 설치 없이 코딩 시작 |
| 1-7: VS Code에서 코딩 | CodePen 활용 | 동일한 학습 효과 |
| PART 2~3: VS Code 실습 | CodePen 실습 | 브라우저 기반 → 자동화 가능 |
| PART 4: VS Code 프로젝트 | StackBlitz 프로젝트 | 복수 파일 + GitHub 연동 |
| 4-1: Cursor (15분) | VS Code/Cursor PPT 소개 (5분) | "이런 도구도 있다" 수준 |

### Git/GitHub: GitHub Web 기반

| 변경 전 | 변경 후 | 이유 |
|---------|---------|------|
| GitHub Desktop 설치 | GitHub Web + StackBlitz 연동 | 브라우저 기반 → Playwright 자동화 |
| 터미널 git 명령어 | 완전 생략 | 비전공자 대상, 불필요 |

### AI 도구 활용 흐름

```
Claude/ChatGPT에 프롬프트 → 코드 생성 → CodePen/StackBlitz에 붙여넣기 → 즉시 확인
```

**모든 단계가 브라우저 안에서 완결** → Playwright 하나로 전체 자동화

### 최종 자동화 커버리지

| 구분 | 변경 전 | 변경 후 |
|------|---------|---------|
| 완전 자동화 (Playwright + Remotion) | ~35% | **~95%** |
| 수동 녹화 필요 | ~65% | **~5%** (v0.dev 소개 등 PPT 대체 가능) |

**커리큘럼 조정으로 사실상 수동 녹화 0%가 가능하다.**

---

## 요약

| 변경 | 효과 |
|------|------|
| VS Code → CodePen/StackBlitz | 라이브 코딩 80%가 전부 Playwright 자동화 |
| GitHub Desktop → GitHub Web + StackBlitz 연동 | PART 5 배포 전 과정 자동화 |
| AI 실습을 브라우저 안에서 완결 | Claude → 에디터 복붙까지 한 화면 |

비전공자 입장에서도 **설치 없이 브라우저만으로 강좌 전체를 따라할 수 있으므로** 학습 장벽이 크게 낮아진다. 자동화 목적뿐 아니라 교육적으로도 더 나은 선택이다.

---

> **참고**: Glitch(glitch.com)는 2025년 7월 서비스 종료. 본 문서의 초기 버전에서 Glitch를 추천했으나, StackBlitz로 대체함.

*작성일: 2026-04-07 (최종 수정: 2026-04-07)*
*관련 문서: [웹 에디터 비교](web-editor-comparison.md), [커리큘럼](curriculum.md)*

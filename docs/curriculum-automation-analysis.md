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

### 강의별 자동화 맵

```
✅ = Playwright + Remotion 완전 자동화
⚠️ = 커리큘럼 조정 필요
❌ = 수동 녹화 필요 (현재 기준)
```

**PART 1 (2.5h) — AI시대의 Web**
```
01  オリエンテーション          ✅ PPT (Remotion 슬라이드)
02  Webの仕組み               ✅ PPT (Remotion 슬라이드)
03  HTML/CSS/JS 3요소         ✅ PPT + Playwright (Yahoo/Google/Apple 방문, DevTools)
04  AIが変えたWeb制作          ✅ PPT + Playwright (Claude 라이브 데모)
05  開発環境セットアップ(前편)   ⚠️ VS Code 설치 → 조정 필요
06  開発環境セットアップ(後편)   ⚠️ VS Code 설정 → 조정 필요
07  Hello World               ⚠️ VS Code에서 코딩 → 조정 필요
```

**PART 2 (3.5h) — HTML**
```
08  タグの約束                 ⚠️ 에디터 코딩 → CodePen이면 ✅
09  テキストタグ               ⚠️ 에디터 코딩 → CodePen이면 ✅
10  リンクと画像               ⚠️ 에디터 코딩 → CodePen이면 ✅
11  構造タグ                   ⚠️ 에디터 코딩 → CodePen이면 ✅
12  フォーム                   ⚠️ 에디터 코딩 → CodePen이면 ✅
13  テーブル                   ⚠️ 에디터 코딩 → CodePen이면 ✅
14  AIにHTMLを任せる           ✅ Claude/ChatGPT + 에디터 (모두 브라우저)
15  まとめ                     ✅ PPT (Remotion 슬라이드)
```

**PART 3 (4h) — CSS**
```
16  CSSの仕組み               ⚠️ 에디터 코딩 → CodePen이면 ✅
17  セレクタ                   ⚠️ 에디터 코딩 → CodePen이면 ✅
18  色とタイポグラフィ          ⚠️ CodePen + Playwright (Google Fonts 방문) ✅
19  ボックスモデル              ⚠️ CodePen + Playwright (DevTools 확인) ✅
20  Flexbox(前편)             ⚠️ 에디터 코딩 → CodePen이면 ✅
21  Flexbox(後편)             ⚠️ 에디터 코딩 → CodePen이면 ✅
22  レスポンシブ               ⚠️ 에디터 코딩 → CodePen이면 ✅
23  CSSレシピ集               ⚠️ 에디터 코딩 → CodePen이면 ✅
24  AIにCSSを任せる            ✅ Claude + 에디터 (모두 브라우저)
25  まとめ                     ✅ PPT (Remotion 슬라이드)
```

**PART 4 (6h) — 실전 프로젝트**
```
26  AIツールガイド(前편)        ✅ PPT + Playwright (Claude/ChatGPT 데모)
27  AIツールガイド(後편)        ✅ PPT + Playwright (v0.dev, Cursor 소개)
28  ポートフォリオ(前편)        ⚠️ Claude → 에디터 → Glitch이면 ✅
29  ポートフォリオ(中편)        ⚠️ 코드 분석 → Glitch이면 ✅
30  ポートフォリオ(後편)        ⚠️ 커스터마이즈 → Glitch이면 ✅
31  カフェサイト(前편)          ⚠️ Claude → Glitch이면 ✅
32  カフェサイト(中편)          ⚠️ Glitch + Playwright (Formspree, Google Maps) ✅
33  カフェサイト(後편)          ⚠️ Glitch이면 ✅
34  LP(前편)                  ⚠️ Claude → Glitch이면 ✅
35  LP(中편)                  ⚠️ Glitch이면 ✅
36  LP(後편)                  ⚠️ Glitch이면 ✅
37  総復習                     ✅ PPT (Remotion 슬라이드)
```

**PART 5 (4h) — 배포·운용**
```
38  Git/GitHub                ⚠️ GitHub Desktop → 조정 필요
39  GitHub Pages + Netlify     ✅ Playwright (모두 브라우저)
40  Cloudflare + ドメイン      ✅ Playwright (모두 브라우저)
41  SEO + Analytics           ✅ Playwright (모두 브라우저)
42  まとめ                     ✅ PPT (Remotion 슬라이드)
```

---

## 베스트프랙티스 제안

### 1. 에디터 전략: 3단계 이행

```
PART 1~3 (강의 01~25): CodePen
  → 1파일 HTML/CSS 실습. 가입 불필요, Playwright 완전 자동화

PART 4 (강의 26~37): Glitch
  → 복수 파일 프로젝트. 파일 분리 개념 도입, Playwright 자동화 가능

PART 5 (강의 38~42): 브라우저 기반 서비스들
  → GitHub 웹, Netlify, Cloudflare 등 전부 Playwright 자동화
```

### 2. VS Code 관련 커리큘럼 조정

현재 커리큘럼에서 VS Code는 **3곳**에 등장한다:

| 현재 | 제안 | 이유 |
|------|------|------|
| 1-5, 1-6: VS Code 설치·설정 (40분) | CodePen 소개 (15분)으로 대체 | 비전공자에게 설치 없이 바로 코딩 시작이 훨씬 효과적 |
| 1-7: VS Code에서 Hello World | CodePen에서 Hello World | 동일한 학습 효과, 환경 구축 장벽 제거 |
| 4-1: Cursor 에디터 소개 (15분) | VS Code + Cursor 간단 소개 (10분) | "이런 도구도 있다" 수준. PPT 슬라이드로 충분 |

**VS Code 설치 40분 → CodePen 소개 15분**으로 바꾸면:
- 수강생: 설치 없이 3초 만에 코딩 시작
- 자동화: Playwright로 100% 커버
- 절약한 25분: 실습 시간으로 활용

### 3. Git/GitHub 조정 (PART 5)

| 현재 | 제안 | 이유 |
|------|------|------|
| GitHub Desktop 설치·사용 | GitHub 웹 인터페이스 사용 | 브라우저 기반 → Playwright 자동화 가능 |
| 터미널 git 명령어 | 완전 생략 | 비전공자 대상, 불필요 |

GitHub 웹에서도 가능한 것:
- 리포지토리 생성
- 파일 업로드 (드래그 앤 드롭)
- 커밋
- GitHub Pages 설정

**이렇게 하면 PART 5도 100% 브라우저 작업 → Playwright 자동화 가능**

### 4. AI 도구 활용 흐름 (Playwright 자동화 최적)

현재 커리큘럼의 AI 실습 흐름:
```
Claude에 프롬프트 → 코드 생성 → VS Code에 붙여넣기 → 브라우저 확인
```

제안하는 흐름:
```
Claude에 프롬프트 → 코드 생성 → CodePen/Glitch에 붙여넣기 → 즉시 확인
```

**모든 단계가 브라우저 안에서 완결** → Playwright 하나로 전체 자동화

### 5. 최종 자동화 커버리지

| 구분 | 현재 커리큘럼 | 조정 후 |
|------|-------------|---------|
| 완전 자동화 (Playwright + Remotion) | ~35% (PPT + 브라우저 데모) | **~95%** |
| 수동 녹화 필요 | ~65% (VS Code 코딩 전체) | **~5%** (Cursor/v0.dev 데모 정도) |

### 6. 수동 녹화가 남는 부분 (~5%)

조정 후에도 수동이 필요할 수 있는 부분:

- **4-1: v0.dev, Cursor 데모** → 소개만이므로 스크린샷 슬라이드로 대체 가능
- **예외 상황 대응 영상** → 에러 화면 등은 스크린샷으로 충분

**즉, 커리큘럼을 조정하면 사실상 수동 녹화 0%가 가능하다.**

---

## 요약

| 변경 | 효과 |
|------|------|
| VS Code → CodePen/Glitch | 라이브 코딩 80%가 전부 Playwright 자동화 |
| GitHub Desktop → GitHub 웹 | PART 5 배포 전 과정 자동화 |
| AI 실습을 브라우저 안에서 완결 | Claude → CodePen 복붙까지 한 화면 |

비전공자 입장에서도 **설치 없이 브라우저만으로 강좌 전체를 따라할 수 있으므로** 학습 장벽이 크게 낮아진다. 자동화 목적뿐 아니라 교육적으로도 더 나은 선택이다.

---

*작성일: 2026-04-07*
*관련 문서: [웹 에디터 비교](web-editor-comparison.md), [커리큘럼](curriculum.md)*

# 웹 기반 코드 에디터 비교 — 일본 비전공자 교육용

## 조사 목적

PART 2~5 실습 강의에서는 VS Code + 브라우저 조작이 중심이지만, Playwright는 VS Code(데스크톱 앱)를 직접 조작할 수 없다. 웹 기반 코드 에디터를 사용하면 Playwright 자동화가 가능해지므로, 각 서비스를 일본 비전공자 수강생 관점에서 비교한다.

---

## 개별 서비스 분석

### 1. CodePen
- **URL**: https://codepen.io
- **일본어 지원**: UI 영어만. 다만 극히 심플하여 장벽 낮음
- **무료 플랜**: 있음. HTML/CSS/JS 펜 작성·공유 무제한
- **회원 가입**: 펜 작성·저장에 로그인 필요(GitHub/Google 로그인 지원). 커리큘럼에서는 PART 1 초반에 GitHub 계정 생성 → CodePen 로그인 (StackBlitz도 같은 GitHub 계정 사용)
- **특징**:
  - 3패인 구성(HTML / CSS / JS)이 직관적
  - 실시간 프리뷰로 즉시 결과 확인
  - Emmet 지원으로 입력 보조
  - URL 공유만으로 수강생 간 공유 가능
- **Playwright 자동화**: ✅ 용이. 에디터 영역은 `textarea` 또는 CodeMirror 기반으로 셀렉터 지정 가능
- **교육 적합성**: ★★★★★ — HTML/CSS 입문에 최적. GitHub 계정으로 로그인 (StackBlitz 계정과 통일)

### 2. JSFiddle
- **URL**: https://jsfiddle.net
- **일본어 지원**: UI 영어만
- **무료 플랜**: 있음. 기본 기능 무제한
- **회원 가입**: 불필요(익명 피들 생성 가능)
- **특징**:
  - CodePen과 동일한 3패인 구성
  - 협업 기능 있음
  - UI가 다소 오래된 인상
- **Playwright 자동화**: ✅ 가능. CodeMirror 기반
- **교육 적합성**: ★★★☆☆ — 기능은 충분하나 UI 세련도에서 CodePen에 뒤짐

### 3. StackBlitz
- **URL**: https://stackblitz.com
- **일본어 지원**: UI 영어만
- **무료 플랜**: 있음. 퍼블릭 프로젝트 무제한
- **회원 가입**: 필요(GitHub 로그인)
- **특징**:
  - WebContainers 기술로 브라우저 내 Node.js 환경 구축
  - VS Code 기반 본격 에디터(Monaco Editor)
  - 파일 트리, 터미널, 패키지 관리 가능
  - 정적 HTML/CSS뿐 아니라 React/Vue 등 프레임워크도 대응
- **Playwright 자동화**: ⚠️ 다소 복잡. Monaco Editor는 일반 textarea와 달리 특수 셀렉터 필요
- **교육 적합성**: ★★★★☆ — VS Code에 가까운 조작감으로 이행이 매끄러움. 다만 초보자에게는 기능 과다

### 4. CodeSandbox
- **URL**: https://codesandbox.io
- **일본어 지원**: UI 영어만
- **무료 플랜**: 있음(제한 있음). 무료 한도: 월 400 VM 크레딧, 스토리지 20GB
- **회원 가입**: 필요(GitHub/Google 로그인)
- **특징**:
  - 클라우드 VM 기반 개발 환경
  - VS Code 기반 에디터
  - 템플릿에서 즉시 프로젝트 생성
  - 2023년 아키텍처 쇄신(Pitcher → 클라우드 VM)
- **Playwright 자동화**: ⚠️ 다소 복잡. StackBlitz와 동일하게 Monaco Editor 기반. VM 기동 대기도 고려 필요
- **교육 적합성**: ★★★☆☆ — 무료 한도 제한이 교육 용도에서 불안. VM 크레딧 소진 리스크

### 5. Replit
- **URL**: https://replit.com
- **일본어 지원**: UI 영어만
- **무료 플랜**: 있음(대폭 제한). 2024년 이후 무료 플랜 축소 추세
- **회원 가입**: 필요
- **특징**:
  - 다언어 대응(Python, Node.js, HTML/CSS 등)
  - AI 코드 보조(Ghostwriter) 내장
  - 협업 기능 강력
- **Playwright 자동화**: ⚠️ 복잡. 독자 에디터 UI, 인증 필수
- **교육 적합성**: ★★☆☆☆ — 무료 플랜 제한 강화로 교육 용도에 불안정. 과금 압박이 수강생에게 부담

### 6. Glitch ⚠️ 서비스 종료
- **URL**: https://glitch.com
- **상태**: **2025년 7월 서비스 종료**. 더 이상 사용 불가.
- 과거에는 복수 파일 구성 학습에 적합했으나, 서비스 종료로 대안 필요
- **대안**: StackBlitz (동일하게 복수 파일 대응, VS Code 기반 에디터, GitHub 연동)

### 7. W3Schools Tryit / MDN Playground
- **URL**: https://www.w3schools.com/tryit/ / https://developer.mozilla.org/play
- **일본어 지원**: MDN은 일본어 번역 있음. W3Schools는 영어만
- **무료 플랜**: 완전 무료
- **회원 가입**: 불필요
- **특징**:
  - 학습 특화형 간이 에디터
  - 기능은 최소한(저장·공유 없음)
  - 레퍼런스와 일체화
- **Playwright 자동화**: ✅ 용이. 심플한 textarea 기반
- **교육 적합성**: ★★★☆☆ — 보조 교재로는 우수하나 메인 에디터로는 기능 부족

---

## 비교 일람표

| 서비스 | 일본어 UI | 무료 플랜 | 가입 불필요 | 복수 파일 | Playwright 자동화 | 교육 적합성 |
|--------|-----------|-----------|-------------|-----------|-------------------|-------------|
| **CodePen** | ✕ | ◎ 무제한 | ✕(GitHub 로그인) | ✕(1펜) | ◎ 용이 | ★★★★★ |
| JSFiddle | ✕ | ◎ 무제한 | ◎ | ✕ | ○ 가능 | ★★★☆☆ |
| **StackBlitz** | ✕ | ○ 퍼블릭 | ✕ | ◎ | △ 다소 복잡 | ★★★★☆ |
| CodeSandbox | ✕ | △ 제한 있음 | ✕ | ◎ | △ 다소 복잡 | ★★★☆☆ |
| Replit | ✕ | △ 대폭 제한 | ✕ | ◎ | ✕ 복잡 | ★★☆☆☆ |
| ~~Glitch~~ | — | — | — | — | — | ⚠️ 서비스 종료 |
| W3Schools/MDN | △(MDN만) | ◎ 완전 무료 | ◎ | ✕ | ◎ 용이 | ★★★☆☆ |

---

## 추천 순위

### 🥇 1위: CodePen

**HTML/CSS 기본~중급(PART 1~3)에 최적**

- GitHub 계정으로 로그인 필수 (PART 4 StackBlitz와 동일 계정 사용을 위해 GitHub 통일)
- 3패인 구성이 심플하여 초보자에게 직관적
- Playwright 자동화 용이 → 강의 영상 자동 생성에 대응
- URL 공유로 수강생 간 코드 공유도 간단

### 🥈 2위: StackBlitz

**복수 파일 프로젝트(PART 4)에 최적**

- Monaco Editor(VS Code와 동일한 에디터 엔진)로 조작감 일치
- 파일 트리·터미널 등 VS Code 개념을 웹에서 체험
- 복수 파일 구성(index.html / style.css / script.js)을 자연스럽게 도입
- GitHub 로그인 필수이나 PART 1에서 이미 계정 생성 완료
- GitHub 연동(Connect Repository)으로 PART 5 배포와 자연스럽게 연결
- Playwright 자동화는 다소 복잡하나 대응 가능

> **참고**: 이전 버전에서 2위로 추천했던 Glitch는 2025년 7월 서비스 종료. StackBlitz가 대체.

---

## 단계별 도구 전략

커리큘럼 진행에 맞춰 단계적으로 도구를 이행한다:

```
PART 1~3 (강의 01~25)
  → CodePen
  HTML/CSS 기본~중급. 1파일로 완결되는 내용.
  GitHub 계정으로 로그인 (PART 4 StackBlitz와 동일 계정).

PART 4 (강의 26~37)
  → StackBlitz
  복수 파일 프로젝트. VS Code풍 에디터.
  GitHub 연동(Connect Repository)으로 코드 관리.

PART 5 (강의 38~42)
  → GitHub Web + 배포 플랫폼
  StackBlitz에서 GitHub으로 연동한 코드를 GitHub Pages/Netlify/Cloudflare로 배포.
```

### Playwright 자동화 관점

| 단계 | 도구 | 자동화 난이도 | 비고 |
|------|------|---------------|------|
| PART 1~3 | CodePen | ◎ 용이 | textarea / CodeMirror 기반 |
| PART 4 | StackBlitz | △ 다소 복잡 | Monaco Editor 특수 셀렉터 대응 필요 |
| PART 5 | GitHub Web + 배포 플랫폼 | ◎ 용이 | 모두 브라우저 기반 |

**모든 단계가 브라우저 안에서 완결** → Playwright 하나로 전체 자동화 가능 (~95% 커버리지)

---

*작성일: 2026-04-06 (최종 수정: 2026-04-07)*
*목적: 강의 자동화 파이프라인에서의 코드 에디터 선정 참고 자료*

> **참고**: Glitch(glitch.com)는 2025년 7월 서비스 종료. 본 문서의 초기 버전에서 Glitch를 2위로 추천했으나, StackBlitz로 대체함.

# Lecture Automation

일본어 Web 제작 강의 영상을 자동 생성하는 파이프라인입니다.
강의 JSON 하나로 TTS 음성 생성 → 브라우저 녹화 → 영상 렌더링 → 최종 MP4 출력까지 전 공정을 자동화합니다.

## 빠른 시작

```bash
npm install
cp .env.example .env   # API 키 설정
make run LECTURE=lecture-02.json
```

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `make run LECTURE=xxx.json` | 전체 파이프라인 실행 |
| `make run-force LECTURE=xxx.json` | 모든 캐시 무시하고 강제 재생성 |
| `make regen-scene LECTURE=xxx SCENE='5 12'` | 특정 씬 오디오·클립 재생성 후 전체 concat |
| `make render-scene LECTURE=xxx SCENE=5` | 특정 씬 클립만 렌더링 |
| `make concat-scenes LECTURE=xxx` | 기존 클립으로 최종 MP4 생성 (~5초) |
| `make preview SCENE=6` | 특정 씬 프리뷰 이미지(PNG) 생성 |
| `make clean` | 생성된 모든 에셋 삭제 |

## 파이프라인 구조

```
data/lecture-XX.json
    │
    ├─ 1단계: TTS 오디오 생성      → packages/remotion/public/audio/
    ├─ 1.5단계: 오디오 미리듣기 머지 → output/XX-audio-preview.wav
    ├─ 2단계: 스크린샷 캡처         → packages/remotion/public/screenshots/
    ├─ 3단계: Playwright 브라우저 녹화 → packages/remotion/public/captures/
    ├─ 4단계: 씬별 클립 렌더링      → output/clips/XX/scene-N.mp4  ← 캐시됨
    └─ 5단계: 클립 concat          → output/XX.mp4
```

**씬별 클립 캐싱**: 변경된 씬만 재렌더링하고 나머지는 스킵합니다.
한 씬 수정 시 `make regen-scene` → 해당 씬만 재처리 → concat (~수십 초).

## 프로젝트 구조

```
lecture-automation/
├── data/                    # 강의 JSON 입력 파일
├── config/                  # 전역 설정
│   ├── video.json           # 해상도, FPS, 테마, 애니메이션
│   └── tts.json             # TTS 프로바이더 설정
├── docs/                    # 문서
│   ├── playwright-actions.md  # Playwright 액션 명세서
│   ├── curriculum.md          # 전체 커리큘럼
│   └── tts-voices.md          # TTS 보이스 비교
├── packages/
│   ├── automation/          # 파이프라인 엔진 (Clean Architecture)
│   └── remotion/            # 영상 렌더링 (Remotion)
├── scripts/                 # 유틸리티 스크립트
└── output/                  # 생성된 결과물
```

## 강의 JSON 작성

### 기본 구조

```json
{
  "lecture_id": "02",
  "metadata": { "title": "강의 제목", ... },
  "sequence": [
    {
      "scene_id": 1,
      "narration": "나레이션 텍스트 (TTS로 음성 생성)",
      "durationSec": 15,
      "visual": { ... }
    }
  ]
}
```

### visual 타입 3가지

**① Remotion 컴포넌트** — 애니메이션 슬라이드

```json
"visual": {
  "type": "remotion",
  "component": "TitleScreen",
  "props": { "title": "제목", "sub": "부제목" },
  "transition": { "enter": "slide-left" }
}
```

지원 컴포넌트 목록: `TitleScreen`, `KeyPointScreen`, `DiagramScreen`, `NumberedListScreen`, `BeforeAfterScreen` 등 30종+

**② Playwright 브라우저 녹화** — 실제 브라우저 조작

```json
"visual": {
  "type": "playwright",
  "action": [
    { "cmd": "goto", "url": "https://example.com" },
    { "cmd": "mouse_move", "to": [960, 400] },
    { "cmd": "open_devtools" },
    { "cmd": "wait", "ms": 3000 }
  ]
}
```

→ 전체 액션 명세: [docs/playwright-actions.md](docs/playwright-actions.md)

**③ 스크린샷** — URL 캡처 이미지

```json
"visual": {
  "type": "screenshot",
  "url": "https://example.com",
  "title": "캡션"
}
```

## 설정

### TTS 프로바이더 변경

`config/tts.json`의 `activeProvider` 수정:

| 프로바이더 | 품질 | 비용 |
|-----------|------|------|
| `google_cloud_tts` | ⭐⭐⭐⭐⭐ | 유료 |
| `gemini_cloud_tts` | ⭐⭐⭐⭐ | 유료 |
| `gemini` | ⭐⭐⭐ | 무료(API 키) |

보이스 비교: [docs/tts-voices.md](docs/tts-voices.md)

### 테마 변경

`config/video.json`의 `activeTemplate`: `warm-cream` / `chalkboard`

## 아키텍처

Clean Architecture 기반. 각 레이어는 인터페이스를 통해서만 통신합니다.

```
Domain     → Entities (Lecture, Scene), Interfaces (IAudioProvider 등)
Application → Use Cases (GenerateAudio, RenderSceneClips, ConcatClips 등)
Infrastructure → Providers (Gemini, Playwright, Remotion, ffmpeg)
Presentation → CLI (main.ts, render-scene.ts, concat-scenes.ts)
```

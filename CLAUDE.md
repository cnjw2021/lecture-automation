# CLAUDE.md — Lecture Automation

새로운 Claude Code 세션을 위한 프로젝트 가이드입니다.

## 프로젝트 목적

일본어 Web 제작 강의 영상을 자동 생성하는 파이프라인.
강의 JSON → TTS 오디오 → 브라우저 녹화 → 씬별 클립 렌더링 → concat → MP4

## 핵심 아키텍처

**Clean Architecture** (레이어 간 인터페이스만 통신):

```
packages/automation/src/
├── domain/
│   ├── entities/Lecture.ts          # Scene, PlaywrightAction, VisualConfig 타입 정의
│   └── interfaces/                  # IVisualProvider, IClipRepository, IConcatProvider 등
├── application/use-cases/           # GenerateAudio, RenderSceneClips, ConcatClips 등
├── infrastructure/
│   ├── providers/                   # Gemini TTS, Playwright, Remotion, ffmpeg
│   └── repositories/                # FileClipRepository (캐시 경로 관리)
└── presentation/cli/
    ├── main.ts                      # 전체 파이프라인 실행
    ├── render-scene.ts              # 특정 씬만 재렌더링
    └── concat-scenes.ts             # 기존 클립 concat만
```

## 파이프라인 단계

| 단계 | Use Case | 출력 경로 |
|------|----------|-----------|
| 1 TTS 생성 | GenerateAudioUseCase | `packages/remotion/public/audio/` |
| 1.5 오디오 미리듣기 | MergeAudioUseCase | `output/{id}-audio-preview.wav` |
| 2 스크린샷 | CaptureScreenshotUseCase | `packages/remotion/public/screenshots/` |
| 3 브라우저 녹화 | RecordBrowserUseCase | `packages/remotion/public/captures/` |
| 4 씬별 클립 렌더링 | RenderSceneClipsUseCase | `output/clips/{id}/scene-N.mp4` ← 캐시 |
| 5 concat | ConcatClipsUseCase | `output/{id}.mp4` |

**씬별 클립 캐싱**: `output/clips/{lectureId}/scene-N.mp4`가 이미 존재하면 스킵.

## visual 타입 3가지

강의 JSON의 각 씬은 `"visual"` 필드로 타입 결정:

1. **`remotion`** — Remotion 컴포넌트 기반 애니메이션 슬라이드
2. **`playwright`** — Playwright 브라우저 실시간 조작 녹화
3. **`screenshot`** — URL 스크린샷 이미지

→ 전체 명세: [docs/playwright-actions.md](docs/playwright-actions.md)

## Playwright 씬 주요 주의사항

- **독립 컨텍스트**: 씬마다 새 브라우저 컨텍스트 → 이전 씬 상태 없음 → 각 씬에 `goto` 필수
- **커서**: headless 환경은 OS 커서 미표시 → `goto` 후 자동으로 커서 div 주입됨 → `mouse_move` 함께 사용해야 화면에 표시
- **DevTools 오버레이**: `open_devtools` 액션으로 주입 (오른쪽 38% 패널, 실제 DOM 트리 파싱)
- **타이밍**: 총 액션 시간 ≥ `durationSec - 2s` (짧으면 마지막 프레임 고정됨)
- **goto 타임아웃**: Yahoo/Apple 등 무거운 사이트 → `waitUntil: 'load'`, 20s timeout

## PlaywrightCmd 유니온 타입

`domain/entities/Lecture.ts`에 정의된 타입으로 컴파일 타임 검증:

```typescript
type PlaywrightCmd = 'goto' | 'wait' | 'mouse_move' | 'click' | 'type' |
  'press' | 'focus' | 'mouse_drag' | 'highlight' | 'open_devtools' |
  'disable_css' | 'enable_css';
```

강의 JSON 작성 시 반드시 `{"cmd": "goto", "url": "..."}` 형식 사용.
`{"goto": "url"}` 형식은 **잘못된 형식** (action 인식 안 됨).

## 자주 쓰는 make 명령어

```bash
make run LECTURE=lecture-02.json          # 전체 파이프라인
make regen-scene LECTURE=lecture-03.json SCENE='11 12 14'  # 특정 씬 재생성 + concat
make render-scene LECTURE=lecture-03.json SCENE=11         # 클립 렌더링만
make concat-scenes LECTURE=lecture-02.json                 # concat만 (~5초)
make preview SCENE=6                      # 씬 프리뷰 PNG
```

## 강의 데이터 파일

| 파일 | 상태 |
|------|------|
| `data/lecture-01.json` | 완성 |
| `data/lecture-02.json` | 완성 |
| `data/lecture-03.json` | 완성 (씬 10-14 Playwright 씬 포함) |

커리큘럼 전체: [docs/curriculum.md](docs/curriculum.md)

## 설정 파일

- `config/video.json` — 해상도(1920×1080), FPS(30), 테마(`warm-cream`/`chalkboard`)
- `config/tts.json` — TTS 프로바이더 (`google_cloud_tts` / `gemini_cloud_tts` / `gemini`)

## 현재 브랜치

`feat/lecture-scripts` — 씬별 클립 캐싱 + concat 파이프라인 구현 완료.

## 참고 문서

- [README.md](README.md) — 프로젝트 전체 개요
- [docs/playwright-actions.md](docs/playwright-actions.md) — Playwright 액션 명세서 (12종)
- [docs/tts-voices.md](docs/tts-voices.md) — TTS 보이스 비교
- [docs/curriculum.md](docs/curriculum.md) — 전체 커리큘럼

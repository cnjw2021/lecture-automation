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
| 0 라이브 데모 사전 녹화 | RecordVisualUseCase (filterLiveDemo) | `packages/remotion/public/captures/` + `.manifest.json` |
| 1 TTS 생성 | GenerateAudioUseCase | `packages/remotion/public/audio/` + `.alignment.json` |
| 1.5 오디오 미리듣기 | MergeAudioUseCase | `output/{id}-audio-preview.wav` |
| 1.7a 역방향 싱크 | ReverseSyncPlaywrightUseCase | WAV에 무음 삽입 + `durations.json` 갱신 |
| 1.7b 순방향 싱크 | SyncPlaywrightUseCase | JSON의 wait ms 재계산 |
| 2 스크린샷 | CaptureScreenshotUseCase | `packages/remotion/public/screenshots/` |
| 3 브라우저 녹화 | RecordVisualUseCase | `packages/remotion/public/captures/` |
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
- **타이밍 (일반 씬)**: 총 액션 시간 ≥ `durationSec - 2s` (짧으면 마지막 프레임 고정됨)
- **타이밍 (라이브 데모 씬)**: `wait_for`가 있으면 역방향 싱크 대상. durationSec는 나레이션 기준만 산출 — 최종 클립 길이는 비디오 녹화에 맞춰 자동 조정
- **goto 타임아웃**: Yahoo/Apple 등 무거운 사이트 → `waitUntil: 'load'`, 20s timeout

## PlaywrightCmd 유니온 타입

`domain/entities/Lecture.ts`에 정의된 타입으로 컴파일 타임 검증:

```typescript
type PlaywrightCmd = 'goto' | 'wait' | 'wait_for' | 'mouse_move' | 'click' | 'type' |
  'press' | 'focus' | 'mouse_drag' | 'highlight' | 'open_devtools' |
  'select_devtools_node' | 'toggle_devtools_node' |
  'disable_css' | 'enable_css' | 'scroll' | 'render_code_block';
```

강의 JSON 작성 시 반드시 `{"cmd": "goto", "url": "..."}` 형식 사용.
`{"goto": "url"}` 형식은 **잘못된 형식** (action 인식 안 됨).

## 자주 쓰는 make 명령어

```bash
make run LECTURE=lecture-01-02.json          # activeProvider로 전체 파이프라인
make run-master LECTURE=lecture-01-02.json   # master audio 기반 전체 파이프라인
make run-master-force LECTURE=lecture-01-02.json  # master audio 강제 재생성
make regen-scene LECTURE=lecture-03-01.json SCENE='11 12 14'  # 특정 씬 재생성 + concat
make render-scene LECTURE=lecture-03-01.json SCENE=11         # 클립 렌더링만
make concat-scenes LECTURE=lecture-01-02.json                 # concat만 (~5초)
make preview SCENE=6                         # 씬 프리뷰 PNG
```

## 강의 데이터 파일

파일명 형식: `data/lecture-{파트}-{강}.json` (예: `lecture-01-01.json` = PART 1, 강의 1)

| 파일 | 강의 | 상태 |
|------|------|------|
| `data/lecture-01-01.json` | 1-1 オリエンテーション | 완성 |
| `data/lecture-01-02.json` | 1-2 Webの仕組みと3つの言語 | 완성 |
| `data/lecture-01-03.json` | 1-3 AIが変えたWeb制作の風景 | 완성 |
| `data/lecture-01-04.json` | 1-4 CodePenセットアップ + Hello World | 완성 |
| `data/lecture-02-01.json` | 2-1 HTMLのルール | 완성 |
| `data/lecture-02-02.json` | 2-2 テキストを扱うタグ | 완성 |
| `data/lecture-02-03.json` | 2-3 リンクと画像 | 완성 |
| `data/lecture-02-04.json` | 2-4 構造を組み立てるタグ | 완성 |
| `data/lecture-02-05.json` | 2-5 フォーム | 완성 |
| `data/lecture-02-06.json` | 2-6 テーブル基礎 | 완성 |
| `data/lecture-02-07.json` | 2-7 AIにHTMLを任せる | 완성 |
| `data/lecture-03-01.json` | 3-1 CSSの仕組み | 완성 |
| `data/lecture-03-02.json` | 3-2 セレクタ | 완성 |
| `data/lecture-03-03.json` | 3-3 色とタイポグラフィ | 완성 |
| `data/lecture-03-04.json` | 3-4 ボックスモデル | 완성 |
| `data/lecture-03-05.json` | 3-5 Flexbox | 완성 |
| `data/lecture-03-06.json` | 3-6 レスポンシブデザイン | 완성 |
| `data/lecture-03-07.json` | 3-7 AIにCSSを任せる | 완성 |
| `data/lecture-04-01.json` | 4-1 サロンサイト企画 + AI初稿生成 | 완성 |
| `data/lecture-04-02.json` | 4-2 コードを読む + 新テクニック | 완성 |
| `data/lecture-04-03.json` | 4-3 カスタマイズ | 완성 |
| `data/lecture-04-04.json` | 4-4 仕上げ + レビュー | 완성 |
| `data/lecture-05-01.json` | 5-1 CodePenからファイルへ — StackBlitzで変換 | 완성 |
| `data/lecture-05-02.json` | 5-2 Netlifyでデプロイ | 완성 |
| `data/lecture-05-03.json` | 5-3 まとめと次のステップ | 완성 |

커리큘럼 전체: [docs/curriculum.md](docs/curriculum.md)

## 설정 파일

- `config/video.json` — 해상도(1920×1080), FPS(30), 테마(`warm-cream`/`chalkboard`)
- `config/tts.json` — TTS 프로바이더 (`google_cloud_tts` / `gemini_cloud_tts` / `gemini` / `elevenlabs`)

## 현재 브랜치

`feat/lecture-scripts` — 씬별 클립 캐싱 + concat 파이프라인 구현 완료.

## 참고 문서

- [README.md](README.md) — 프로젝트 전체 개요
- [docs/playwright-actions.md](docs/playwright-actions.md) — Playwright 액션 명세서 (14종: wait_for, scroll 포함)
- [docs/tts-voices.md](docs/tts-voices.md) — TTS 보이스 비교
- [docs/curriculum.md](docs/curriculum.md) — 전체 커리큘럼

## 강의 스크립트 작성 지침

강의 스크립트 작성·수정·검토 작업 시 반드시 아래 문서를 참조한다:

@docs/script-guidelines.md

## 강의 스크립트 레뷰 지침

스크립트 레뷰 시 반드시 아래 문서를 참조한다. 커리큘럼 준거, 전후 강의 연계, 후속 강의 영향 등의 관점이 포함되어 있다:

@docs/script-review-guide.md

## 스크립트 → JSON 변환 지침

확정된 스크립트를 Remotion 입력 JSON(`data/lecture-XX.json`)으로 변환하는 작업 시 반드시 아래 두 문서를 참조한다:

@docs/json-conversion-rules.md
@docs/component-props-reference.md

변환에 필요한 모든 규칙은 위 두 문서에 정의되어 있으므로, 기존 JSON 파일(`data/lecture-*.json`)을 참조용으로 읽을 필요 없음.

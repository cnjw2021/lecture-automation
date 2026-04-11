# Lecture Automation

일본어 Web 제작 강의 영상을 자동 생성하는 파이프라인입니다.
강의 JSON 하나로 TTS 음성 생성 → 브라우저 녹화 → 영상 렌더링 → 최종 MP4 출력까지 전 공정을 자동화합니다.

## 환경 구축

### 1. 시스템 사전 설치

| 도구 | 용도 | 비고 |
|------|------|------|
| **Node.js** v18+ | 파이프라인 엔진 전체 | Playwright용 Chromium은 `npm install` 시 자동 설치 |
| **ffmpeg** | 오디오 분할, 영상 concat | PATH에 등록 필요 |
| **Python** 3.9+ | 마스터 오디오 정렬 기능 | 정렬 기능 미사용 시 불필요 |

### 2. 의존성 설치

```bash
# Node.js 패키지 + Playwright Chromium 자동 설치
npm install

# TypeScript 빌드
npm run build -w packages/automation
```

마스터 오디오 자동 정렬 기능을 사용하는 경우, 전용 Python 가상환경을 별도로 구성합니다. 저장소 루트에 `.venv-align`이 있으면 파이프라인이 해당 Python을 우선 사용합니다.

```bash
make install-align-deps
```

정렬은 `faster-whisper + ctranslate2`의 CPU 경로를 기준으로 구성했습니다. `ctranslate2`는 재현성 있는 디버깅을 위해 `requirements-align.txt`에서 명시 버전으로 고정합니다. `torch`는 필수 의존성이 아니므로 정렬 전용 가상환경에는 기본 포함하지 않습니다.

### 3. 환경변수 설정

`.env` 파일을 생성하고 API 키를 입력합니다.

```bash
# .env
AUDIO_PROVIDER=gemini              # gemini | google_cloud_tts

GEMINI_API_KEY=your_key_here       # https://aistudio.google.com/app/apikey

# Google Cloud TTS 사용 시 추가 설정
GOOGLE_CLOUD_TTS_KEY_FILE=path/to/service-account.json
GOOGLE_CLOUD_TTS_VOICE=
GOOGLE_CLOUD_TTS_LANGUAGE_CODE=

# ElevenLabs 사용 시 추가 설정
ELEVENLABS_API_KEY=your_key_here
```

### 빠른 시작

```bash
make run LECTURE=lecture-02.json
```

`make run`은 `config/tts.json`의 `activeProvider`를 사용해 TTS를 생성합니다.
`activeProvider=elevenlabs` 이고 `providers.elevenlabs.chunkedGeneration.enabled=true`이면 긴 강의를 청크 단위로 생성한 뒤 씬별 WAV로 분할합니다.

마스터 오디오 기반으로 실행하려면 다음처럼 명시적으로 호출합니다.

```bash
make run-master LECTURE=lecture-02.json
```

`make run-master`는 `config/tts.json`의 `masterAudio.enabled`가 `true`일 때 lecture JSON의 `sequence[].narration`만 추출해 `input/master-audio/<lecture>/master.wav`를 자동 생성하거나 재사용하고, `manifest.json`의 `scriptHash`, `styleVersion`, `temperature`, `seed`, `promptHash`로 JSON과 마스터 오디오 간 drift를 관리합니다. 이미 생성한 파일을 쓰고 싶으면 `MASTER_AUDIO=/path/to/master.wav`를 함께 넘기면 됩니다.

## 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `make run LECTURE=xxx.json` | 전체 파이프라인 실행. `config/tts.json`의 `activeProvider`로 씬별 TTS 생성 |
| `make run-master LECTURE=xxx.json` | master.wav를 재사용하거나 `masterAudio` 설정으로 생성한 뒤 정렬/분할 |
| `make run-force LECTURE=xxx.json` | 모든 캐시 무시하고 씬별 TTS를 강제 재생성 |
| `make run-master-force LECTURE=xxx.json` | 모든 캐시 무시하고 master audio를 강제 재생성한 뒤 정렬/분할 |
| `make regen-scene LECTURE=xxx SCENE='5 12'` | 수정용 빠른 경로. 지정 씬만 씬 단위 TTS 재생성, 지정 씬만 렌더 후 전체 concat |
| `make resplit-chunk-audio LECTURE=xxx SCENE='5 12'` | 저장된 청크 원본 WAV/alignment로 재-TTS 없이 영향을 받는 청크를 다시 분할 |
| `make render-scene LECTURE=xxx SCENE=5` | 특정 씬 클립만 렌더링 |
| `make align-master-audio LECTURE=xxx AUDIO=... [MODEL=small]` | master.wav에서 alignment.json 생성 |
| `make import-master-audio LECTURE=xxx AUDIO=... ALIGN=...` | 강의 단위 TTS 마스터 오디오를 씬별 WAV로 분할 |
| `make import-master-audio-auto LECTURE=xxx AUDIO=... [MODEL=small]` | alignment 생성 후 씬별 WAV 자동 분할 |
| `make concat-scenes LECTURE=xxx` | 기존 클립으로 최종 MP4 생성 (~5초) |
| `make preview SCENE=6` | 특정 씬 프리뷰 이미지(PNG) 생성 |
| `make clean` | 생성된 모든 에셋 삭제 |

## 파이프라인 구조

```
data/lecture-XX.json
    │
    ├─ 1단계: TTS 오디오 생성      → packages/remotion/public/audio/
    │                              → tmp/chunked-audio/<lectureId>/ (청크 디버그 산출물)
    ├─ 대체: 마스터 오디오 분할     → packages/remotion/public/audio/
    ├─ 1.5단계: 오디오 미리듣기 머지 → output/XX-audio-preview.wav
    ├─ 2단계: 스크린샷 캡처         → packages/remotion/public/screenshots/
    ├─ 3단계: Playwright 브라우저 녹화 → packages/remotion/public/captures/
    ├─ 4단계: 씬별 클립 렌더링      → output/clips/XX/scene-N.mp4  ← 캐시됨
    └─ 5단계: 클립 concat          → output/XX.mp4
```

**씬별 클립 캐싱**: 변경된 씬만 재렌더링하고 나머지는 스킵합니다.
한 씬 수정 시 `make regen-scene` → 지정 씬만 재처리 → concat (~수십 초).

## ElevenLabs 청크 생성 운영 기준

`config/tts.json`에서 `providers.elevenlabs.chunkedGeneration.enabled=true`이면 긴 강의를 여러 청크로 나눠 TTS를 생성하고, 각 청크를 씬별 WAV로 분할합니다. 이 경로는 음색 변화 횟수를 줄이는 데 유리하지만, 경계 부근의 짧은 음절이나 휴지 배분은 ElevenLabs의 문자 단위 alignment 특성에 영향을 받습니다.

청크 생성 시 다음 디버그 산출물이 남습니다.

- `tmp/chunked-audio/<lectureId>/chunk-001.wav`
- `tmp/chunked-audio/<lectureId>/chunk-001.alignment.json`
- `tmp/chunked-audio/<lectureId>/chunk-001.manifest.json`
- `tmp/chunked-audio/<lectureId>/chunk-001.boundaries.json`

실무 기준은 다음처럼 나눕니다.

- 발음 문제, 오타 수정, 특정 씬 텍스트 변경: `make regen-scene`
- 앞뒤 씬 경계에서 마지막 글자나 첫 글자가 섞이는 문제: `make resplit-chunk-audio`
- `resplit`로도 해결되지 않는 경계: 해당 씬을 `make regen-scene`으로 개별 재생성

`resplit-chunk-audio`는 저장된 청크 원본이 있어야 동작합니다. 청크 원본이 없다면 먼저 한 번 청크 생성이 끝나야 합니다.

```bash
make resplit-chunk-audio LECTURE=lecture-01.json SCENE='17 18'
```

수동 보정이 필요하면 `tmp/chunked-audio/<lectureId>/boundary-overrides.json`을 둘 수 있습니다.

```json
[
  {
    "fromSceneId": 17,
    "toSceneId": 18,
    "offsetMs": 140,
    "reason": "scene17 final syllable retention"
  }
]
```

수정 작업에서는 `make regen-scene`가 청크 모드를 우회합니다. 즉 청크 생성이 활성화되어 있어도, 지정 씬만 개별 TTS로 다시 생성하고 해당 씬만 렌더링합니다.

## 프로젝트 구조

```
lecture-automation/
├── data/                    # 강의 JSON 입력 파일
├── config/                  # 전역 설정
│   ├── video.json           # 해상도, FPS, 테마, 애니메이션
│   └── tts.json             # TTS 프로바이더 설정
├── docs/                    # 문서
│   ├── playwright-actions.md  # Playwright 액션 명세서
│   ├── master-audio-segmentation.md # 마스터 오디오 기반 씬 분할 설계
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
| `elevenlabs` | ⭐⭐⭐⭐⭐ | 유료 |
| `gemini` | ⭐⭐⭐ | 무료(API 키) |

`make run`에서 `activeProvider=gemini`를 사용할 경우, `config/tts.json`의 `providers.gemini.prompt`, `temperature`, `seed`를 함께 사용해 요청마다 최대한 비슷한 강의 톤으로 읽도록 고정합니다. `activeProvider=gemini_cloud_tts`를 사용할 경우에도 `providers.gemini_cloud_tts.prompt`를 함께 보내 같은 강의 톤을 유지하도록 합니다.

`activeProvider=elevenlabs`를 사용할 경우 `ELEVENLABS_API_KEY` 환경변수와 `config/tts.json`의 `providers.elevenlabs.voiceId`가 필요합니다. 기본 모델은 `eleven_v3`이며, `stability`, `similarity_boost`, `style`, `use_speaker_boost`, `seed`를 함께 사용해 일관성을 조정합니다.

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

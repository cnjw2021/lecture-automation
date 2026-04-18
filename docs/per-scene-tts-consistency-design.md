# 개별 씬 단위 TTS 일관성 전략 — 설계서

## 목적

`eleven_v3` + 개별 씬 단위 생성 모드에서 **각 씬 시작 3~5초 구간의 톤 드리프트**를 완화하기 위한 구현 설계를 정의한다.

전체 맥락은 `docs/tts-history.md`를 먼저 읽을 것.

---

## 관찰 — 문제의 형태

v3 개별 씬 모드에서 확인된 재현 가능한 패턴:

- 각 씬 WAV의 **처음 3~5초 구간**에서 톤·속도·억양이 매 호출마다 조금씩 다르게 샘플링됨
- 3~5초가 지나면 모두 동일한 음색(원 voice reference에 수렴)으로 안정됨
- 씬을 이어붙여 재생하면 초반 구간만 이질감이 드러남

v3 고유의 non-deterministic prosody 샘플링 특성 + 첫 문장에서 감정·분위기를 먼저 결정하려는 경향의 결합.

제약:
- `previous_text` / `next_text` — v3에서 400 에러로 거부 (`project_elevenlabs_v3_limit.md`)
- 청크 방식 — 경계 컷 leak으로 해결 불가 판정 (`tts-history.md` §5)

→ **각 씬을 개별 호출로 생성하되, 톤이 이미 안정된 상태의 오디오만 최종 결과로 남기는 방식이 필요**.

---

## 전략 — Warmup Padding + Trim

### 원리

1. 각 씬 나레이션 앞에 **고정된 중립 warmup 텍스트**를 prepend 하여 TTS 호출
2. v3는 warmup + 본문을 하나의 긴 발화로 생성 → warmup 구간에서 톤이 안정화됨
3. 반환된 alignment 타임스탬프를 이용해 **warmup 종료 지점을 초 단위로 계산**
4. 생성된 PCM 버퍼에서 warmup 구간을 **앞쪽에서 잘라냄**
5. 남은 alignment 타임스탬프는 trim된 오프셋만큼 차감하여 보정
6. 최종 저장되는 WAV는 **톤이 이미 안정된 본문 구간만** 포함

### 개념도

```
호출 입력 (warmup + 본문):
 ┌──────────────────────┬─────────────────────────────────┐
 │ これからお話しします。 │ 本編のナレーション …              │
 └──────────────────────┴─────────────────────────────────┘
                        ↓ v3 생성
생성된 PCM:
 ┌──────────────────────┬─────────────────────────────────┐
 │  ⟨톤 드리프트 구간⟩   │  ⟨안정된 본편⟩                    │
 └──────────────────────┴─────────────────────────────────┘
                        ↑
                        trim boundary
                        (alignment.character_end_times_seconds[warmup.length - 1])

저장되는 WAV:
                        ┌─────────────────────────────────┐
                        │  ⟨안정된 본편⟩                    │
                        └─────────────────────────────────┘
```

### 장점

- 씬마다 자연스러운 음색 흐름 (모든 씬 동일 오프닝 오디오를 붙이는 방식 아님)
- 사전 자산·버전 관리 불필요 — config의 문자열 하나로 동작
- v3의 "3~5초 뒤 수렴" 관찰을 직접 활용
- TTS provider 내부 완결 — 상위 UseCase·싱크 로직 불변

### 단점

- warmup 문자 수만큼 토큰/크레딧 추가 소모 (씬당 약 10자, 전체의 3~5% 수준으로 추정)
- alignment 타임스탬프의 정밀도에 의존 — 정확도 검증 필요
- warmup + 본문이 매우 긴 씬에서 모델 입력 한도 접근 가능성 (실측 필요)

---

## 구현 설계

### 대상 파일

- 주: `packages/automation/src/infrastructure/providers/ElevenLabsAudioProvider.ts`
- 부: `packages/automation/src/infrastructure/config/index.ts` (config 로더)
- 부: `packages/automation/src/infrastructure/factories/ElevenLabsConfiguredAudioProviderBuilder.ts` (옵션 주입)

### config 변경

`config/tts.json`:

```json
"elevenlabs": {
  …,
  "warmupPadding": {
    "enabled": true,
    "text": "これからお話しします。",
    "trimGuardMs": 0
  }
}
```

| 필드 | 의미 |
|------|------|
| `enabled` | false 면 현재 동작(warmup 없이 호출). 점진적 도입·롤백용 스위치 |
| `text` | 씬마다 앞에 붙일 고정 중립 문장. 씬 본문 내용과 독립 |
| `trimGuardMs` | trim 경계 보정(ms). 0이면 alignment가 지정한 정확한 경계를 사용. 50~100으로 올리면 fricative 꼬리 누출 방지 목적의 안전 여백 추가 가능 |

### 처리 흐름 (`ElevenLabsAudioProvider.generate()`)

```
입력: text (씬 본문), options
───────────────────────────────────────────────
if (warmupPadding.enabled):
  paddedText = warmupPadding.text + text
  sentToApi = paddedText
else:
  sentToApi = text

response = POST /with-timestamps { text: sentToApi, ... }
pcmBuffer = base64-decode(response.audio_base64)
alignment = response.alignment

if (warmupPadding.enabled):
  warmupChars = warmupPadding.text.length
  trimSec = alignment.character_end_times_seconds[warmupChars - 1]
           + (warmupPadding.trimGuardMs / 1000)

  # PCM 앞부분 제거
  bytesPerSec = sampleRate * channels * (bitDepth / 8)
  trimBytes = floor(trimSec * bytesPerSec)
  trimBytes = alignToFrame(trimBytes, bytesPerFrame)  # 프레임 경계 정렬
  pcmBuffer = pcmBuffer.slice(trimBytes)

  # alignment 배열 앞부분 제거 + 타임스탬프 오프셋 차감
  alignment.characters            = alignment.characters.slice(warmupChars)
  alignment.character_start_times_seconds =
    alignment.character_start_times_seconds.slice(warmupChars).map(t => t - trimSec)
  alignment.character_end_times_seconds =
    alignment.character_end_times_seconds.slice(warmupChars).map(t => t - trimSec)

wav = pcmToWav(pcmBuffer, audioConfig)
return { buffer: wav.buffer, durationSec: wav.durationSec, alignment }
```

핵심 포인트:

- **trim 경계 산출**은 alignment가 이미 제공하는 `character_end_times_seconds` 를 그대로 활용. 별도 음향 분석 불필요
- **PCM 바이트 오프셋은 반드시 프레임 경계(`channels * bitDepth/8`)에 정렬** — 정렬 안 하면 noise/pop 발생
- **alignment 배열도 동시에 보정** — 상위 레이어(순방향 싱크 등)가 alignment를 사용할 때 부정확해지지 않도록
- **durationSec 재계산** — trim 후 PCM 길이 기반으로 자동 산출되므로 별도 처리 불필요

### 상위 레이어 영향

- `durations.json` — 씬 WAV 길이 기반으로 자동 산출되므로 자연 전파
- 순방향 싱크 (`SyncPlaywrightUseCase`) — alignment 배열이 warmup 제거된 상태로 전달되므로 추가 보정 불필요
- 역방향 싱크 (`ReverseSyncPlaywrightUseCase`) — 영향 없음 (비디오 녹화에 WAV를 맞추는 단계)

### 에러 처리 · 방어 로직

- `warmupPadding.text` 가 빈 문자열이면 `enabled: false`로 간주
- alignment 누락 시: trim 불가 → warmup 포함된 채로 반환 + 경고 로그 (요청은 실패시키지 않음)
- `trimSec` 이 전체 WAV 길이 이상이면: 이상 상황 → 에러 throw (warmup 텍스트가 너무 길거나 alignment 오염)

---

## 검증 계획

### Phase 1 — 프로토타입 + A/B 청취 비교

1. `warmupPadding.enabled: false` 상태로 강의 1-1의 씬 1~3 생성 → WAV 보관
2. `warmupPadding.enabled: true` 로 동일 씬 재생성 → WAV 보관
3. 두 세트를 이어붙여 재생 비교. 청취 포인트:
   - 씬 초반 1~2초의 톤 흔들림이 실제로 완화되는지
   - trim 경계에서 노이즈·클릭이 발생하지 않는지
   - warmup-본문 연결이 부자연스러운 억양 끊김을 만들지 않는지

### Phase 2 — 튜닝

warmup 텍스트 후보를 3~5개 두고 각각 테스트:

| 후보 | 길이 | 문맥 호환성 |
|------|------|------------|
| `これからお話しします。` | 10자 | 범용 ◯ |
| `では、始めます。` | 8자 | 범용 ◯ |
| `続けてお話しします。` | 10자 | 연속 씬에 어울림 |
| `はい、` | 3자 | 짧음, 안정화 부족 가능성 |
| `皆さん、こんにちは。` | 10자 | 첫 씬 외에는 부자연스러움 |

`trimGuardMs` 도 0 / 30 / 50 / 100 을 비교.

### Phase 3 — 롤아웃

- 채택된 warmup 텍스트·trimGuard 값을 `config/tts.json` 기본값으로 반영
- 기존 씬 WAV는 `make run-tts-only SCENE=...` 로 선택 재생성
- 신규 강의는 자동 적용

---

## 남은 결정 사항 (Phase 2 청취 후 결정)

구현은 완료. 아래는 Phase 2 A/B 청취 결과로 확정할 튜닝 파라미터.

1. **warmup 텍스트 최종 선정** — 후보 3~5개 실측 비교 후 결정. 현재 기본값: `これからお話しします。`
2. **`trimGuardMs` 기본값** — 현재 `0` (alignment 정확한 경계 사용). 실측에서 fricative 꼬리 누출이 관찰되면 30~50으로 조정
3. **warmup 꼬리 `。` 마침표의 포즈 처리** — v3가 마침표 뒤에 짧은 포즈를 삽입할 수 있음. `trimGuardMs` 또는 warmup 텍스트 꼬리 조정으로 대응
4. **첫 씬(TitleScreen) 예외** — trim으로 warmup이 제거되므로 예외 처리 불필요로 추정. 실측 확인

---

## 변경 이력

- 2026-04-18: 설계서 최초 작성 (오프닝 오디오 재사용 방식으로 오해 기술)
- 2026-04-18: **전면 재작성**. 사용자 원안(씬 프롬프트에 warmup 텍스트 prepend → 생성 후 alignment 기반 trim) 반영. 이전 "첫 문장 중립화(#6)" 폐기, "오프닝 오디오 재사용(#7)" 은 "warmup padding + trim"으로 교체
- 2026-04-18: **구현 완료** (PR #73 / issue #74). 추가 구현 사항: `make run-tts-only` 타겟, `MergeAudioUseCase` 씬 지정 머지 + 씬 간 1.5초 무음 삽입. 남은 결정 사항 섹션을 "구현 착수 전"에서 "Phase 2 청취 후 결정"으로 업데이트

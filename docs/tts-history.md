# TTS 엔진·보이스 탐색 이력

이 문서는 본 프로젝트가 거쳐온 TTS(음성 합성) 모델·보이스 조합의 시도·실패·최종 결정을 기록한다.

> **이 문서의 목적**
>
> 미래의 작업자(사람·AI 어시스턴트 모두)가 **이미 실패로 판정된 접근 방식을 다시 추천·재시도하지 않도록** 하는 것이 유일한 목적이다.
> 아래 "❌ 재추천 금지" 섹션의 조합은 **다시 제안하지 말 것.**

---

## 배경

- 본 프로젝트는 일본어 Web 제작 강의(약 40+강, 각 15~30분) 영상을 TTS로 자동 생성한다.
- 나레이션 품질 요구치는 **"일본의 IT 입문 강의 수강생이 AI 음성임을 의식하지 않고 집중할 수 있는 수준"**.
- 단가 민감도: 총 분량이 크므로 **씬 단위(수천 개) 재생성**이 빈번 → 토큰/크레딧 절약은 중요하지만, **품질이 우선**이다.

---

## ❌ 재추천 금지 조합

아래는 **이미 충분히 시도했고 실패한** 조합이다. "혹시 이번엔…" 하고 다시 제안하지 말 것.

### 1. `eleven_multilingual_v2` + Hinata (`j210dv0vWm7fCknyQpbA`)

- **실패일**: 2026-04-18
- **설정**: stability 0.75, similarity_boost 0.85, style 0, speed 0.95, apply_text_normalization "on", apply_language_text_normalization true
- **실패 모드**: **한자 동형이의 독음 실패**. 한 패러그래프 내에서 `方`을 **ほぉ / ほぉ / カタ**로 읽는 등 문맥에 따른 독음 선택이 무너짐.
- **원인**: multilingual_v2는 일본어 형태소 분석·문맥 독음 판정이 약한 모델. `language_code` 파라미터도 v2에서는 무시된다.
- **교훈**: ElevenLabs의 non-v3 모델은 **일본어 한자 독음의 정확성을 보장하지 않는다.** 테스트 시 반드시 `方`, `日`, `生`, `行`, `長` 등 다의 한자가 섞인 문단으로 검증.

### 2. `eleven_flash_v2_5` + Kosuke (`pfzojrOPPpo9eObivQXJ`)

- **실패일**: 2026-04-18
- **실패 모드**: 전체 톤이 **"모노드라마 배우"** 스타일로 과도하게 연기·감정이 실림. IT 교육용 차분한 강사 톤과 정반대.
- **원인**: Kosuke 보이스 자체가 연기·낭독 편향. flash_v2_5의 빠른 응답 특성과 맞물려 더 과장됨.
- **교훈**: 보이스 라이브러리에서 "expressive", "narrative", "storyteller" 태그가 붙은 보이스는 IT 강의에 부적합. 태그에 "calm", "measured", "neutral"가 있는 보이스만 후보.

### 3. `google_cloud_tts` (Chirp3 HD Charon, `ja-JP-Chirp3-HD-Charon`)

- **실패일**: 이번 세션 이전(정확한 시점 불명, 프로젝트 초기)
- **실패 모드**: **AI 음성 티가 너무 확연하게 드러남.** 수강생 몰입 저해.
- **원인**: Google TTS는 문장 단위 운율 예측이 기계적이라 긴 강의 나레이션에서 부자연스러움이 누적됨.
- **교훈**: Google Cloud TTS 계열(Wavenet/Neural2/Chirp/Chirp3)은 **장문 강의용으로 품질 미달**. "스테이블하니까 이걸로 가자"는 제안 금지.

### 4. `gemini_cloud_tts` (Gemini 2.5 Preview TTS)

- **실패일**: 이번 세션 이전(프로젝트 중기)
- **실패 모드**: **토큰 사용량 제한 초과.** 품질 자체는 ElevenLabs v3와 동급으로 매우 우수했음.
- **원인**: Preview 단계 모델의 쿼터 제한이 낮아 40+강 규모 프로젝트에서 조기 소진.
- **교훈**: 품질이 좋아도 **쿼터 제약으로 운영 불가**. GA 이전의 프리뷰 TTS 모델은 대규모 자동화 파이프라인의 주 엔진으로 채택하지 않는다.

### 5. `eleven_v3` 청크(chunkedGeneration) 방식

- **실패일**: 2026-04 (약 4일간 경계 컷 알고리즘 고도화 끝에 포기)
- **접근**: 다수 씬을 하나의 긴 요청으로 묶어 생성 → alignment 타임스탬프 기준으로 씬 경계에서 WAV를 잘라 씬별 파일로 분할.
- **실패 모드**: **청크 경계 컷에서 인접 씬의 음소 leak 발생.** fricative(마찰음) 온셋이 앞 씬 WAV 말미에 섞이거나, 다음 씬 모음 꼬리가 현 씬에 남는 문제.
- **시도한 대응 (모두 부분적 해결에 그침)**:
  - L1: Whisper 재정렬로 경계 타임스탬프 보정
  - L2: Forward-only lowest RMS silence snap
  - L3: 양방향 leak 차단 알고리즘
  - L4: 경계 컷을 Strategy 패턴으로 분리 (prev-inflated 경계에서 backward RMS 검색)
  - 관련 브랜치: `fix/chunk-boundary-leak` (원격에 보존됨, 커밋 `3858156`까지)
- **결론**: alignment 타임스탬프의 정밀도 한계 + v3가 요청 단위로 prosody를 연속적으로 생성하는 특성이 결합 → **경계 leak은 완전 해결 불가능**으로 판정.
- **교훈**: v3 청크 → 씬 분할 경로는 막다른 길. 씬 간 톤 일관성을 위해 청크로 묶더라도, 경계 품질이 전체 영상 몰입을 해친다.

### 6. `Kokoro-82M v1.0` (kokoro-onnx + misaki[ja])

- **실패일**: 2026-05-01 (이슈 #151 PoC, 브랜치 `feat/local-tts-poc`)
- **환경**: Intel Mac (2020 MBP i5), CPU-only, Python 3.12 venv
- **접근**: 비용 0 의 로컬 대안. Apache-2.0 라이선스. ONNX 추론으로 CPU 합성 가능.
- **실패 모드**:
  - **애니메이션 톤 timbre**. Kokoro 의 일본어 학습 데이터가 애니메 음성 위주라 강의 나레이션 용도의 차분한 강사 톤 불가.
  - **억양 단조**. 작은 모델(82M) + 얇은 일본어 데이터 조합의 한계.
  - **문장 사이 호흡 없음**. 합성 단위가 phoneme 시퀀스 전체라 자연스러운 휴지 미생성. 후처리로 무음 삽입은 가능하지만 timbre 한계가 더 본질적이라 무의미.
  - **510 phoneme 한계**. 강의 나레이션은 보통 150자 이상이라 한 호출로 처리 불가, 문장 분할 + concat 필요. 이는 코드로 해결 가능하지만 기각 사유와 무관하게 별개 작업.
- **시도한 보이스**: `jf_alpha`, `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo` — 5종 모두 동일 timbre 한계 (학습 데이터 자체가 애니메 톤).
- **결론**: 코드로 보정 불가능한 모델 한계. 비용 0 매력에도 불구하고 강의 나레이션 기준선 미달로 기각.
- **교훈**: ONNX 로컬 모델은 영어 위주로 평가되는 경향. 일본어 강의 나레이션처럼 timbre 자체가 결정적인 용도에서는 학습 데이터 다양성을 사전에 확인해야 한다. 음성 클로닝 가능 모델 (XTTS-v2 / GPT-SoVITS / Fish Speech) 로 이동.

### 7. `XTTS-v2 (Coqui)` 일본어 + ElevenLabs voice cloning

- **실패일**: 2026-05-01 (이슈 #151 PoC, 브랜치 `feat/local-tts-poc`)
- **환경**: Intel Mac (2020 MBP i5), CPU-only, Python 3.10 venv. ElevenLabs 합성 결과 (15→25초 mono) 를 참조 음성으로 사용.
- **라이선스**: Coqui Public Model License (CPML).
- **접근**: voice cloning 으로 ElevenLabs 의 차분한 강사 톤 음색을 모방. coqui-tts 0.26 + torch 2.2 + transformers 4.46 (Intel Mac wheel 호환 핀).
- **실패 모드**:
  - **쇳소리·잡음 (metallic artifact)** 이 합성 결과 전체에 일관되게 발생. 음색 클로닝 자체는 부분 성공 (애니메이션 톤은 아님) 했지만 IT 강의 나레이션 용도로 받아들일 수 없는 수준.
  - 원인 추정: XTTS-v2 의 diffusion-style vocoder + 짧은 참조 음성 + CPU 추론의 결합 한계.
- **시도한 튜닝 (모두 metallic 잔존)**:
  - 참조 음성 15초 → 25초 길이 증가
  - 22050Hz → 24000Hz 샘플레이트 상향
  - temperature 0.7 → 0.5 인하
- **결론**: architecture 한계라 추가 튜닝 무의미. CPU + voice cloning 조합에서 음질 만족도가 production 강의용 기준선 미달. 다음 음성 클로닝 후보 (Fish Speech / GPT-SoVITS) 로 이동.
- **교훈**: XTTS-v2 의 metallic artifact 는 알려진 한계. CPU 환경에서는 더 두드러진다. voice cloning 후보 평가는 "음색 모방" 여부보다 "원샘플 품질" 을 먼저 확인해야 한다.

---

## ✅ 최종 채택 조합

### `eleven_v3` + 프로젝트 고정 보이스(`6wdSVG3CMjPfAthsnMv9`) + **개별 씬 단위 생성** + 시작 톤 안정화 전략

- **기본 설정** (`config/tts.json`):
  - stability 0.85
  - similarity_boost 0.9
  - style 0
  - speed 1.0
  - seed 7 (고정. 2026-05-01 에 42 → 7 변경. 사유는 아래 "첫 음 잘림 대응 플레이북" 참조)
  - `chunkedGeneration.enabled: false` (개별 씬 단위)

### 씬별 생성의 알려진 약점과 대응 전략

씬을 개별 호출로 생성하면 **첫 시작 구간 톤 드리프트**가 발생한다.
v3는 non-deterministic이며 첫 문장에서 분위기·감정 방향을 샘플링한 뒤 뒤로 갈수록 voice reference에 수렴하는 패턴을 보인다.
이를 완화하기 위해 아래 전략을 병행한다.

#### 전략 A: 파라미터 수준 안정화 (config에서 해결)
- `seed` 고정 — 동일 입력·동일 설정에서 "거의 같은" 결과를 best-effort로 유도
- `stability` 높게 (0.85) — reference audio 쪽으로 수렴
- `similarity_boost` 높게 (0.9) — 원 보이스 추종 강화
- `style: 0` — 감정 변동 억제
- **참고**: v3는 `use_speaker_boost`를 공식 지원하지 않음 (현재 config의 `true`는 모델에서 무시될 가능성). `previous_text` / `next_text`는 v3에서 400 에러(`unsupported_model`)로 거부됨 → 문맥 기반 연속성 경로 불가.

#### 전략 B: 입력 텍스트 수준 안정화 (스크립트/JSON 가이드)
- **첫 문장 중립화**: 씬 첫 문장에 `—`(em 대시), `...`, ALL CAPS, 과장된 구두점, audio tag 등을 넣지 않는다. 평이한 평서문으로 시작.
- 감정·연기가 필요한 표현은 **두 번째 문장 이후로 배치**.
- 이 원칙은 `docs/script-guidelines.md` 및 `docs/json-conversion-rules.md`의 나레이션 작성 규칙과 함께 적용.

#### 전략 C: Warmup Padding + Trim ✅ 구현·검증 완료 (2026-04-18)

각 씬 나레이션 앞에 고정 warmup 텍스트를 prepend하여 TTS를 호출한 뒤, alignment 타임스탬프 기준으로 warmup 구간을 trim하여 저장한다.

- **원리**: v3는 warmup + 본문을 하나의 긴 발화로 생성 → warmup 구간에서 톤이 안정화된 상태로 본문 발화가 시작됨
- **구현**: `ElevenLabsAudioProvider.generate()` 내부에서 PCM trim + alignment offset 보정. `config/tts.json`의 `warmupPadding` 필드로 제어
- **확정 설정**: `text: "これからお話しします。"`, `trimGuardMs: 0`, `enabled: true`
- **Phase 1 A/B 청취 결과**: warmup 비활성 대비 톤 드리프트 완전 해소 확인. Phase 2 튜닝 생략 (기본값 충분)
- **상세 설계**: `docs/per-scene-tts-consistency-design.md` 참조

### 최종 결정 근거

```
v3 씬별 (기본)      → 첫 시작 톤 드리프트 (전략 A+B+C로 완화 가능)   ← 채택
v3 청크            → 경계 컷 leak (알고리즘 한계, 해결 불가)
multilingual_v2    → 한자 오독 (치명적)
flash_v2_5         → 모노드라마 톤 (강의 부적합)
google Chirp3      → AI 티 (수강생 몰입 저해)
gemini 2.5 TTS     → 쿼터 제한 (운영 불가)
```

v3 청크의 실패 모드(경계 leak)는 알고리즘 한계로 **해결 경로가 없음**이 확인된 반면, v3 씬별의 실패 모드(첫 시작 드리프트)는 **파라미터·텍스트·오프닝 재사용으로 완화 가능**하다. 따라서 후자가 lesser evil.

---

## 첫 음 잘림 (onset cutoff) 대응 플레이북

특정 씬에서 나레이션 첫 음절이 잘려 들리는 현상이 일관되게 재현될 때 사용한다. 본 플레이북은 2026-05-01 `lecture-02-03` 씬 7 (`リンクに使うのは…`) 의 `リ` 잘림 인시던트로부터 정리되었다.

### 증상

- 특정 씬의 시작부 자음 (특히 `リ`, `ル` 같은 flap consonant) 이 잘리거나 끊긴 듯 들린다
- 동일 텍스트·동일 seed 로 여러 차례 재생성해도 같은 위치에서 같은 잘림이 재현된다
- 다른 씬은 정상 — 문제 씬만 이상

### 머지 단계 코드 수정으로는 못 고치는 이유

진짜 원인은 v3 가 만든 chunk wav 자체에 들어 있는 **부자연스러운 burst → 갭 → speech 패턴**이다. 청취 인상은 "리... 링쿠니" 처럼 첫 음만 잠깐 끄덕이고 끊겼다가 본격 발화가 시작되는 듯한 잘림. 이는 alignment 가 보고하는 character timing 과 실제 음향이 mismatch 한 결과로 보인다.

검증 방법: 해당 chunk wav 의 첫 200ms 를 1ms 단위 RMS 로 확인했을 때 `[강한 burst 50ms] → [40~50ms 갭] → [본격 speech]` 패턴이 보이면 이 케이스다.

머지 단계의 `assembleSceneAudio.headPaddingMs` 는 잘린 음의 **앞**에 무음 마진을 추가할 뿐, chunk 안에 들어 있는 burst→갭 자체는 못 메운다. 따라서 머지 단계 코드 수정만으로는 해결 불가. v3 의 input (seed, warmup text, 텍스트 자체) 을 바꿔서 v3 가 다른 음향 패턴을 생성하도록 유도해야 한다.

### 대응 후보 (검증 비용 순)

| 옵션 | 변경 | 검증 비용 | 회귀 위험 |
|---|---|---|---|
| A. seed 변경 | `tts.json` 의 `seed` 값 | 청크 재생성 1회 | 다른 씬 음색 변동 가능. 전체 영향 |
| B. 워밍업 텍스트 변경 | `warmupPadding.text` | 청크 재생성 1회 | 모든 씬 영향 |
| C. 후처리 갭 압축 | `WavChunkAssembler` 등에서 짧은 burst 다음 갭 자동 단축 | 코드 작성 + 검증 | burst 가 진짜 자음이면 잘못 잘릴 수도 |
| D. v3 포기 | 다른 모델 채택 | 큼 | 본 문서의 ❌ 재추천 금지 5종 제외하면 대안 없음 |

### 권장 절차

1. **A 부터 시도**. seed 만 한 줄 바꾸고 해당 씬 청크 force 재생성. 5분 안에 검증 가능
2. A 가 듣기에 자연스러우면 즉시 채택. 단, **다른 강의의 이미 확정된 음성과 음색이 미세하게 달라질 수 있으므로**, 이미 영상까지 만든 강의의 TTS 를 재생성할 계획이라면 음색 일관성 trade-off 를 의식할 것
3. A 가 같은 잘림을 재현하면 다른 seed (예: 100, 1) 시도
4. 여러 seed 에서 같은 패턴이 나오면 B (워밍업 텍스트 변경) 로 전환
5. B 도 실패하면 C 또는 D 검토

### 청크 force 재생성 명령

```bash
# 문제 씬의 chunk wav/alignment 와 머지 결과 wav/alignment 를 모두 삭제 후 재생성
rm packages/remotion/public/audio/{lectureId}/scene-{N}-chunk-*.{wav,alignment.json} \
   packages/remotion/public/audio/{lectureId}/scene-{N}.{wav,alignment.json}
make run-tts-only LECTURE=lecture-XX-YY.json SCENE='N'
```

### 인시던트 기록

| 일자 | 강의 | 씬 | 증상 | 적용한 옵션 | 결과 |
|---|---|---|---|---|---|
| 2026-05-01 | lecture-02-03 | 7 (`リンクに使うのは…`) | 첫 `リ` 잘림. seed 42 로 여러 차례 재생성해도 동일 | A: seed 42 → 7 | 해소 |

---

## 향후 신규 TTS 엔진 검토 시 체크리스트

새로운 TTS 엔진·모델을 검토할 때는 반드시 다음을 모두 확인한 뒤 제안할 것.

1. **일본어 한자 동형이의 독음 테스트**
   - 최소 검증 문구: `方(ほう/かた/がた)`, `生(せい/なま/いき)`, `行(ぎょう/こう/いく)`가 섞인 문단.
   - 단일 문단 내 다른 독음 혼용 여부 확인.

2. **장문 강의 톤 일관성**
   - 최소 10분 이상(약 4000자) 연속 생성 후 톤 드리프트·감정 과장 여부 확인.
   - 1~3씬만 뽑아 듣고 "괜찮다"고 판정하지 말 것. 장문에서 드러나는 문제가 다수.

3. **AI 음성 티**
   - 비전문 청취자가 들었을 때 "합성음 같다"는 인식이 드는지.
   - 참고 기준: Google Chirp3 HD는 이 항목에서 불합격.

4. **쿼터·비용 지속 가능성**
   - 40+강 × 각 15~30분 × 재생성 포함 총 사용량을 견딜 수 있는 쿼터 구조인지.
   - Preview/Beta 단계 모델은 원칙적으로 주 엔진 채택 불가.

5. **이미 실패한 조합 재추천 금지**
   - 이 문서의 "❌ 재추천 금지" 섹션 5개 조합은 **다시 제안하지 않는다.**
   - 만약 제안하려는 조합이 저 5개 중 하나와 유사하면, 이 문서에서 왜 실패했는지 먼저 읽을 것.

---

## 변경 이력

- 2026-04-18: 문서 최초 작성. `eleven_multilingual_v2 + Hinata` 실패를 계기로 과거 탐색 전체를 정리하고 `eleven_v3 + 개별 씬 + 시작 톤 안정화 전략` 으로 최종 결정.
- 2026-04-18: 전략 C를 "오프닝 사전 생성 재사용(미구현)"에서 **"Warmup Padding + Trim(구현·검증 완료)"**으로 교체. Phase 1 A/B 청취로 효과 확인, `enabled: true` 확정.
- 2026-05-01: lecture-02-03 씬 7 의 `リ` 잘림 인시던트를 계기로 **"첫 음 잘림 대응 플레이북"** 섹션 신설. seed 를 42 → 7 로 변경 (옵션 A 적용, 검증 완료). 머지 단계의 `assembleSceneAudio.headPaddingMs` 옵션도 안전망으로 신설 (#149).

# 강의 단위 TTS 마스터 오디오 씬 분할 설계

강의 전체를 하나의 긴 TTS 음성 파일로 생성한 뒤, 이를 현재 파이프라인이 요구하는 씬 단위 WAV 파일로 분할하는 설계 문서다.

대상 독자:

- 현재의 `scene-<id>.wav` + `durations.json` 구조를 유지하고 싶은 개발자
- TTS 결과의 화자 일관성을 높이기 위해 전체 강의 1파일 생성 후 분할을 검토하는 개발자
- Google AI Studio 웹 UI 또는 Gemini API로 강의 단위 TTS를 만든 뒤 현재의 씬 캐시 기반 렌더 구조에 반영하려는 개발자

## 결론

기술적으로 가능하다.

다만 핵심은 "오디오 길이를 문자 수로 비례 분배해서 자르는 것"이 아니다. 권장 방식은 다음 3단계다.

1. 강의 전체 스크립트와 마스터 오디오를 강제 정렬한다.
2. 각 씬 텍스트가 실제로 몇 초부터 몇 초까지 발화되었는지 찾는다.
3. 씬 경계 근처의 저에너지 구간으로 컷 포인트를 미세 조정한 뒤 `scene-<id>.wav`와 `durations.json`을 만든다.

즉, 기준은 "문자 수"가 아니라 "텍스트-오디오 정렬 결과"다.

## 왜 가능한가

현재 파이프라인은 오디오 생성 방식 자체보다 아래 산출물을 소비한다.

- `packages/remotion/public/audio/<lectureId>/scene-<sceneId>.wav`
- `packages/remotion/public/audio/<lectureId>/durations.json`

즉 오디오가 원래부터 1씬 1파일이었는지, 아니면 강의 전체 1파일이었는지는 중요하지 않다. 최종적으로 씬별 WAV와 duration 메타데이터만 맞춰서 넣어주면 downstream은 그대로 동작한다.

## 핵심 질문: 특정 텍스트가 오디오의 몇 초 지점에서 읽혔는지를 찾을 수 있는가

가능하다.

하지만 이건 아래 방식이 아니다.

- 총 재생 시간을 구한다
- 총 문자 수를 센다
- 문자 수 비율로 초를 나눈다

이 방식은 보조 추정치 정도로만 쓸 수 있고, 최종 컷 포인트로 쓰기에는 정확도가 부족하다.

이유:

- 같은 문자 수라도 실제 발화 시간은 문장마다 크게 다르다.
- 쉼표, 마침표, 문단 전환에서 휴지가 들어간다.
- IT 용어, 숫자, URL, 영문 약어는 문자 수 대비 발화 시간이 길어질 수 있다.
- TTS도 문장 구조에 따라 호흡과 억양 길이가 달라진다.

따라서 실제로는 forced alignment가 필요하다.

## Forced Alignment란 무엇인가

Forced alignment는 "주어진 텍스트"와 "주어진 오디오"를 맞춰서, 어떤 구절이 몇 초에 발화되었는지 찾아주는 과정이다.

예를 들어 전체 스크립트가 아래와 같다고 하자.

```text
Scene 1: 前回の講義では...
Scene 2: 今日はその続きです...
Scene 3: ウェブサイトを作る技術は...
```

정렬 결과는 대략 이런 형태가 된다.

```json
{
  "segments": [
    {
      "text": "前回の講義では...",
      "start": 0.42,
      "end": 6.31
    },
    {
      "text": "今日はその続きです...",
      "start": 6.52,
      "end": 12.10
    }
  ]
}
```

여기서 중요한 점은 "문자 수로 추정"하는 것이 아니라, 오디오 파형과 음성 인식/정렬 모델을 이용해 실제 발화 위치를 찾는다는 것이다.

## LLM으로 생성된 오디오에서도 정확히 가능한가

가능하다. 그리고 사람 음성보다 오히려 더 유리한 편이다.

이유:

- 입력 원문이 이미 정확히 존재한다.
- TTS는 보통 원문과 매우 유사하게 발화한다.
- 동일 언어, 동일 문장 구조를 유지하므로 정렬 안정성이 높다.
- 강의 전체가 하나의 오디오라면 화자, 톤, 발화 특성이 일정해서 구간별 품질 편차도 상대적으로 작다.

물론 완벽 보장은 아니다. 아래 경우는 정렬 품질이 떨어질 수 있다.

- TTS가 숫자나 기호를 예상과 다르게 읽음
- URL, HTML, CSS, JavaScript, API 같은 용어의 발화 형태가 원문 표기와 다름
- 프롬프트 때문에 일부 문장이 paraphrase되거나 생략됨
- 생성 품질 문제로 특정 구절이 뭉개짐

그래도 전체적으로는 "강의 단위 TTS 마스터 오디오"는 강제 정렬에 충분히 적합한 입력이다.

## 문자 수 비례 방식은 어디까지 쓸 수 있는가

문자 수 비례 방식은 최종 분할용이 아니라 fallback 추정치로는 쓸 수 있다.

예:

- 정렬 엔진이 특정 구간만 실패했을 때 임시 추정
- 디버그 비교용 기준선
- 대략적인 예상 duration 계산

하지만 최종 `scene-<id>.wav`를 만들 때 이 방식만 쓰는 것은 권장하지 않는다.

## 권장 분할 방식

### 1. 전체 스크립트 조립

강의 JSON의 `sequence`를 순서대로 읽어서 전체 스크립트를 조립한다.

예시:

```json
[
  { "sceneId": 1, "text": "前回の講義では..." },
  { "sceneId": 2, "text": "今日はその続きです..." }
]
```

이 단계에서 각 씬이 전체 텍스트의 어느 범위를 차지하는지도 같이 기록한다.

### 2. 마스터 오디오 생성

입력:

- 전체 스크립트
- 음성 스타일 프롬프트

출력:

- `master.wav`

이 단계는 Google AI Studio 웹 UI로 할 수도 있고, Gemini API로 할 수도 있다.

### 3. 전체 스크립트와 `master.wav` 정렬

정렬 엔진은 아래 계열 중 하나를 사용할 수 있다.

- Whisper 계열 + word timestamp 확장
- WhisperX 계열
- stable-ts 계열
- 외부 forced alignment 도구

요구사항:

- 일본어 지원
- 오디오 전체에 대한 타임스탬프 반환
- 가능하면 단어 또는 구 단위 시각 반환
- 입력 텍스트를 기준으로 정렬 가능

현재 구현은 정렬 엔진 자체를 저장소 안에 포함하지 않고, 외부에서 생성한 `alignment.json`을 입력으로 받는다.

자동 생성 경로도 구현되어 있다. 현재 저장소는 `faster-whisper`를 사용해 다음 순서로 `alignment.json`을 만들 수 있다.

1. `lecture.json`의 씬 narration을 이어붙여 전체 스크립트 구성
2. `master.wav`를 Whisper로 전사하고 word timestamp 추출
3. 전사 텍스트와 원문 스크립트를 문자 단위로 정렬
4. 각 씬 narration의 시작/끝 시각을 계산
5. `alignment.json` 저장

최소 요구 형식은 다음과 같다.

```json
{
  "segments": [
    {
      "text": "前回の講義では、ブラウザにURLを入力したときに...",
      "start": 0.42,
      "end": 6.31
    },
    {
      "text": "今日はその続きです。",
      "start": 6.52,
      "end": 12.10
    }
  ]
}
```

더 세밀한 결과가 있으면 `words` 배열도 사용할 수 있다.

```json
{
  "segments": [
    {
      "text": "今日はその続きです。",
      "start": 6.52,
      "end": 12.10,
      "words": [
        { "text": "今日は", "start": 6.52, "end": 7.20 },
        { "text": "その", "start": 7.20, "end": 7.55 },
        { "text": "続きです", "start": 7.55, "end": 8.61 }
      ]
    }
  ]
}
```

`words`가 있으면 구현은 단어 단위 정렬 결과를 우선 사용하고, 없으면 `segments` 단위 결과를 사용한다.

### 4. 씬별 시작/끝 시각 계산

각 씬 텍스트의 첫 발화 시각과 마지막 발화 시각을 계산한다.

예:

- 씬 7 시작 = `125.38s`
- 씬 7 종료 = `142.91s`

이 값이 씬 경계의 1차 기준이 된다.

### 5. 경계 근처 저에너지 구간으로 미세 조정

정렬 결과 그대로 자르면 호흡이 잘리거나 단어 끝이 어색할 수 있다.

그래서 경계 근처 예를 들어 `±0.5s ~ ±1.0s` 범위에서 아래를 확인한다.

- RMS 최소 구간
- dBFS가 낮은 구간
- 필요하면 VAD 기준 비발화 구간

이 구간 중 가장 자연스러운 컷 포인트로 미세 조정한다.

즉 저에너지 탐지는 "경계를 찾아내는 메인 알고리즘"이 아니라, "정렬로 찾은 경계를 자연스럽게 다듬는 보조 알고리즘"이다.

## 무음이나 저에너지 구간은 어떻게 인식하는가

오디오를 짧은 프레임 단위로 나누고 각 프레임의 에너지를 계산하면 된다.

기본 개념:

- 오디오를 예를 들어 10ms 또는 20ms 프레임으로 나눈다.
- 각 프레임의 RMS 또는 dBFS를 구한다.
- 일정 시간 이상 에너지가 낮으면 저에너지 구간으로 본다.

예:

- 프레임 길이: 20ms
- 탐색 윈도우: 경계 전후 600ms
- 최소 저에너지 길이: 100ms

이렇게 하면 "문장 끝의 짧은 쉼" 같은 구간을 찾을 수 있다.

하지만 이 값만으로 씬 경계를 새로 추론하지는 않는다. 정렬 결과 근처에서만 사용한다.

## 입력과 출력

### 입력

- 강의 JSON
  - 예: `data/lecture-03.json`
- 강의 단위 TTS 마스터 오디오
  - 예: `input/master-audio/lecture-03/master.wav`

### 출력

- 씬별 WAV
  - `packages/remotion/public/audio/lecture-03/scene-1.wav`
  - `packages/remotion/public/audio/lecture-03/scene-2.wav`
  - ...
- duration 메타데이터
  - `packages/remotion/public/audio/lecture-03/durations.json`
- 디버그 산출물
  - `tmp/audio-segmentation/lecture-03/alignment.json`
  - `tmp/audio-segmentation/lecture-03/segments.json`

## ffmpeg 컷팅

최종 start/end가 정해지면 ffmpeg로 씬별 WAV를 만든다.

예시:

```bash
ffmpeg -i master.wav \
  -ss 125.38 \
  -to 143.08 \
  -ar 24000 \
  -ac 1 \
  -sample_fmt s16 \
  scene-7.wav
```

주의:

- 현재 저장소는 WAV 헤더와 샘플레이트를 일정하게 가정하는 부분이 있으므로 출력 포맷을 고정해야 한다.
- 모든 씬 WAV는 동일 포맷이어야 한다.

권장 출력 포맷:

- PCM WAV
- mono
- 24kHz
- 16-bit signed integer

## `durations.json` 생성

컷팅이 끝나면 각 씬 WAV 길이를 읽어서 `durations.json`을 만든다.

예시:

```json
{
  "1": 12.48,
  "2": 8.21,
  "3": 15.04
}
```

이 파일이 있으면 기존 렌더 단계는 변경 없이 동작한다.

## 추천 CLI 설계

신규 CLI 예시:

- `packages/automation/src/presentation/cli/import-master-audio.ts`

역할:

1. 마스터 오디오 입력 검증
2. 강의 JSON 로드
3. 전체 스크립트 조립
4. 정렬 엔진 호출
5. 씬별 경계 계산
6. 경계 주변 저에너지 구간으로 미세 조정
7. 씬별 WAV 출력
8. `durations.json` 저장
9. 디버그 리포트 저장

예시 사용법:

```bash
node packages/automation/dist/presentation/cli/import-master-audio.js lecture-03.json input/master-audio/lecture-03/master.wav tmp/audio-segmentation/lecture-03/alignment.json
```

현재 구현 기준 실제 사용법은 다음과 같다.

```bash
node packages/automation/dist/presentation/cli/import-master-audio.js \
  lecture-03.json \
  input/master-audio/lecture-03/master.wav \
  tmp/audio-segmentation/lecture-03/alignment.json
```

자동 생성까지 포함한 전체 흐름은 다음과 같다.

```bash
make import-master-audio-auto \
  LECTURE=lecture-03.json \
  AUDIO=input/master-audio/lecture-03/master.wav \
  MODEL=small
```

## 디버그 산출물 설계

분할은 틀렸을 때 눈으로 검증할 수 있어야 한다. 아래 파일을 남기는 것을 권장한다.

### `alignment.json`

정렬 원본 결과 저장.

### `segments.json`

씬별 계산 결과 저장.

예시:

```json
[
  {
    "sceneId": 7,
    "textStart": 125.38,
    "textEnd": 142.91,
    "adjustedStart": 125.31,
    "adjustedEnd": 143.08,
    "durationSec": 17.77,
    "method": "alignment+energy-adjust"
  }
]
```

## 실패 케이스와 대응

### 1. 원문과 생성된 발화가 다름

예:

- 숫자 읽기 방식 차이
- 영문 약어 읽기 방식 차이
- 특수 기호 발화 차이
- 일부 문장 생략 또는 반복

영향:

- 정렬 품질이 떨어질 수 있다.

대응:

- TTS 생성용 원문을 가능한 고정
- 용어 표기를 발화 친화적으로 정규화
- 정렬 실패 씬만 수동 컷 포인트 지정 가능하게 설계

### 2. 씬 사이에 저에너지 구간이 거의 없음

영향:

- 경계 미세 조정 폭이 줄어든다.

대응:

- 정렬 결과를 우선 사용
- 과도한 이동 없이 작은 패딩만 적용

### 3. 정렬 엔진이 특정 구간을 잘못 맞춤

영향:

- 특정 씬 시작/끝 시각이 흔들릴 수 있다.

대응:

- alignment 결과 저장
- segments.json으로 검수
- 필요하면 씬별 오버라이드 타임코드 지원

## 왜 전체 1파일 전략이 실용적인가

현재 목표가 "화자 일관성"이라면 전체 1파일 생성은 가장 강한 방법이다.

장점:

- 같은 음색과 말투가 유지되기 쉽다.
- 씬별 생성보다 화자 미세 변동이 줄어든다.
- 긴 TTS를 현재 구조에 맞게 재분할할 수 있다.

단점:

- 대본 수정 시 재생성 비용이 크다.
- 분할 단계가 추가된다.
- 정렬 품질 검증이 필요하다.

운영 전략:

- 초안 단계: 기존 씬별 TTS 유지
- 최종 단계: 강의 단위 TTS 1파일 생성 후 분할

이렇게 이원화하면 제작 속도와 최종 품질을 같이 챙길 수 있다.

## 요약

강의 단위 TTS 마스터 오디오를 씬 단위로 구분하는 것은 충분히 가능하다.

핵심은 아래 조합이다.

- 전체 스크립트와 오디오를 정렬해서 어떤 텍스트가 어느 시각에 발화되었는지 찾는다.
- 그 경계 근처의 저에너지 구간으로 컷 포인트를 자연스럽게 다듬는다.
- 최종적으로 기존 파이프라인이 요구하는 씬별 WAV와 duration 메타데이터로 변환한다.

즉, 이 문제는 "총 길이와 문자 수를 나누는 단순 계산" 문제가 아니라, "텍스트-오디오 정렬" 문제다.

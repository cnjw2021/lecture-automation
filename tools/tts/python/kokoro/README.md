# Kokoro-82M (kokoro-onnx) 일본어 TTS

CPU-only Intel Mac 환경에서 동작하는 Kokoro-82M ONNX 변형. PoC 단계.

## 라이선스

- 모델 가중치: Apache-2.0 (Hugging Face `hexgrad/Kokoro-82M`)
- 런타임: `kokoro-onnx` (https://github.com/thewh1teagle/kokoro-onnx)
- 일본어 G2P: `misaki[ja]`

## 설치

프로젝트 루트에서:

```bash
make tts-bootstrap-kokoro
```

수동 설치 (참고용):

```bash
cd tools/tts/python/kokoro
uv sync                 # .venv 생성 + 의존성 설치
mkdir -p models
cd models
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
```

URL 이 404 나면 https://github.com/thewh1teagle/kokoro-onnx/releases 에서 최신 자산을 받으세요.

## 사용 (config/tts.json)

```json
{
  "activeProvider": "kokoro",
  "providers": {
    "kokoro": {
      "voice": "jf_alpha",
      "modelPath": "models/kokoro-v1.0.onnx",
      "voicesPath": "models/voices-v1.0.bin",
      "speed": 1.0,
      "g2pMode": "auto"
    }
  }
}
```

`make run-tts-only LECTURE=lecture-XX.json SCENE='1 2 3'` 로 검증.

### 일본어 보이스 후보

`jf_alpha`, `jf_gongitsune`, `jf_nezumi`, `jf_tebukuro`, `jm_kumo`

### g2pMode

- `auto` (기본): 우선 `kokoro.create(text, lang="ja")` 시도 → 실패 시 `misaki[ja]` 로 phoneme 변환 후 `is_phonemes=True` 로 재시도
- `direct`: 항상 `lang="ja"` 직접 호출
- `phoneme`: 항상 `misaki[ja]` 로 phoneme 변환 후 호출

품질이 이상하면 `phoneme` 모드를 우선 시도해보세요.

## 알려진 제약

- 일본어 학습 데이터가 영어보다 얇음. 다의 한자 오독 (`方`, `生`, `行`, `長`, `日`) 가능성 있음.
- 짧은 문장(<10토큰) 에서 prosody 가 무너질 수 있음. 워크업 패딩이나 문장 결합으로 우회.
- alignment(문자 단위 타임스탬프) 미지원 → ElevenLabs 의 sync-playwright 워크플로 비호환.

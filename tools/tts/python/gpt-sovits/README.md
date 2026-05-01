# GPT-SoVITS 일본어 TTS (CPU)

음성 클로닝 + 다국어. 4개 PoC 후보 중 가장 설치 난이도가 높음.

## 라이선스

- 코드: MIT (https://github.com/RVC-Boss/GPT-SoVITS).
- 사전학습 모델: 모델별 별도 라이선스/배포 정책. 다운로드 전 README 의 모델 카드를 확인하세요.
- 참조 음성 (reference WAV) 은 본인이 권리를 가진 음성을 사용. 타인 음성 복제는 동의 필요.

## 설치 (수동 단계 다수)

```bash
make tts-bootstrap-gpt-sovits
```

위 타겟이 자동 처리하는 작업:

1. `tools/tts/python/gpt-sovits/.venv` 생성 + Python 의존성 설치.
2. `models/GPT-SoVITS/` 에 https://github.com/RVC-Boss/GPT-SoVITS 클론.
3. 사전학습 모델 다운로드 안내 출력 (각 모델은 사용자가 라이선스 확인 후 직접 다운로드).

수동으로 해야 할 작업:

- 사전학습 모델 다운로드: GPT-SoVITS 의 README → "Pretrained Models" 섹션에서 안내된 경로 (HuggingFace `lj1995/GPT-SoVITS`) 에서 받아 `models/GPT-SoVITS/GPT_SoVITS/pretrained_models/` 에 배치.
- 참조 음성 준비: 3~10초 mono WAV + 정확한 전사 텍스트.

## 사용 (config/tts.json)

```json
{
  "activeProvider": "gpt_sovits",
  "providers": {
    "gpt_sovits": {
      "repoPath": "models/GPT-SoVITS",
      "gptModelPath": "models/GPT-SoVITS/GPT_SoVITS/pretrained_models/s1bert25hz-2kh-longer-epoch=68e-step=50232.ckpt",
      "sovitsModelPath": "models/GPT-SoVITS/GPT_SoVITS/pretrained_models/s2G488k.pth",
      "refWavPath": "models/reference.wav",
      "refText": "참조 음성의 전사 텍스트를 그대로 입력",
      "refLanguage": "ja",
      "targetLanguage": "ja",
      "topK": 5,
      "topP": 1.0,
      "temperature": 1.0,
      "speed": 1.0
    }
  }
}
```

## 알려진 제약 / 주의

- **CPU 모드 강제**: `synth.py` 가 `IS_HALF=False`, `USE_CPU=True`, `CUDA_VISIBLE_DEVICES=""` 환경변수를 설정하지만, GPT-SoVITS 버전에 따라 일부 모듈이 fp16 코드 경로를 강제로 타는 경우가 있어 직접 패치가 필요할 수 있습니다.
- **inference 함수 시그니처 변동**: `get_tts_wav` 의 인자 이름은 GPT-SoVITS 버전에 따라 미세하게 다릅니다. import 실패 시 본 `synth.py` 의 import 경로/인자명을 클론된 코드에 맞춰 수정하세요.
- CPU RTF 1~3 예상.
- alignment 미지원.

본 엔진은 4개 후보 중 가장 fragile 합니다. 합성이 통과하지 않으면 Kokoro / XTTS 결과만으로 1차 비교를 진행해도 됩니다.

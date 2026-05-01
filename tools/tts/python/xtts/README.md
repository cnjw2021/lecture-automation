# XTTS-v2 (Coqui) 일본어 TTS

Voice cloning 가능한 다국어 TTS. CPU 추론 가능하지만 무거움 (Intel Mac i5 기준 RTF > 2 예상).

## 라이선스 (필수 확인)

- 모델 가중치: **Coqui Public Model License (CPML)**. 비상업/제한적 상업 사용 라이선스.
- 사용 전 https://coqui.ai/cpml 전문을 확인하고 본인의 사용 범위가 허용되는지 직접 검토하세요.
- 라이선스 동의는 `COQUI_TOS_AGREED=1` 환경변수 또는 첫 실행 시 stdin 입력으로 표시됩니다. 본 PoC 스크립트는 자동 동의를 만들지 않습니다.

## 설치

```bash
make tts-bootstrap-xtts
```

수동 설치:

```bash
cd tools/tts/python/xtts
uv sync
mkdir -p models
# voice cloning 참조 음성 준비: 6~30초 mono WAV
# 본인이 권리를 가진 음성 사용. 강의 운영자 본인 녹음 권장.
cp /path/to/your-reference-voice.wav models/speaker.wav
```

모델 가중치는 첫 합성 시 `coqui-tts` 가 `~/Library/Application Support/tts/` 등에 자동 다운로드합니다 (CPML 동의 후).

## 사용 (config/tts.json)

```json
{
  "activeProvider": "xtts",
  "providers": {
    "xtts": {
      "modelName": "tts_models/multilingual/multi-dataset/xtts_v2",
      "speakerWavPath": "models/speaker.wav",
      "language": "ja",
      "temperature": 0.7,
      "length_penalty": 1.0
    }
  }
}
```

## 알려진 제약

- CPU 합성이 매우 느림. RTF 2~5 예상 (10초 오디오 = 20~50초 합성).
- 짧은 참조 음성(<6초) 은 음색 안정도 저하.
- 일본어 prosody 가 ElevenLabs 대비 단조로울 수 있음.
- alignment 미지원.

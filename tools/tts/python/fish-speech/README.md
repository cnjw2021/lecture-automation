# Fish Speech 일본어 TTS

음성 클로닝 + 다국어 (한·중·일·영). 본 PoC 는 fish-speech 1.5 기준.

## 라이선스 (필수 확인)

- **Fish Audio Research License** (https://github.com/fishaudio/fish-speech/blob/main/LICENSE).
- 버전별 라이선스 변동 이력이 있어 사용 시점의 LICENSE 와 모델 카드 라이선스를 직접 확인.
- 상업/배포 사용 가능 여부는 본인이 직접 검토.

## 설치

```bash
make tts-bootstrap-fish-speech
```

위 타겟이 자동 처리하는 작업:

1. `tools/tts/python/fish-speech/.venv` 생성 + Python 의존성 설치.
2. `models/fish-speech/` 에 https://github.com/fishaudio/fish-speech 클론.
3. `uv pip install -e models/fish-speech` (editable install).
4. 모델 가중치 다운로드는 **수동**:
   - https://huggingface.co/fishaudio/fish-speech-1.5 (라이선스 동의 후)
   - `models/fish-speech/checkpoints/fish-speech-1.5/` 에 배치.

## 사용 (config/tts.json)

```json
{
  "activeProvider": "fish_speech",
  "providers": {
    "fish_speech": {
      "repoPath": "models/fish-speech",
      "checkpointDir": "models/fish-speech/checkpoints/fish-speech-1.5",
      "referenceAudioPath": "models/reference.wav",
      "referenceText": "참조 음성 전사 텍스트",
      "temperature": 0.7,
      "topP": 0.7
    }
  }
}
```

`referenceAudioPath` 와 `referenceText` 는 voice cloning 시 권장 (없으면 기본 보이스).

## 알려진 제약 / 주의

- **API 시그니처 변동**: fish-speech 는 1.x → 2.x 사이에 inference API 가 크게 바뀝니다. 본 synth.py 는 1.5 기준이므로, 다른 버전 사용 시 import 경로/호출 인자 수정이 필요합니다.
- CPU RTF 1~3 예상 (Intel Mac i5 기준).
- 짧은 참조 음성(<5초) 에서는 음색 안정도 저하.
- alignment 미지원.

본 엔진 역시 GPT-SoVITS 와 마찬가지로 합성 통과까지 추가 작업이 필요할 수 있습니다.

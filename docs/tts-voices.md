# TTS 보이스 비교

## Google Cloud TTS — Chirp3-HD (일본어)

최고 품질 모델. 동일 입력에도 출력이 미세하게 달라지는 생성형 모델.

| 보이스 | 톤 | 강의 적합도 |
|---|---|---|
| `ja-JP-Chirp3-HD-Charon` | 차분하고 안정적 | ⭐⭐⭐⭐⭐ |
| `ja-JP-Chirp3-HD-Fenrir` | 힘있고 명확 | ⭐⭐⭐⭐ |
| `ja-JP-Chirp3-HD-Orus` | 깊고 무게감 있음 | ⭐⭐⭐⭐ |
| `ja-JP-Chirp3-HD-Puck` | 밝고 경쾌 | ⭐⭐⭐ |

설정 위치: `config/tts.json` → `providers.google_cloud_tts.voiceName`

---

## Gemini Cloud TTS — gemini-2.5-pro-tts

생성형 모델. 씬마다 톤이 미세하게 달라질 수 있음.

| 보이스 | 톤 | 강의 적합도 |
|---|---|---|
| `Orus` | 깊고 안정적 | ⭐⭐⭐⭐⭐ |
| `Charon` | 차분하고 정보 전달적 | ⭐⭐⭐⭐⭐ |
| `Fenrir` | 강하고 자신감 있음 | ⭐⭐⭐⭐ |
| `Altair` | 단호하고 권위있음 | ⭐⭐⭐⭐ |
| `Puck` | 명랑하고 가벼움 | ⭐⭐⭐ |

설정 위치: `config/tts.json` → `providers.gemini_cloud_tts.voiceName`

---

## ElevenLabs — eleven_v3

표현력이 강하고 품질이 우수한 편. 이 저장소에서는 ElevenLabs 기본 모델로 `eleven_v3`를 사용합니다. `stability`, `similarity_boost`, `style`, `seed`를 함께 조정할 수 있음.

설정 위치: `config/tts.json` → `providers.elevenlabs`

---

## 샘플 생성

```bash
make tts-sample TTS=google_cloud_tts
make tts-sample TTS=gemini_cloud_tts
make tts-sample TTS=elevenlabs
```

출력 파일: `output/tts-samples/sample-{provider}-{voice}-rate{rate}-{timestamp}.wav`

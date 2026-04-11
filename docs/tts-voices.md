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

`config/tts.json`의 `providers.elevenlabs.chunkedGeneration.enabled=true`이면 긴 강의를 청크 단위로 생성한 뒤 씬별 WAV로 분할합니다. 이 모드는 음색 일관성에 유리하지만, 경계 부근의 짧은 음절은 문자 단위 alignment 해석에 따라 일부 씬에서 애매하게 잘릴 수 있습니다.

운영 기준:

- 텍스트 수정, 발음 수정: `make regen-scene LECTURE=... SCENE='...'`
- 경계 잘림, 다음 씬 꼬리 유입: `make resplit-chunk-audio LECTURE=... SCENE='...'`
- 자동 보정으로도 해결되지 않는 경계: 해당 씬만 `regen-scene`

청크 생성 후에는 `tmp/chunked-audio/<lectureId>/` 아래에 원본 WAV, alignment, manifest, boundary diagnostics가 저장되므로 재-TTS 없이 재분할을 시도할 수 있습니다.

설정 위치: `config/tts.json` → `providers.elevenlabs`

---

## 샘플 생성

```bash
make tts-sample TTS=google_cloud_tts
make tts-sample TTS=gemini_cloud_tts
make tts-sample TTS=elevenlabs
```

출력 파일: `output/tts-samples/sample-{provider}-{voice}-rate{rate}-{timestamp}.wav`

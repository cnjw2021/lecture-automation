"""Kokoro-82M (kokoro-onnx) 일본어 합성 진입점.

호출 흐름:
1. PythonTtsBridge 가 stdin 으로 JSON 요청을 보낸다.
2. Kokoro 모델·보이스 파일을 로드 (./models/ 기본 경로).
3. 일본어는 misaki[ja] 로 phoneme 변환 후 is_phonemes=True 로 합성.
   직접 lang="ja" 호출이 가능한 빌드면 그 경로도 시도.
4. 결과 샘플을 16-bit PCM WAV 로 저장하고 stdout 으로 응답 JSON 출력.

engineParams (config/tts.json providers.kokoro):
- modelPath: ONNX 모델 절대/상대 경로 (기본 models/kokoro-v1.0.onnx)
- voicesPath: 보이스 bin 경로 (기본 models/voices-v1.0.bin)
- speed: 합성 속도 배율 (기본 1.0)
- g2pMode: "auto" | "direct" | "phoneme" (기본 "auto")
"""

from __future__ import annotations

import os
import sys
import traceback

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(THIS_DIR, "..")))

from _common import protocol  # noqa: E402


def resolve_path(p: str) -> str:
    if os.path.isabs(p):
        return p
    return os.path.normpath(os.path.join(THIS_DIR, p))


def build_phonemes_ja(text: str) -> str:
    """misaki[ja] 로 일본어 텍스트를 phoneme 문자열로 변환."""
    from misaki import ja  # type: ignore

    g2p = ja.JAG2P()
    result = g2p(text)
    # misaki API 는 버전에 따라 (phonemes, tokens) 또는 phonemes 단일 반환
    if isinstance(result, tuple):
        return result[0]
    return result


def synthesize_kokoro(
    text: str,
    voice: str,
    model_path: str,
    voices_path: str,
    speed: float,
    g2p_mode: str,
) -> tuple[object, int]:
    from kokoro_onnx import Kokoro  # type: ignore

    protocol.log(f"Kokoro 모델 로드: {model_path}")
    protocol.log(f"보이스 파일 로드: {voices_path}")
    kokoro = Kokoro(model_path, voices_path)

    if g2p_mode == "phoneme":
        phonemes = build_phonemes_ja(text)
        protocol.log(f"misaki[ja] phoneme: {phonemes[:60]}...")
        samples, sr = kokoro.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
        return samples, sr

    if g2p_mode == "direct":
        samples, sr = kokoro.create(text, voice=voice, speed=speed, lang="ja")
        return samples, sr

    # auto: direct → 실패 시 phoneme 으로 폴백
    try:
        samples, sr = kokoro.create(text, voice=voice, speed=speed, lang="ja")
        protocol.log("direct lang='ja' 합성 성공")
        return samples, sr
    except Exception as e:  # noqa: BLE001
        protocol.log(f"direct 합성 실패 ({e}) → misaki[ja] phoneme 폴백")
        phonemes = build_phonemes_ja(text)
        samples, sr = kokoro.create(phonemes, voice=voice, speed=speed, is_phonemes=True)
        return samples, sr


def main() -> int:
    try:
        req = protocol.SynthRequest.from_stdin()
    except Exception as e:  # noqa: BLE001
        protocol.respond_error(f"요청 파싱 실패: {e}", "InvalidRequest")
        return 1

    try:
        params = req.engine_params
        model_path = resolve_path(params.get("modelPath") or "models/kokoro-v1.0.onnx")
        voices_path = resolve_path(params.get("voicesPath") or "models/voices-v1.0.bin")
        speed = float(params.get("speed") or 1.0)
        g2p_mode = str(params.get("g2pMode") or "auto").lower()

        if not os.path.exists(model_path):
            protocol.respond_error(
                f"Kokoro 모델 파일이 없습니다: {model_path}. "
                f"make tts-bootstrap-kokoro 로 다운로드하세요.",
                "ModelNotFound",
            )
            return 1
        if not os.path.exists(voices_path):
            protocol.respond_error(
                f"Kokoro 보이스 파일이 없습니다: {voices_path}. "
                f"make tts-bootstrap-kokoro 로 다운로드하세요.",
                "ModelNotFound",
            )
            return 1

        samples, src_rate = synthesize_kokoro(
            text=req.text,
            voice=req.voice,
            model_path=model_path,
            voices_path=voices_path,
            speed=speed,
            g2p_mode=g2p_mode,
        )

        # Kokoro 기본 출력 24000Hz mono. 요청 sampleRate 와 다르면 리샘플.
        if src_rate != req.sample_rate:
            protocol.log(f"리샘플: {src_rate}Hz → {req.sample_rate}Hz")
            samples = protocol.resample_to(samples, src_rate, req.sample_rate)

        if req.channels != 1:
            protocol.respond_error(
                f"Kokoro 는 mono 출력만 지원하지만 channels={req.channels} 가 요청됨",
                "UnsupportedConfig",
            )
            return 1

        duration = protocol.write_wav_float32(
            req.output_path,
            samples,
            sample_rate=req.sample_rate,
            channels=1,
        )
        protocol.log(f"합성 완료: {duration:.2f}초")
        protocol.respond_ok(req.output_path, duration)
        return 0
    except Exception as e:  # noqa: BLE001
        protocol.log(traceback.format_exc())
        protocol.respond_error(str(e), type(e).__name__)
        return 1


if __name__ == "__main__":
    sys.exit(main())

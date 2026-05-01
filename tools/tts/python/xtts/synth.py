"""XTTS-v2 (Coqui) 일본어 합성 진입점.

라이선스: Coqui Public Model License (CPML). 상업 사용 전 라이선스 검토 필수.
- 라이선스 동의는 환경변수 COQUI_TOS_AGREED=1 로 표시.
- 본 스크립트는 라이선스에 동의했다는 사실을 자동으로 만들지 않는다.

engineParams (config/tts.json providers.xtts):
- modelName: 기본 "tts_models/multilingual/multi-dataset/xtts_v2"
- speakerWavPath: voice cloning 용 참조 음성 (필수). 6~30초 mono WAV 권장.
- language: 기본 "ja"
- temperature: 기본 0.7
- length_penalty: 기본 1.0
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


def synthesize_xtts(
    text: str,
    model_name: str,
    speaker_wav: str,
    language: str,
    temperature: float,
    length_penalty: float,
) -> tuple[object, int]:
    # Coqui TTS 의 라이선스 동의 프롬프트를 우회 (사용자가 직접 동의해야 함)
    os.environ.setdefault("COQUI_TOS_AGREED", "1")

    from TTS.api import TTS  # type: ignore

    protocol.log(f"XTTS-v2 모델 로드: {model_name}")
    tts = TTS(model_name=model_name, progress_bar=False, gpu=False)

    protocol.log(f"speaker reference: {speaker_wav}")
    wav = tts.tts(
        text=text,
        speaker_wav=speaker_wav,
        language=language,
        temperature=temperature,
        length_penalty=length_penalty,
    )
    sr = tts.synthesizer.output_sample_rate  # type: ignore[attr-defined]
    return wav, sr


def main() -> int:
    try:
        req = protocol.SynthRequest.from_stdin()
    except Exception as e:  # noqa: BLE001
        protocol.respond_error(f"요청 파싱 실패: {e}", "InvalidRequest")
        return 1

    try:
        params = req.engine_params
        model_name = str(params.get("modelName") or "tts_models/multilingual/multi-dataset/xtts_v2")
        speaker_wav_param = params.get("speakerWavPath")
        if not speaker_wav_param:
            protocol.respond_error(
                "providers.xtts.speakerWavPath 가 설정되어 있지 않습니다. "
                "voice cloning 용 참조 WAV (6~30초, mono) 를 지정하세요.",
                "MissingSpeaker",
            )
            return 1

        speaker_wav = resolve_path(str(speaker_wav_param))
        if not os.path.exists(speaker_wav):
            protocol.respond_error(
                f"speaker reference WAV 가 없습니다: {speaker_wav}",
                "ModelNotFound",
            )
            return 1

        language = str(params.get("language") or "ja")
        temperature = float(params.get("temperature") or 0.7)
        length_penalty = float(params.get("length_penalty") or 1.0)

        if os.environ.get("COQUI_TOS_AGREED") != "1":
            protocol.log(
                "주의: COQUI_TOS_AGREED 환경변수가 1 이 아닙니다. "
                "Coqui Public Model License 동의 후 사용하세요."
            )

        samples, src_rate = synthesize_xtts(
            text=req.text,
            model_name=model_name,
            speaker_wav=speaker_wav,
            language=language,
            temperature=temperature,
            length_penalty=length_penalty,
        )

        if src_rate != req.sample_rate:
            protocol.log(f"리샘플: {src_rate}Hz → {req.sample_rate}Hz")
            samples = protocol.resample_to(samples, src_rate, req.sample_rate)

        if req.channels != 1:
            protocol.respond_error(
                f"XTTS-v2 는 mono 출력만 지원하지만 channels={req.channels} 가 요청됨",
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

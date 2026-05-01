"""Fish Speech 일본어 합성 진입점.

라이선스: Fish Audio Research License (https://github.com/fishaudio/fish-speech/blob/main/LICENSE).
- 버전별 라이선스 변동 이력이 있어 사용 시점의 LICENSE 와 모델 카드를 직접 확인.
- 본 PoC 는 모델 가중치 자동 다운로드를 만들지 않는다.

전제:
- bootstrap 스크립트가 https://github.com/fishaudio/fish-speech 를
  models/fish-speech/ 에 git clone 후 editable install.
- 모델 가중치는 huggingface 에서 받아 models/fish-speech/checkpoints/ 에 배치.

engineParams (config/tts.json providers.fish_speech):
- repoPath: fish-speech 클론 디렉토리 (기본 "models/fish-speech")
- checkpointDir: 모델 가중치 디렉토리 (예: "models/fish-speech/checkpoints/fish-speech-1.5")
- referenceAudioPath: 참조 음성 WAV (선택, voice cloning 시)
- referenceText: 참조 음성 전사 텍스트 (선택)
- temperature, topP: 샘플링 파라미터
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


def synthesize_fish_speech(
    text: str,
    repo_path: str,
    checkpoint_dir: str,
    reference_audio: str | None,
    reference_text: str | None,
    temperature: float,
    top_p: float,
) -> tuple[object, int]:
    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    import torch  # type: ignore

    torch.set_default_dtype(torch.float32)
    device = "cpu"

    # Fish Speech 의 엔진 진입점은 버전마다 위치가 다르다.
    # 1.5: fish_speech.inference_engine.TTSInferenceEngine
    # 2.x: fish_speech.api.* 또는 fish_speech.inference.*
    try:
        from fish_speech.inference_engine import TTSInferenceEngine  # type: ignore

        protocol.log(f"Fish Speech 엔진 로드 (1.x): {checkpoint_dir}")
        engine = TTSInferenceEngine.from_pretrained(
            checkpoint_dir,
            device=device,
            precision=torch.float32,
        )
        result = engine.tts(
            text=text,
            reference_audio=reference_audio,
            reference_text=reference_text,
            temperature=temperature,
            top_p=top_p,
        )
        # result 형태: (samples: np.ndarray, sample_rate: int) 가정
        if isinstance(result, tuple) and len(result) == 2:
            samples, sr = result
            return samples, int(sr)
        # dict 반환 빌드
        if isinstance(result, dict) and "audio" in result:
            return result["audio"], int(result.get("sample_rate", 44100))
        raise RuntimeError(f"예상치 못한 Fish Speech 응답 형식: {type(result)}")
    except ImportError as e:
        raise ImportError(
            f"Fish Speech import 실패: {e}. "
            f"models/fish-speech/ 클론 + editable install 이 정상인지, "
            f"버전에 따라 본 synth.py 의 import 경로를 조정해야 할 수 있습니다."
        )


def main() -> int:
    try:
        req = protocol.SynthRequest.from_stdin()
    except Exception as e:  # noqa: BLE001
        protocol.respond_error(f"요청 파싱 실패: {e}", "InvalidRequest")
        return 1

    try:
        params = req.engine_params
        repo_path = resolve_path(str(params.get("repoPath") or "models/fish-speech"))
        checkpoint_dir_param = params.get("checkpointDir")
        if not checkpoint_dir_param:
            protocol.respond_error(
                "providers.fish_speech.checkpointDir 가 설정되어 있지 않습니다.",
                "InvalidRequest",
            )
            return 1
        checkpoint_dir = resolve_path(str(checkpoint_dir_param))

        ref_audio_param = params.get("referenceAudioPath")
        reference_audio = resolve_path(str(ref_audio_param)) if ref_audio_param else None
        reference_text = str(params.get("referenceText") or "") or None
        temperature = float(params.get("temperature") or 0.7)
        top_p = float(params.get("topP") or 0.7)

        if not os.path.exists(repo_path):
            protocol.respond_error(
                f"Fish Speech 클론이 없습니다: {repo_path}. "
                f"make tts-bootstrap-fish-speech 로 설치하세요.",
                "ModelNotFound",
            )
            return 1
        if not os.path.exists(checkpoint_dir):
            protocol.respond_error(
                f"Fish Speech 가중치 디렉토리가 없습니다: {checkpoint_dir}. "
                f"라이선스 동의 후 huggingface 에서 직접 다운로드하세요.",
                "ModelNotFound",
            )
            return 1
        if reference_audio and not os.path.exists(reference_audio):
            protocol.respond_error(
                f"Fish Speech 참조 음성이 없습니다: {reference_audio}",
                "ModelNotFound",
            )
            return 1

        samples, src_rate = synthesize_fish_speech(
            text=req.text,
            repo_path=repo_path,
            checkpoint_dir=checkpoint_dir,
            reference_audio=reference_audio,
            reference_text=reference_text,
            temperature=temperature,
            top_p=top_p,
        )

        if src_rate != req.sample_rate:
            protocol.log(f"리샘플: {src_rate}Hz → {req.sample_rate}Hz")
            samples = protocol.resample_to(samples, src_rate, req.sample_rate)

        if req.channels != 1:
            protocol.respond_error(
                f"Fish Speech 는 mono 출력만 지원하지만 channels={req.channels} 가 요청됨",
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

"""GPT-SoVITS 일본어 합성 진입점 (CPU FP32 강제).

GPT-SoVITS 는 PyPI 의 안정 배포본이 없어, 본 PoC 는 다음 전제를 따른다:
- bootstrap 스크립트가 https://github.com/RVC-Boss/GPT-SoVITS 를
  models/GPT-SoVITS/ 에 git clone.
- 사전학습 모델은 별도 다운로드 (라이선스/배포 정책 확인 후).
- 본 synth.py 는 그 클론 디렉토리를 sys.path 에 넣고 inference API 를 호출.

CPU 강제:
- 환경변수 IS_HALF=False, USE_CPU=True 를 export.
- torch device="cpu" 로 모델 로드.
- 일부 빌드는 fp16 코드 경로가 남아 있어 IS_HALF 플래그를 직접 패치해야 할 수 있음.

engineParams (config/tts.json providers.gpt_sovits):
- repoPath: GPT-SoVITS 클론 디렉토리 (기본 "models/GPT-SoVITS")
- gptModelPath: GPT 가중치 .ckpt 절대/상대 경로
- sovitsModelPath: SoVITS 가중치 .pth 절대/상대 경로
- refWavPath: 참조 음성 WAV (3~10초 권장)
- refText: 참조 음성의 전사 텍스트
- refLanguage: 참조 음성 언어 (기본 "ja")
- targetLanguage: 합성 대상 언어 (기본 "ja")
- topK, topP, temperature, speed: GPT 샘플링 파라미터
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


def force_cpu_env() -> None:
    """CPU FP32 강제. import 전에 호출되어야 일부 코드 경로에서 효과."""
    os.environ["IS_HALF"] = "False"
    os.environ["USE_CPU"] = "True"
    os.environ["CUDA_VISIBLE_DEVICES"] = ""


LANGUAGE_MAP = {
    "ja": "all_ja",
    "japanese": "all_ja",
    "en": "en",
    "english": "en",
    "zh": "all_zh",
    "chinese": "all_zh",
    "ko": "all_ko",
    "korean": "all_ko",
}


def synthesize_gpt_sovits(
    text: str,
    repo_path: str,
    gpt_model_path: str,
    sovits_model_path: str,
    ref_wav_path: str,
    ref_text: str,
    ref_language: str,
    target_language: str,
    top_k: int,
    top_p: float,
    temperature: float,
    speed: float,
) -> tuple[object, int]:
    """GPT-SoVITS inference API 호출. 클론된 repo 의 inference_webui 모듈을 사용."""

    if repo_path not in sys.path:
        sys.path.insert(0, repo_path)

    import torch  # type: ignore

    torch.set_default_dtype(torch.float32)
    device = torch.device("cpu")

    # GPT-SoVITS 의 inference 모듈은 버전마다 위치/이름이 바뀐다.
    # 현 시점 (2025) 안정 진입점은 GPT_SoVITS/inference_webui.py 의 get_tts_wav.
    try:
        from GPT_SoVITS.inference_webui import (  # type: ignore
            change_gpt_weights,
            change_sovits_weights,
            get_tts_wav,
        )
    except ImportError as e:
        raise ImportError(
            f"GPT-SoVITS 클론에서 inference_webui 를 찾지 못했습니다: {e}. "
            f"repoPath={repo_path} 가 올바른지 확인하고, "
            f"GPT-SoVITS 버전에 따라 본 synth.py 의 import 경로를 조정해야 할 수 있습니다."
        )

    protocol.log(f"GPT 가중치 로드: {gpt_model_path}")
    change_gpt_weights(gpt_path=gpt_model_path)

    protocol.log(f"SoVITS 가중치 로드: {sovits_model_path}")
    change_sovits_weights(sovits_path=sovits_model_path)

    ref_lang = LANGUAGE_MAP.get(ref_language.lower(), ref_language)
    target_lang = LANGUAGE_MAP.get(target_language.lower(), target_language)

    protocol.log(f"합성 시작 (ref_lang={ref_lang}, target_lang={target_lang})")
    generator = get_tts_wav(
        ref_wav_path=ref_wav_path,
        prompt_text=ref_text,
        prompt_language=ref_lang,
        text=text,
        text_language=target_lang,
        how_to_cut="不切",
        top_k=top_k,
        top_p=top_p,
        temperature=temperature,
        ref_free=False,
        speed=speed,
        if_freeze=False,
        inp_refs=None,
    )

    sr = None
    audio_chunks = []
    for chunk_sr, chunk_audio in generator:
        sr = chunk_sr
        audio_chunks.append(chunk_audio)

    if not audio_chunks or sr is None:
        raise RuntimeError("get_tts_wav 가 빈 결과를 반환했습니다.")

    import numpy as np  # type: ignore

    full_audio = np.concatenate(audio_chunks).astype("float32")
    # GPT-SoVITS 출력은 보통 int16 범위. 정규화.
    if full_audio.max() > 1.0 or full_audio.min() < -1.0:
        full_audio = full_audio / 32767.0

    return full_audio, sr


def main() -> int:
    force_cpu_env()

    try:
        req = protocol.SynthRequest.from_stdin()
    except Exception as e:  # noqa: BLE001
        protocol.respond_error(f"요청 파싱 실패: {e}", "InvalidRequest")
        return 1

    try:
        params = req.engine_params
        repo_path = resolve_path(str(params.get("repoPath") or "models/GPT-SoVITS"))
        gpt_model_path = resolve_path(str(params.get("gptModelPath") or ""))
        sovits_model_path = resolve_path(str(params.get("sovitsModelPath") or ""))
        ref_wav_path = resolve_path(str(params.get("refWavPath") or ""))
        ref_text = str(params.get("refText") or "")
        ref_language = str(params.get("refLanguage") or "ja")
        target_language = str(params.get("targetLanguage") or "ja")
        top_k = int(params.get("topK") or 5)
        top_p = float(params.get("topP") or 1.0)
        temperature = float(params.get("temperature") or 1.0)
        speed = float(params.get("speed") or 1.0)

        for label, p in (
            ("repoPath", repo_path),
            ("gptModelPath", gpt_model_path),
            ("sovitsModelPath", sovits_model_path),
            ("refWavPath", ref_wav_path),
        ):
            if not p or not os.path.exists(p):
                protocol.respond_error(
                    f"GPT-SoVITS {label} 가 없습니다: {p}. "
                    f"make tts-bootstrap-gpt-sovits 로 설치하고 config/tts.json 을 확인하세요.",
                    "ModelNotFound",
                )
                return 1
        if not ref_text:
            protocol.respond_error(
                "providers.gpt_sovits.refText 가 비어 있습니다. 참조 음성의 전사 텍스트를 입력하세요.",
                "InvalidRequest",
            )
            return 1

        samples, src_rate = synthesize_gpt_sovits(
            text=req.text,
            repo_path=repo_path,
            gpt_model_path=gpt_model_path,
            sovits_model_path=sovits_model_path,
            ref_wav_path=ref_wav_path,
            ref_text=ref_text,
            ref_language=ref_language,
            target_language=target_language,
            top_k=top_k,
            top_p=top_p,
            temperature=temperature,
            speed=speed,
        )

        if src_rate != req.sample_rate:
            protocol.log(f"리샘플: {src_rate}Hz → {req.sample_rate}Hz")
            samples = protocol.resample_to(samples, src_rate, req.sample_rate)

        if req.channels != 1:
            protocol.respond_error(
                f"GPT-SoVITS 는 mono 출력만 지원하지만 channels={req.channels} 가 요청됨",
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

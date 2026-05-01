"""TTS 엔진 synth.py 공통 IPC 프로토콜.

각 엔진의 synth.py 는 이 모듈을 sys.path 추가 후 import 한다.
TS 측 PythonTtsBridge 와 짝을 이루는 stdin/stdout JSON 프로토콜을 정의한다.

요청 (stdin, single line JSON):
{
  "text": str,
  "voice": str,
  "outputPath": str,                # 합성 결과 WAV 저장 경로 (절대경로)
  "sampleRate": int,
  "channels": int,
  "bitDepth": int,
  "engineParams": { ... }           # 엔진별 추가 파라미터
}

응답 (stdout, single line JSON, 마지막 라인이 응답으로 사용됨):
성공: {"ok": true, "audioPath": str, "durationSec": float, "alignment": null}
실패: {"ok": false, "error": str, "errorType": str}

로그·진행률 등은 stderr 로 출력한다.
"""

from __future__ import annotations

import json
import struct
import sys
import wave
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SynthRequest:
    text: str
    voice: str
    output_path: str
    sample_rate: int
    channels: int
    bit_depth: int
    engine_params: dict[str, Any]

    @classmethod
    def from_stdin(cls) -> "SynthRequest":
        raw = sys.stdin.read()
        if not raw.strip():
            raise ValueError("stdin 이 비어 있습니다.")
        data = json.loads(raw)
        return cls(
            text=data["text"],
            voice=data["voice"],
            output_path=data["outputPath"],
            sample_rate=int(data["sampleRate"]),
            channels=int(data["channels"]),
            bit_depth=int(data["bitDepth"]),
            engine_params=data.get("engineParams") or {},
        )


def log(message: str) -> None:
    """진행률·디버그 메시지는 stderr 로. stdout 은 응답 JSON 전용."""
    print(message, file=sys.stderr, flush=True)


def respond_ok(audio_path: str, duration_sec: float, alignment: Any = None) -> None:
    payload = {
        "ok": True,
        "audioPath": audio_path,
        "durationSec": float(duration_sec),
        "alignment": alignment,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def respond_error(error: str, error_type: str = "RuntimeError") -> None:
    payload = {
        "ok": False,
        "error": error,
        "errorType": error_type,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def write_wav_pcm16(path: str, pcm_bytes: bytes, sample_rate: int, channels: int) -> float:
    """16-bit signed little-endian PCM 바이트를 WAV 로 저장하고 길이(초)를 반환한다."""
    with wave.open(path, "wb") as f:
        f.setnchannels(channels)
        f.setsampwidth(2)  # 16-bit
        f.setframerate(sample_rate)
        f.writeframes(pcm_bytes)
    bytes_per_sec = sample_rate * channels * 2
    return len(pcm_bytes) / bytes_per_sec if bytes_per_sec > 0 else 0.0


def write_wav_float32(
    path: str,
    samples: Any,  # numpy ndarray or list of float in [-1.0, 1.0]
    sample_rate: int,
    channels: int = 1,
) -> float:
    """float32 모노 샘플 배열을 16-bit PCM WAV 로 저장하고 길이(초)를 반환한다."""
    try:
        import numpy as np  # type: ignore
        arr = np.asarray(samples, dtype="float32").reshape(-1)
        if channels > 1:
            # 멀티채널은 (N, C) 또는 (C, N) 형태 가정 — 호출 측에서 reshape 후 전달 권장
            arr = np.asarray(samples, dtype="float32")
            if arr.ndim == 2 and arr.shape[0] == channels and arr.shape[1] != channels:
                arr = arr.T  # (C, N) → (N, C)
            arr = arr.reshape(-1)
        clipped = np.clip(arr, -1.0, 1.0)
        pcm = (clipped * 32767.0).astype("<i2").tobytes()
    except ImportError:
        # numpy 가 없으면 stdlib 만으로 변환 (느리지만 가능)
        flat = list(samples)
        pcm_parts = []
        for s in flat:
            v = max(-1.0, min(1.0, float(s)))
            pcm_parts.append(struct.pack("<h", int(v * 32767)))
        pcm = b"".join(pcm_parts)

    return write_wav_pcm16(path, pcm, sample_rate, channels)


def resample_to(samples: Any, src_rate: int, dst_rate: int) -> Any:
    """간단 리샘플링. numpy 가 있으면 선형 보간, 없으면 stdlib 으로 동일 비율 보간.

    품질 우선이면 호출 측에서 librosa/torchaudio 를 쓰는 편이 낫지만,
    PoC 에서 22050↔24000 같은 가벼운 변환을 위해 기본 구현을 둔다.
    """
    if src_rate == dst_rate:
        return samples
    try:
        import numpy as np  # type: ignore
        arr = np.asarray(samples, dtype="float32")
        ratio = dst_rate / src_rate
        new_len = int(round(arr.shape[-1] * ratio))
        x_old = np.linspace(0.0, 1.0, num=arr.shape[-1], endpoint=False, dtype="float32")
        x_new = np.linspace(0.0, 1.0, num=new_len, endpoint=False, dtype="float32")
        return np.interp(x_new, x_old, arr).astype("float32")
    except ImportError:
        # 매우 단순한 nearest-neighbor (품질 낮음, fallback 만)
        ratio = dst_rate / src_rate
        new_len = int(round(len(samples) * ratio))
        return [samples[min(int(i / ratio), len(samples) - 1)] for i in range(new_len)]

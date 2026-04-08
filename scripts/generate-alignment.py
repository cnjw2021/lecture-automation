#!/usr/bin/env python3
import argparse
import json
import math
import sys
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError as exc:
    raise SystemExit(
        "faster-whisper가 설치되어 있지 않습니다. `pip3 install faster-whisper` 후 다시 실행해 주세요."
    ) from exc


def normalize_text(text: str) -> str:
    return (
        unicodedata.normalize("NFKC", text)
        .replace("\r\n", "\n")
        .replace("…", "...")
        .replace("\u200b", "")
        .replace("\u200c", "")
        .replace("\u200d", "")
        .replace("\ufeff", "")
    ).translate({ord(ch): None for ch in " \t\n\r"})


@dataclass
class CharSpan:
    start_ms: int
    end_ms: int


def distribute_span(text: str, start_sec: float, end_sec: float):
    normalized = normalize_text(text)
    if not normalized:
        return "", []

    start_ms = int(round(start_sec * 1000))
    end_ms = int(round(end_sec * 1000))
    duration_ms = max(1, end_ms - start_ms)
    spans = []
    for idx in range(len(normalized)):
      char_start = int(round(start_ms + duration_ms * idx / len(normalized)))
      char_end = int(round(start_ms + duration_ms * (idx + 1) / len(normalized)))
      spans.append(CharSpan(char_start, max(char_start + 1, char_end)))
    return normalized, spans


def build_transcript_char_timeline(segments):
    full_text_parts = []
    full_spans = []
    debug_segments = []

    for segment in segments:
        words = getattr(segment, "words", None) or []
        used_words = False
        segment_parts = []
        segment_spans = []

        for word in words:
            normalized, spans = distribute_span(getattr(word, "word", ""), word.start, word.end)
            if not normalized:
                continue
            used_words = True
            segment_parts.append(normalized)
            segment_spans.extend(spans)

        if not used_words:
            normalized, spans = distribute_span(segment.text, segment.start, segment.end)
            if not normalized:
                continue
            segment_parts.append(normalized)
            segment_spans.extend(spans)

        segment_text = "".join(segment_parts)
        if not segment_text:
            continue

        debug_segments.append(
            {
                "text": segment.text.strip(),
                "normalizedText": segment_text,
                "start": float(segment.start),
                "end": float(segment.end),
            }
        )
        full_text_parts.append(segment_text)
        full_spans.extend(segment_spans)

    transcript_text = "".join(full_text_parts)
    if not transcript_text or not full_spans:
        raise RuntimeError("Whisper 전사 결과에서 사용할 수 있는 텍스트를 추출하지 못했습니다.")

    return transcript_text, full_spans, debug_segments


def get_transcript_bounds(spans, start_idx, end_idx, total_duration_ms, avg_char_ms):
    if start_idx < end_idx:
        return spans[start_idx].start_ms, spans[end_idx - 1].end_ms

    left = spans[start_idx - 1].end_ms if start_idx > 0 else 0
    right = spans[start_idx].start_ms if start_idx < len(spans) else total_duration_ms
    if right < left:
        right = left
    if right == left:
        right = left + avg_char_ms
    return left, right


def assign_linear(script_starts, script_ends, start_idx, end_idx, span_start, span_end):
    char_count = end_idx - start_idx
    if char_count <= 0:
        return

    duration_ms = max(char_count, span_end - span_start)
    for offset in range(char_count):
        char_start = int(round(span_start + duration_ms * offset / char_count))
        char_end = int(round(span_start + duration_ms * (offset + 1) / char_count))
        script_starts[start_idx + offset] = char_start
        script_ends[start_idx + offset] = max(char_start + 1, char_end)


def align_script_to_transcript(script_text, transcript_text, transcript_spans):
    script_starts = [None] * len(script_text)
    script_ends = [None] * len(script_text)
    total_duration_ms = transcript_spans[-1].end_ms
    avg_char_ms = max(1, int(round(total_duration_ms / max(1, len(transcript_text)))))

    matcher = SequenceMatcher(a=transcript_text, b=script_text, autojunk=False)
    for tag, a1, a2, b1, b2 in matcher.get_opcodes():
        if tag == "equal":
            for a_idx, b_idx in zip(range(a1, a2), range(b1, b2)):
                script_starts[b_idx] = transcript_spans[a_idx].start_ms
                script_ends[b_idx] = transcript_spans[a_idx].end_ms
            continue

        if tag in {"replace", "insert"}:
            span_start, span_end = get_transcript_bounds(
                transcript_spans,
                a1,
                a2,
                total_duration_ms,
                avg_char_ms,
            )
            assign_linear(script_starts, script_ends, b1, b2, span_start, span_end)

    last_known = 0
    for idx in range(len(script_text)):
        if script_starts[idx] is None:
            script_starts[idx] = last_known
            script_ends[idx] = last_known + avg_char_ms
        last_known = script_ends[idx]

    return script_starts, script_ends


def main():
    parser = argparse.ArgumentParser(description="강의 단위 TTS 마스터 오디오에서 alignment.json 생성")
    parser.add_argument("lecture_json", help="data/ 아래 lecture json 경로")
    parser.add_argument("master_audio", help="정렬 대상 master audio 경로")
    parser.add_argument("output_json", help="생성할 alignment.json 경로")
    parser.add_argument("--model", default="small", help="faster-whisper 모델명 (기본: small)")
    parser.add_argument("--language", default="ja", help="오디오 언어 코드 (기본: ja)")
    parser.add_argument("--device", default="auto", help="Whisper 실행 device (기본: auto)")
    parser.add_argument("--compute-type", default="int8", help="ctranslate2 compute type (기본: int8)")
    args = parser.parse_args()

    lecture_path = Path(args.lecture_json)
    master_audio_path = Path(args.master_audio)
    output_path = Path(args.output_json)

    lecture = json.loads(lecture_path.read_text(encoding="utf-8"))
    scenes = lecture["sequence"]
    normalized_script = "".join(normalize_text(scene["narration"]) for scene in scenes)
    if not normalized_script:
        raise SystemExit("lecture JSON에서 정렬할 narration을 찾지 못했습니다.")

    print(f"[align] faster-whisper 모델 로드: {args.model}", file=sys.stderr)
    model = WhisperModel(args.model, device=args.device, compute_type=args.compute_type)
    print(f"[align] 전사 시작: {master_audio_path}", file=sys.stderr)
    segments, info = model.transcribe(
        str(master_audio_path),
        language=args.language,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        condition_on_previous_text=True,
    )

    transcript_text, transcript_spans, debug_segments = build_transcript_char_timeline(list(segments))
    script_starts, script_ends = align_script_to_transcript(normalized_script, transcript_text, transcript_spans)

    alignment_segments = []
    debug_scene_ranges = []
    cursor = 0
    for scene in scenes:
        normalized = normalize_text(scene["narration"])
        start_idx = cursor
        end_idx = cursor + len(normalized) - 1
        if end_idx < start_idx:
            continue

        start_ms = script_starts[start_idx]
        end_ms = script_ends[end_idx]
        alignment_segments.append(
            {
                "sceneId": scene["scene_id"],
                "text": scene["narration"],
                "start": round(start_ms / 1000, 3),
                "end": round(end_ms / 1000, 3),
            }
        )
        debug_scene_ranges.append(
            {
                "sceneId": scene["scene_id"],
                "normalizedText": normalized,
                "charStart": start_idx,
                "charEnd": end_idx,
                "startMs": start_ms,
                "endMs": end_ms,
            }
        )
        cursor += len(normalized)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(
            {
                "generator": {
                    "tool": "faster-whisper",
                    "model": args.model,
                    "language": args.language,
                    "durationSec": getattr(info, "duration", None),
                },
                "segments": alignment_segments,
                "debug": {
                    "transcriptText": transcript_text,
                    "transcriptSegments": debug_segments,
                    "sceneRanges": debug_scene_ranges,
                },
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"[align] alignment 저장 완료: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()

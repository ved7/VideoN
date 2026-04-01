from __future__ import annotations

from collections import Counter
import hashlib
import re
from typing import Final

from app.core.config import get_settings
from app.models.annotation import Annotation
from app.models.video import Video

settings = get_settings()

try:  # pragma: no cover - dependency availability is validated by install/build steps
    from openai import OpenAI
except ImportError:  # pragma: no cover - fallback path
    OpenAI = None  # type: ignore[assignment]


SUMMARY_INSTRUCTIONS: Final[str] = """
You are a senior video review analyst.
Write a concise but intelligent review summary from annotation notes only.
Do not invent visual or narrative details that are not supported by the annotations.
Prefer clear, polished prose over generic filler.
Structure the answer using exactly these sections and keep the tone polished, grounded, and useful for a review handoff:

Overview:
2 to 3 sentences explaining the overall subject or review direction.

Key Moments:
3 to 5 bullet points using timestamps and concise observations.

Review Focus:
2 to 4 bullet points covering patterns, issues, or next areas to inspect.

If the notes are sparse, acknowledge the limited evidence and still produce the best grounded synthesis possible.
""".strip()

STOPWORDS: Final[set[str]] = {
    "a",
    "about",
    "after",
    "all",
    "also",
    "an",
    "and",
    "any",
    "area",
    "are",
    "around",
    "as",
    "at",
    "be",
    "because",
    "been",
    "before",
    "between",
    "but",
    "by",
    "can",
    "could",
    "did",
    "do",
    "does",
    "denotes",
    "during",
    "each",
    "for",
    "from",
    "had",
    "has",
    "have",
    "here",
    "how",
    "in",
    "into",
    "is",
    "it",
    "its",
    "just",
    "left",
    "more",
    "most",
    "near",
    "need",
    "no",
    "not",
    "of",
    "on",
    "or",
    "our",
    "out",
    "over",
    "review",
    "right",
    "scene",
    "segment",
    "should",
    "shows",
    "side",
    "some",
    "that",
    "the",
    "their",
    "them",
    "then",
    "there",
    "these",
    "this",
    "those",
    "through",
    "to",
    "up",
    "use",
    "visual",
    "video",
    "was",
    "we",
    "were",
    "what",
    "when",
    "where",
    "which",
    "while",
    "with",
    "within",
    "would",
    "yet",
}


def format_timestamp(value: float) -> str:
    total_seconds = max(0, int(round(value)))
    minutes, seconds = divmod(total_seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{minutes:02d}:{seconds:02d}"


def extract_keywords(note: str) -> list[str]:
    words = re.findall(r"[a-zA-Z][a-zA-Z0-9'-]{2,}", note.lower())
    return [word for word in words if word not in STOPWORDS]


def summarize_note(note: str, limit: int = 110) -> str:
    cleaned = " ".join(note.split())
    if len(cleaned) <= limit:
        return cleaned

    truncated = cleaned[: limit - 1].rsplit(" ", 1)[0].rstrip(".,;:-")
    return f"{truncated}..."


def choose_notable_annotations(annotations: list[Annotation], limit: int = 4) -> list[Annotation]:
    ranked = sorted(
        annotations,
        key=lambda annotation: (
            -len(annotation.note.strip()),
            -len(getattr(annotation, "tags", "") or ""),
            annotation.timestamp_seconds,
        ),
    )
    return ranked[:limit]


def build_theme_phrases(annotations: list[Annotation]) -> tuple[list[str], list[str]]:
    tag_counter: Counter[str] = Counter()
    keyword_counter: Counter[str] = Counter()

    for annotation in annotations:
        for tag in getattr(annotation, "tags", "").splitlines():
            cleaned_tag = tag.strip().lower()
            if cleaned_tag:
                tag_counter[cleaned_tag] += 1
        keyword_counter.update(extract_keywords(annotation.note))

    top_tags = [tag for tag, _ in tag_counter.most_common(3)]
    top_keywords = [keyword for keyword, _ in keyword_counter.most_common(5) if keyword not in top_tags]
    return top_tags, top_keywords[:3]


def build_summary_fingerprint(annotations: list[Annotation]) -> str:
    digest = hashlib.sha256()
    for annotation in annotations:
        digest.update(f"{annotation.id}|".encode("utf-8"))
        digest.update(f"{annotation.annotation_type.value}|".encode("utf-8"))
        digest.update(f"{annotation.origin.value}|".encode("utf-8"))
        digest.update(f"{annotation.timestamp_seconds:.3f}|".encode("utf-8"))
        digest.update(f"{annotation.frame_number}|".encode("utf-8"))
        digest.update(f"{int(annotation.is_placeholder)}|".encode("utf-8"))
        digest.update((annotation.note or "").strip().encode("utf-8"))
        digest.update(b"|")
        digest.update((getattr(annotation, "tags", "") or "").strip().encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def select_llm_annotations(annotations: list[Annotation], limit: int = 24) -> list[Annotation]:
    meaningful_annotations = [annotation for annotation in annotations if annotation.note.strip()]
    if meaningful_annotations:
        return meaningful_annotations[:limit]
    return annotations[: min(len(annotations), 12)]


def format_focus_phrase(items: list[str], fallback: str) -> str:
    if not items:
        return fallback
    if len(items) == 1:
        return items[0]
    if len(items) == 2:
        return f"{items[0]} and {items[1]}"
    return f"{', '.join(items[:-1])}, and {items[-1]}"


def build_rule_based_summary(video: Video, annotations: list[Annotation]) -> str:
    if not annotations:
        return "No annotations were added yet, so there is nothing to summarize."

    non_empty_notes = [annotation for annotation in annotations if annotation.note.strip()]
    note_candidates = choose_notable_annotations(non_empty_notes, limit=5)
    coverage = "unknown runtime"
    if video.duration_seconds:
        coverage = f"{format_timestamp(video.duration_seconds)} runtime"

    if not note_candidates:
        return (
            "Overview:\n"
            f"The video has {len(annotations)} captured moments across a {coverage}, but the saved notes are still empty.\n"
            "There is enough structure to keep reviewing, but not enough written evidence yet for a grounded narrative.\n\n"
            "Key Moments:\n"
            "- Notes have not been added to the generated timestamps yet.\n\n"
            "Review Focus:\n"
            "- Add text to a few key moments so the summary can identify patterns and priorities.\n"
            "- Use tags on important moments to improve clustering and downstream review."
        )

    type_counts = Counter(annotation.annotation_type.value.lower() for annotation in annotations)
    placeholder_count = sum(1 for annotation in annotations if annotation.is_placeholder)
    tagged_count = sum(1 for annotation in annotations if getattr(annotation, "tags", "").strip())
    top_tags, top_keywords = build_theme_phrases(non_empty_notes)
    focus_phrase = format_focus_phrase(top_tags or top_keywords, "general review coverage")

    overview_lines = [
        f"The review includes {len(annotations)} annotations across a {coverage}, with {type_counts.get('timestamp', 0)} timestamp notes and {type_counts.get('frame', 0)} frame-specific notes.",
        f"Most of the written attention is centered on {focus_phrase}, which gives the review a clearer direction than a raw note dump.",
    ]
    if placeholder_count:
        overview_lines.append(
            f"There are still {placeholder_count} placeholder slots, so the current summary reflects the strongest documented moments rather than complete coverage."
        )

    key_moment_lines = [
        f"- {format_timestamp(annotation.timestamp_seconds)}: {summarize_note(annotation.note.strip())}"
        for annotation in sorted(note_candidates, key=lambda annotation: annotation.timestamp_seconds)
    ]

    review_focus_lines = []
    if top_tags:
        review_focus_lines.append(
            f"- Repeated tags point to recurring focus areas around {format_focus_phrase(top_tags, 'key review themes')}."
        )
    if top_keywords:
        review_focus_lines.append(
            f"- Repeated language suggests follow-up around {format_focus_phrase(top_keywords, 'the main discussion topics')}."
        )
    if tagged_count < len(non_empty_notes):
        review_focus_lines.append("- Several notes are still untagged, so adding labels would make filtering and clustering sharper.")
    if placeholder_count:
        review_focus_lines.append("- Fill the remaining placeholder timestamps to turn this from a partial pass into a fuller review handoff.")
    if not review_focus_lines:
        review_focus_lines.append("- Add more detailed notes or tags to surface stronger cross-cutting themes in the next summary pass.")

    return (
        "Overview:\n"
        + " ".join(overview_lines)
        + "\n\nKey Moments:\n"
        + "\n".join(key_moment_lines)
        + "\n\nReview Focus:\n"
        + "\n".join(review_focus_lines)
    )


def has_meaningful_notes(annotations: list[Annotation]) -> bool:
    return any(annotation.note.strip() for annotation in annotations)


def build_summary_context(video: Video, annotations: list[Annotation]) -> str:
    duration = format_timestamp(video.duration_seconds) if video.duration_seconds else "unknown"
    selected_annotations = select_llm_annotations(annotations)
    lines = [
        f"Video name: {video.name}",
        f"Duration: {duration}",
        f"Annotation count: {len(annotations)}",
        f"Notes passed to model: {len(selected_annotations)}",
        "",
        "Annotations:",
    ]

    for annotation in selected_annotations:
        timestamp = format_timestamp(annotation.timestamp_seconds)
        frame_label = f" | frame {annotation.frame_number}" if annotation.frame_number is not None else ""
        tag_label = ""
        if getattr(annotation, "tags", ""):
            parsed_tags = [tag.strip() for tag in annotation.tags.splitlines() if tag.strip()]
            if parsed_tags:
                tag_label = f" | tags: {', '.join(parsed_tags)}"
        note = annotation.note.strip() or "(empty note)"
        lines.append(
            f"- {timestamp} | {annotation.annotation_type.value.lower()} | {annotation.origin.value.lower()}{frame_label}{tag_label} | {note}"
        )

    return "\n".join(lines)


def build_llm_summary(video: Video, annotations: list[Annotation], api_key: str | None = None) -> str | None:
    effective_api_key = (api_key or settings.openai_api_key or "").strip()
    if not effective_api_key or OpenAI is None:
        return None

    if not annotations or not has_meaningful_notes(annotations):
        return None

    client = OpenAI(
        api_key=effective_api_key,
        timeout=settings.openai_summary_timeout_seconds,
        max_retries=0,
    )
    response = client.responses.create(
        model=settings.openai_summary_model,
        instructions=SUMMARY_INSTRUCTIONS,
        input=build_summary_context(video, annotations),
        max_output_tokens=280,
    )
    output_text = (response.output_text or "").strip()
    return output_text or None


def build_summary(video: Video, annotations: list[Annotation], api_key: str | None = None) -> str:
    try:
        llm_summary = build_llm_summary(video, annotations, api_key=api_key)
    except Exception:  # pragma: no cover - provider failures should not break core workflows
        llm_summary = None

    return llm_summary or build_rule_based_summary(video, annotations)

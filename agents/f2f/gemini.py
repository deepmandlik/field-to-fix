"""Thin wrappers around the Google Gen AI SDK (Vertex AI mode, no API key)."""
from __future__ import annotations

import mimetypes
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Type, TypeVar

from google import genai
from google.genai import types
from pydantic import BaseModel

from .config import settings

T = TypeVar("T", bound=BaseModel)


_lock = threading.Lock()
_clients: dict[str, genai.Client] = {}


def _get(location: str) -> genai.Client:
    # One client per location, created under a lock: worker threads must not race to build
    # throwaway clients, whose cleanup closes the HTTP connection mid-request.
    with _lock:
        if location not in _clients:
            _clients[location] = genai.Client(vertexai=True, project=settings.project, location=location,
                                              http_options=types.HttpOptions(timeout=90_000))  # ms; never hang
        return _clients[location]


def client() -> genai.Client:
    return _get(settings.gemini_location)


def embed_client() -> genai.Client:
    return _get(settings.embed_location)


def with_retry(fn, *args, attempts: int = 8, **kwargs):
    """Retry 429 / 5xx with exponential backoff and jitter. New projects have low per-minute quotas."""
    import random
    import time

    import httpx
    from google.genai import errors

    for i in range(attempts):
        try:
            return fn(*args, **kwargs)
        except errors.APIError as e:
            if e.code not in (429, 500, 502, 503, 504) or i == attempts - 1:
                raise
        except (httpx.TransportError, ConnectionError):  # transient network / TLS failures
            if i == attempts - 1:
                raise
        time.sleep(min(60, 2 ** i) + random.random() * 2)


def file_part(uri: str) -> types.Part:
    mime = mimetypes.guess_type(uri)[0] or "application/octet-stream"
    return types.Part.from_uri(file_uri=uri, mime_type=mime)


def structured(model: str, system: str, parts: list, schema: Type[T], temperature: float = 0.2) -> T:
    """One Gemini call that must return JSON matching `schema`."""
    resp = with_retry(
        client().models.generate_content,
        model=model,
        contents=[types.Content(role="user", parts=[p if isinstance(p, types.Part) else types.Part.from_text(text=p) for p in parts])],
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=temperature,
            response_mime_type="application/json",
            response_schema=schema,
        ),
    )
    if resp.parsed is None:
        return schema.model_validate_json(resp.text)
    return resp.parsed


def embed(texts: list[str], task_type: str = "CLUSTERING") -> list[list[float]]:
    """Embed many texts. gemini-embedding-001 on Vertex takes one input per request, so fan out."""
    cfg = types.EmbedContentConfig(task_type=task_type, output_dimensionality=settings.embed_dim)

    def one(t: str) -> list[float]:
        r = with_retry(embed_client().models.embed_content, model=settings.model_embed, contents=t, config=cfg)
        return list(r.embeddings[0].values)

    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(one, texts))

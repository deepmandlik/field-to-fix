"""Runtime configuration, read once from environment variables."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    project: str = os.getenv("GOOGLE_CLOUD_PROJECT", "field-to-fix")
    # Gemini is called through the global endpoint; embeddings through a region that serves them.
    gemini_location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
    embed_location: str = os.getenv("EMBED_LOCATION", "us-central1")
    model_fast: str = os.getenv("MODEL_FAST", "gemini-3.8-flash")
    model_reason: str = os.getenv("MODEL_REASON", "gemini-4-argon")
    model_embed: str = os.getenv("MODEL_EMBED", "gemini-embedding-001")
    embed_dim: int = int(os.getenv("EMBED_DIM", "768"))
    bq_dataset: str = os.getenv("BQ_DATASET", "f2f")
    bq_location: str = os.getenv("BQ_LOCATION", "asia-southeast1")
    bucket: str = os.getenv("GCS_BUCKET", "field-to-fix-f2f")
    pubsub_topic: str = os.getenv("PUBSUB_TOPIC", "claims-new")
    allowed_origins: tuple = tuple(
        o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    )
    # DEV_AUTH=1 lets local runs pass X-Dev-Role / X-Dev-Uid instead of a Firebase ID token.
    dev_auth: bool = os.getenv("DEV_AUTH", "0") == "1"
    # "Today" for the synthetic dataset; signal windows are measured back from here.
    as_of: str = os.getenv("AS_OF_DATE", "2026-10-17")

    def table(self, name: str) -> str:
        return f"`{self.project}.{self.bq_dataset}.{name}`"


settings = Settings()

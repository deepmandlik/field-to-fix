"""Pydantic models shared by the API and used as Gemini response schemas."""
from typing import Literal, Optional

from pydantic import BaseModel, Field


# ---------- Intake ----------
class ClaimIn(BaseModel):
    vin: str
    dealer_id: str
    note_text: str
    mileage_km: Optional[int] = None
    claim_date: Optional[str] = None  # ISO date; defaults to today
    photo_uris: list[str] = []
    audio_uri: Optional[str] = None


class ClaimExtraction(BaseModel):
    """What Gemini Flash pulls out of a raw dealer note (+ photo / voice)."""
    lang: str = Field(description="ISO 639-1 code of the original note, e.g. en, hi, id")
    translated_text: str = Field(description="Faithful English translation of the note")
    component: str = Field(description="Failed component in plain English, e.g. 'coolant hose clamp'")
    failure_mode: str = Field(description="How it failed, e.g. 'leak at joint', 'noise', 'no power'")
    symptom: str = Field(description="What the customer experienced")
    condition: str = Field(description="When it happens, e.g. 'after cold start'; 'unknown' if not stated")
    severity: int = Field(ge=1, le=5, description="1 cosmetic .. 5 safety-critical")
    photo_findings: str = Field(description="What the photo shows; 'no photo' if none")
    confidence: float = Field(ge=0, le=1)


# ---------- Signal ----------
class ClusterLabel(BaseModel):
    label: str = Field(description="Short engineer-style name, e.g. 'Coolant leak at hose clamp'")
    component: str
    failure_mode: str
    severity: int = Field(ge=1, le=5)


# ---------- Hypothesise ----------
class Hypothesis(BaseModel):
    cause: str
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    evidence_claim_ids: list[str]
    pfmea_row_ids: list[str]
    control_gap: str = Field(description="Which control-plan check should have caught it, or 'none identified'")


class Hypotheses(BaseModel):
    hypotheses: list[Hypothesis]
    recommended_checks: list[str]


# ---------- Draft 8D ----------
class Section(BaseModel):
    text: str
    cites: list[str] = Field(description="claim ids, pfmea row ids (R-..), control plan ids (CP-..) or 'stock'")


class EightD(BaseModel):
    D2_problem: Section
    D3_containment: Section
    D4_root_cause: Section
    D5_corrective_action: Section
    open_questions: list[str]


# ---------- Ask ----------
class Answer(BaseModel):
    text: str
    cites: list[str]


class AskIn(BaseModel):
    question: str


class ApproveIn(BaseModel):
    action: Literal["approve", "request_evidence", "accept_supplier", "reject_supplier", "dismiss"]
    note: Optional[str] = None
    eight_d: Optional[dict] = None  # SQE edits, merged before sending


class SupplierResponseIn(BaseModel):
    D4_root_cause: str
    D5_corrective_action: str
    D6_implementation: str
    D7_prevention: str

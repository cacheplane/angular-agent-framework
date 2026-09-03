"""Parent-LLM-bound tool that emits A2UI v0.9 envelopes as structured tool
arguments. Replaces the old two-LLM `generate_a2ui_schema` flow (parent
calls a sub-LLM that produces envelopes); the parent now emits envelopes
directly so the natural token stream IS the surface-rendering stream.

The Pydantic schemas enable OpenAI strict-mode validation when the tool
is bound via `bind_tools([..., render_a2ui_surface], strict=True)`.
"""
from __future__ import annotations

import json
from typing import Optional

from langchain_core.tools import tool
from pydantic import BaseModel, Field, model_validator


class A2uiEnvelope(BaseModel):
    """Single A2UI v0.9 envelope. Carries the protocol `version` plus
    exactly one of the four discriminators — the model_validator below
    enforces this so the parent LLM cannot emit ambiguous or empty
    envelopes."""
    version: str = Field(default="v0.9", description="A2UI protocol version.")
    createSurface: Optional[dict] = Field(
        default=None,
        description="Surface-creation envelope: {surfaceId, catalogId, theme?, "
        "sendDataModel?}. Required first envelope per surface.",
    )
    updateComponents: Optional[dict] = Field(
        default=None,
        description="Component-tree envelope: {surfaceId, components}. The first "
        "one must include the component with id 'root'.",
    )
    updateDataModel: Optional[dict] = Field(
        default=None,
        description="Data-model envelope: {surfaceId, path?, value?}. path "
        "defaults to '/' (whole-model replace); omitted value deletes at path.",
    )
    deleteSurface: Optional[dict] = Field(
        default=None,
        description="Surface-deletion envelope: {surfaceId}.",
    )

    @model_validator(mode="after")
    def _exactly_one_discriminator(self) -> "A2uiEnvelope":
        present = sum(
            1 for v in (
                self.createSurface,
                self.updateComponents,
                self.updateDataModel,
                self.deleteSurface,
            )
            if v is not None
        )
        if present != 1:
            raise ValueError(
                f"A2uiEnvelope requires exactly one of "
                f"createSurface / updateComponents / updateDataModel / "
                f"deleteSurface; got {present}"
            )
        return self


@tool
def render_a2ui_surface(envelopes: list[A2uiEnvelope]) -> str:
    """Render a UI surface using A2UI v0.9 envelopes. Emit:
      - exactly one `createSurface` (surfaceId + catalogId) FIRST,
      - one or more `updateComponents` (component tree; the FIRST one must
        include the component with id "root" — rendering starts when the
        root component is defined),
      - zero or more `updateDataModel` entries (initial state).

    Envelope order in this call must be: createSurface, then
    updateComponents (root component first), then any updateDataModel
    entries (so the surface mounts and per-component placeholders show
    before initial state arrives).
    """
    if not envelopes:
        raise ValueError("render_a2ui_surface requires at least one envelope")
    return json.dumps([e.model_dump(exclude_none=True) for e in envelopes])

# SPDX-License-Identifier: MIT
"""Parent-LLM-bound tool that emits A2UI v1 envelopes as structured tool
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


class SurfaceUpdate(BaseModel):
    """Component-tree envelope. Required first envelope per turn."""
    surfaceId: str = Field(description="Stable identifier for this surface.")
    components: list[dict] = Field(
        description="Component tree as a list of {id, type, props} objects."
    )


class BeginRendering(BaseModel):
    """Render-start envelope. Required; identifies the root component."""
    surfaceId: str
    root: str = Field(description="Component id of the surface root.")
    styles: Optional[dict] = None


class DataModelUpdate(BaseModel):
    """Initial state envelope. Optional; one per state path the surface binds to."""
    surfaceId: str
    path: Optional[str] = None
    contents: list[dict] = Field(
        description="Entries: {key, valueString|valueNumber|valueBoolean|valueMap}."
    )


class A2uiEnvelope(BaseModel):
    """Single A2UI v1 envelope. Exactly one of the three discriminators
    is set per envelope — the model_validator below enforces this so the
    parent LLM cannot emit ambiguous or empty envelopes."""
    surfaceUpdate: Optional[SurfaceUpdate] = None
    beginRendering: Optional[BeginRendering] = None
    dataModelUpdate: Optional[DataModelUpdate] = None

    @model_validator(mode="after")
    def _exactly_one_discriminator(self) -> "A2uiEnvelope":
        present = sum(
            1 for v in (self.surfaceUpdate, self.beginRendering, self.dataModelUpdate)
            if v is not None
        )
        if present != 1:
            raise ValueError(
                f"A2uiEnvelope requires exactly one of "
                f"surfaceUpdate / beginRendering / dataModelUpdate; got {present}"
            )
        return self


@tool
def render_a2ui_surface(envelopes: list[A2uiEnvelope]) -> str:
    """Render a UI surface using A2UI v1 envelopes. Emit:
      - exactly one `surfaceUpdate` (component tree),
      - exactly one `beginRendering` (root reference),
      - zero or more `dataModelUpdate` entries (initial state).

    Envelope order in this call should be: surfaceUpdate, beginRendering,
    then any dataModelUpdate entries (so the surface mounts and per-component
    placeholders show before initial state arrives).
    """
    if not envelopes:
        raise ValueError("render_a2ui_surface requires at least one envelope")
    return json.dumps([e.model_dump(exclude_none=True) for e in envelopes])

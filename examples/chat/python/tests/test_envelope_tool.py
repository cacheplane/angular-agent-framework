"""Tests for the parent-emits-envelopes tool used by the GenUI flow."""
import json

import pytest

from src.streaming.envelope_tool import (
    SurfaceUpdate,
    BeginRendering,
    DataModelUpdate,
    A2uiEnvelope,
    render_a2ui_surface,
)


class TestPydanticEnvelopeModels:
    def test_surface_update_round_trips(self):
        m = SurfaceUpdate(surfaceId="s1", components=[{"id": "c", "type": "text", "props": {}}])
        assert m.surfaceId == "s1"
        assert m.components == [{"id": "c", "type": "text", "props": {}}]

    def test_begin_rendering_required_fields(self):
        m = BeginRendering(surfaceId="s1", root="c")
        assert m.root == "c"

    def test_data_model_update_path_is_optional(self):
        m = DataModelUpdate(surfaceId="s1", contents=[{"key": "k", "valueString": "v"}])
        assert m.path is None

    def test_a2ui_envelope_accepts_surface_update_field(self):
        e = A2uiEnvelope(surfaceUpdate={"surfaceId": "s", "components": []})
        assert e.surfaceUpdate is not None
        assert e.beginRendering is None
        assert e.dataModelUpdate is None

    def test_a2ui_envelope_rejects_empty(self):
        """An envelope with zero discriminators set is rejected."""
        with pytest.raises(ValueError, match="exactly one"):
            A2uiEnvelope()

    def test_a2ui_envelope_rejects_multiple_discriminators(self):
        """An envelope with two discriminators set is rejected."""
        with pytest.raises(ValueError, match="exactly one"):
            A2uiEnvelope(
                surfaceUpdate={"surfaceId": "s", "components": []},
                beginRendering={"surfaceId": "s", "root": "r"},
            )


class TestRenderA2uiSurfaceTool:
    def test_serializes_envelopes_to_json_string(self):
        envelopes = [
            {"surfaceUpdate": {"surfaceId": "s", "components": [{"id": "c", "type": "text", "props": {}}]}},
            {"beginRendering": {"surfaceId": "s", "root": "c"}},
        ]
        result = render_a2ui_surface.invoke({"envelopes": envelopes})
        parsed = json.loads(result)
        assert isinstance(parsed, list)
        assert len(parsed) == 2
        assert "surfaceUpdate" in parsed[0]
        assert "beginRendering" in parsed[1]

    def test_strips_none_fields_via_exclude_none(self):
        envelopes = [{"surfaceUpdate": {"surfaceId": "s", "components": []}}]
        result = render_a2ui_surface.invoke({"envelopes": envelopes})
        parsed = json.loads(result)
        # beginRendering / dataModelUpdate are None on this envelope and should be stripped.
        assert "beginRendering" not in parsed[0]
        assert "dataModelUpdate" not in parsed[0]

    def test_raises_on_empty_envelopes_list(self):
        with pytest.raises(ValueError):
            render_a2ui_surface.invoke({"envelopes": []})

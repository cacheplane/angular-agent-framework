"""Tests for the parent-emits-envelopes tool used by the GenUI flow."""
import json

import pytest

from src.streaming.envelope_tool import (
    A2uiEnvelope,
    render_a2ui_surface,
)


class TestPydanticEnvelopeModel:
    def test_version_defaults_to_v09(self):
        e = A2uiEnvelope(createSurface={"surfaceId": "s", "catalogId": "c"})
        assert e.version == "v0.9"

    def test_a2ui_envelope_accepts_create_surface_field(self):
        e = A2uiEnvelope(createSurface={"surfaceId": "s", "catalogId": "c"})
        assert e.createSurface is not None
        assert e.updateComponents is None
        assert e.updateDataModel is None
        assert e.deleteSurface is None

    def test_a2ui_envelope_accepts_update_components_field(self):
        e = A2uiEnvelope(updateComponents={"surfaceId": "s", "components": []})
        assert e.updateComponents is not None
        assert e.createSurface is None

    def test_a2ui_envelope_accepts_update_data_model_field(self):
        e = A2uiEnvelope(updateDataModel={"surfaceId": "s", "path": "/", "value": {}})
        assert e.updateDataModel is not None

    def test_a2ui_envelope_accepts_delete_surface_field(self):
        e = A2uiEnvelope(deleteSurface={"surfaceId": "s"})
        assert e.deleteSurface is not None

    def test_a2ui_envelope_rejects_empty(self):
        """An envelope with zero discriminators set is rejected."""
        with pytest.raises(ValueError, match="exactly one"):
            A2uiEnvelope()

    def test_a2ui_envelope_rejects_multiple_discriminators(self):
        """An envelope with two discriminators set is rejected."""
        with pytest.raises(ValueError, match="exactly one"):
            A2uiEnvelope(
                createSurface={"surfaceId": "s", "catalogId": "c"},
                updateComponents={"surfaceId": "s", "components": []},
            )


class TestRenderA2uiSurfaceTool:
    def test_serializes_envelopes_to_json_string(self):
        envelopes = [
            {"createSurface": {"surfaceId": "s", "catalogId": "c"}},
            {"updateComponents": {"surfaceId": "s", "components": [{"id": "root", "component": "Text", "text": "hi"}]}},
        ]
        result = render_a2ui_surface.invoke({"envelopes": envelopes})
        parsed = json.loads(result)
        assert isinstance(parsed, list)
        assert len(parsed) == 2
        assert "createSurface" in parsed[0]
        assert "updateComponents" in parsed[1]

    def test_every_envelope_carries_version_v09(self):
        envelopes = [
            {"createSurface": {"surfaceId": "s", "catalogId": "c"}},
            {"updateComponents": {"surfaceId": "s", "components": []}},
        ]
        result = render_a2ui_surface.invoke({"envelopes": envelopes})
        parsed = json.loads(result)
        assert all(env.get("version") == "v0.9" for env in parsed)

    def test_strips_none_fields_via_exclude_none(self):
        envelopes = [{"updateComponents": {"surfaceId": "s", "components": []}}]
        result = render_a2ui_surface.invoke({"envelopes": envelopes})
        parsed = json.loads(result)
        # createSurface / updateDataModel / deleteSurface are None on this
        # envelope and should be stripped.
        assert "createSurface" not in parsed[0]
        assert "updateDataModel" not in parsed[0]
        assert "deleteSurface" not in parsed[0]

    def test_raises_on_empty_envelopes_list(self):
        with pytest.raises(ValueError):
            render_a2ui_surface.invoke({"envelopes": []})

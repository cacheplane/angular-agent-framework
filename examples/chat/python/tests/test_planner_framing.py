import pytest
from src.graph import build_system_prompt  # helper introduced in Step 3


@pytest.mark.smoke
def test_planner_framing_only_when_client_tools_present():
    plain = build_system_prompt(gen_ui_mode="json-render", client_tools=[], itinerary=[])
    assert "trip-planning" not in plain.lower()

    app = build_system_prompt(
        gen_ui_mode="json-render",
        client_tools=[{"name": "add_stop"}],
        itinerary=[],
    )
    assert "trip-planning" in app.lower()
    assert "add_stop" in app  # instructs the model to populate state via the tool


@pytest.mark.smoke
def test_current_itinerary_is_injected_when_present():
    app = build_system_prompt(
        gen_ui_mode="json-render",
        client_tools=[{"name": "add_stop"}],
        itinerary=[{"id": "a", "day": 1, "place": "Louvre"}],
    )
    assert "Louvre" in app

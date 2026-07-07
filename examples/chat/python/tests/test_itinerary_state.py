import pytest


@pytest.mark.smoke
def test_state_declares_itinerary_channel():
    from src.graph import State
    assert "itinerary" in State.__annotations__


@pytest.mark.smoke
def test_stop_shape():
    from src.graph import Stop
    ann = Stop.__annotations__
    for key in ("id", "day", "place"):
        assert key in ann, f"Stop must declare {key}"

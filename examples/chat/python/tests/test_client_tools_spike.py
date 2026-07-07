import pytest


@pytest.mark.smoke
def test_state_has_client_tools_channel():
    from src.graph import State
    ann = State.__annotations__
    assert "client_tools" in ann, "State must carry the frontend client-tool catalog channel"


@pytest.mark.smoke
def test_all_client_tool_turn_routes_away_from_server_tools():
    from langchain_core.messages import AIMessage
    from src.graph import should_continue
    state = {
        "messages": [AIMessage(content="", tool_calls=[
            {"name": "add_stop", "args": {"day": 1, "place": "Louvre"}, "id": "t1"},
        ])],
        "client_tools": [{"name": "add_stop"}],
    }
    assert should_continue(state) != "tools"

# SPDX-License-Identifier: MIT
"""Tests for threadplane.middleware.langgraph.middleware — no LangChain import required."""
import pytest

from threadplane.middleware.langgraph.middleware import (
    bind_client_tools,
    client_tool_names,
    client_tool_specs,
    has_client_tool_call,
    has_server_tool_call,
    last_message,
    route_after_agent,
)

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

WEATHER_TOOL = {
    "name": "get_weather",
    "description": "w",
    "parameters": {"type": "object"},
}

WEATHER_STATE = {"tools": [WEATHER_TOOL]}


class _FakeLLM:
    """Minimal fake that records the argument passed to bind_tools."""

    def __init__(self):
        self.bound_tools = None

    def bind_tools(self, tools):
        self.bound_tools = list(tools)
        return self  # return self to allow chained calls


class _AttrMessage:
    """Attr-style fake message (simulates a LangChain AIMessage)."""

    def __init__(self, tool_calls):
        self.tool_calls = tool_calls


# ---------------------------------------------------------------------------
# client_tool_specs
# ---------------------------------------------------------------------------


def test_client_tool_specs_basic():
    result = client_tool_specs(WEATHER_STATE)
    assert result == [
        {
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "w",
                "parameters": {"type": "object"},
            },
        }
    ]


def test_client_tool_specs_explicit_openai_form():
    """Always emits {'type':'function','function':{...}} regardless of input."""
    result = client_tool_specs(WEATHER_STATE)
    assert result[0]["type"] == "function"
    assert "function" in result[0]


def test_client_tool_specs_fallback_to_client_tools_key():
    """Falls back to state['client_tools'] when 'tools' is absent."""
    state = {"client_tools": [WEATHER_TOOL]}
    result = client_tool_specs(state)
    assert len(result) == 1
    assert result[0]["function"]["name"] == "get_weather"


def test_client_tool_specs_ignores_entries_without_name():
    state = {
        "tools": [
            {"description": "no name here"},
            WEATHER_TOOL,
        ]
    }
    result = client_tool_specs(state)
    assert len(result) == 1
    assert result[0]["function"]["name"] == "get_weather"


def test_client_tool_specs_empty_state():
    assert client_tool_specs({}) == []


def test_client_tool_specs_missing_optional_fields():
    """description and parameters default to '' and {} respectively."""
    state = {"tools": [{"name": "minimal"}]}
    result = client_tool_specs(state)
    assert result[0]["function"]["description"] == ""
    assert result[0]["function"]["parameters"] == {}


def test_client_tool_specs_none_parameters_becomes_empty_dict():
    state = {"tools": [{"name": "t", "parameters": None}]}
    result = client_tool_specs(state)
    assert result[0]["function"]["parameters"] == {}


# ---------------------------------------------------------------------------
# client_tool_names
# ---------------------------------------------------------------------------


def test_client_tool_names_returns_set():
    assert client_tool_names(WEATHER_STATE) == {"get_weather"}


def test_client_tool_names_multiple():
    state = {"tools": [{"name": "a"}, {"name": "b"}]}
    assert client_tool_names(state) == {"a", "b"}


def test_client_tool_names_empty():
    assert client_tool_names({}) == set()


# ---------------------------------------------------------------------------
# bind_client_tools
# ---------------------------------------------------------------------------

_SENTINEL_SERVER_TOOL = object()


def test_bind_client_tools_calls_bind_tools_once():
    fake = _FakeLLM()
    result = bind_client_tools(fake, [_SENTINEL_SERVER_TOOL], WEATHER_STATE)
    assert result is fake  # returns bound llm
    assert fake.bound_tools is not None


def test_bind_client_tools_server_tool_is_first():
    fake = _FakeLLM()
    bind_client_tools(fake, [_SENTINEL_SERVER_TOOL], WEATHER_STATE)
    assert fake.bound_tools[0] is _SENTINEL_SERVER_TOOL


def test_bind_client_tools_client_stubs_follow():
    fake = _FakeLLM()
    bind_client_tools(fake, [_SENTINEL_SERVER_TOOL], WEATHER_STATE)
    # Second element is the client spec dict
    client_spec = fake.bound_tools[1]
    assert client_spec["type"] == "function"
    assert client_spec["function"]["name"] == "get_weather"


def test_bind_client_tools_no_client_tools():
    fake = _FakeLLM()
    bind_client_tools(fake, [_SENTINEL_SERVER_TOOL], {})
    assert fake.bound_tools == [_SENTINEL_SERVER_TOOL]


# ---------------------------------------------------------------------------
# last_message
# ---------------------------------------------------------------------------


def test_last_message_returns_last():
    state = {"messages": ["a", "b", "c"]}
    assert last_message(state) == "c"


def test_last_message_empty():
    assert last_message({"messages": []}) is None


def test_last_message_no_key():
    assert last_message({}) is None


# ---------------------------------------------------------------------------
# has_client_tool_call — dict messages
# ---------------------------------------------------------------------------


def test_has_client_tool_call_dict_message_true():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "get_weather"}]}],
    }
    assert has_client_tool_call(state) is True


def test_has_client_tool_call_dict_message_server_name():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "search"}]}],
    }
    assert has_client_tool_call(state) is False


def test_has_client_tool_call_no_tool_calls():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"content": "hello"}],
    }
    assert has_client_tool_call(state) is False


def test_has_client_tool_call_empty_tool_calls():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": []}],
    }
    assert has_client_tool_call(state) is False


# ---------------------------------------------------------------------------
# has_client_tool_call — attr-style messages
# ---------------------------------------------------------------------------


def test_has_client_tool_call_attr_message_true():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [_AttrMessage(tool_calls=[{"name": "get_weather"}])],
    }
    assert has_client_tool_call(state) is True


def test_has_client_tool_call_attr_message_false():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [_AttrMessage(tool_calls=[{"name": "search"}])],
    }
    assert has_client_tool_call(state) is False


def test_has_client_tool_call_attr_message_no_calls():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [_AttrMessage(tool_calls=None)],
    }
    assert has_client_tool_call(state) is False


# ---------------------------------------------------------------------------
# has_server_tool_call
# ---------------------------------------------------------------------------


def test_has_server_tool_call_known_server_name():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "search"}]}],
    }
    assert has_server_tool_call(state, ["search"]) is True


def test_has_server_tool_call_client_tool_name_is_false():
    """A call whose name is in the client catalog is NOT a server call."""
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "get_weather"}]}],
    }
    assert has_server_tool_call(state, ["search"]) is False


def test_has_server_tool_call_unknown_name_treated_as_server():
    """Unknown names (not client, not listed server) are treated as server-side."""
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "mystery_tool"}]}],
    }
    assert has_server_tool_call(state, []) is True


def test_has_server_tool_call_no_calls():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": []}],
    }
    assert has_server_tool_call(state, ["search"]) is False


def test_has_server_tool_call_mixed_calls():
    """If any call is a server call, returns True even if others are client calls."""
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [
            {"tool_calls": [{"name": "get_weather"}, {"name": "search"}]}
        ],
    }
    assert has_server_tool_call(state, ["search"]) is True


# ---------------------------------------------------------------------------
# route_after_agent
# ---------------------------------------------------------------------------


def test_route_after_agent_server_call_returns_tools():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "search"}]}],
    }
    assert route_after_agent(state, ["search"]) == "tools"


def test_route_after_agent_client_call_returns_end():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "get_weather"}]}],
    }
    assert route_after_agent(state, ["search"]) == "__end__"


def test_route_after_agent_no_calls_returns_end():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"content": "done"}],
    }
    assert route_after_agent(state, ["search"]) == "__end__"


def test_route_after_agent_custom_node_names():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "search"}]}],
    }
    result = route_after_agent(
        state, ["search"], tools_node="run_tools", end="DONE"
    )
    assert result == "run_tools"


def test_route_after_agent_custom_end_name():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"content": "no calls"}],
    }
    result = route_after_agent(state, ["search"], end="DONE")
    assert result == "DONE"


def test_route_after_agent_pure_client_call_custom_end():
    state = {
        "tools": [WEATHER_TOOL],
        "messages": [{"tool_calls": [{"name": "get_weather"}]}],
    }
    result = route_after_agent(state, [], end="END")
    assert result == "END"

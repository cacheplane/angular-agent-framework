# SPDX-License-Identifier: MIT
"""Tests for the `research_availability` delegation scenario — the tool is a
registered async-generator `@tool` that hands availability research to the
tool-less `availability_researcher` specialist. No live model calls: these
tests only inspect registration metadata (the module builds its OpenAI
clients with a placeholder key that would 401 at request time)."""

import inspect

from src.agent import agent, availability_researcher, research_availability


def _tool_names() -> list[str]:
    # Private-attr coupling (StrandsAgent._tools) is frozen by the git-ref
    # pin on ag-ui-strands in pyproject.toml.
    return [t.tool_name for t in agent._tools]


def test_research_availability_is_registered_on_the_agent():
    assert "research_availability" in _tool_names()
    # Existing tools stay registered untouched.
    assert "check_availability" in _tool_names()
    assert "book_meeting" in _tool_names()


def test_tool_name_and_docstring():
    assert research_availability.tool_name == "research_availability"
    description = research_availability.tool_spec["description"]
    assert description.startswith(
        "Delegate availability research for the given attendees to a specialist."
    )
    schema = research_availability.tool_spec["inputSchema"]["json"]
    assert set(schema["required"]) == {"attendees", "date_range"}


def test_tool_is_an_async_generator():
    # The seam depends on it: only an async-generator tool produces
    # tool_stream_events for the bridge to hand to the subagent emitter.
    assert inspect.isasyncgenfunction(research_availability._tool_func)


def test_specialist_is_toolless_researcher():
    assert availability_researcher.name == "availability_researcher"
    assert availability_researcher.tool_registry.registry == {}
    assert "availability researcher" in availability_researcher.system_prompt

"""Deep Agents planning capability: the real `deepagents` todo loop.

`create_deep_agent` with `TodoListMiddleware` gives the model a `write_todos`
tool and a `todos` key on the graph state. Every call to that tool replaces the
whole list, so the frontend reads `agent.value()['todos']` and re-renders the
checklist — including the mid-run revisions the agent makes when a lookup turns
up something the original plan did not account for.

Each todo is `{"content": str, "status": "pending" | "in_progress" |
"completed"}`. There is no stable identifier on a todo, so the panel tracks by
index rather than by id.
"""

from pathlib import Path

from deepagents import create_deep_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

FIELD_ELEVATION_FT = {
    "KSFO": 13,
    "KDEN": 5434,
    "KJFK": 13,
    "KASE": 7820,
    "KLAX": 125,
    "KBOS": 20,
}

RUNWAY_LENGTH_FT = {
    "KSFO": 11870,
    "KDEN": 16000,
    "KJFK": 14511,
    "KASE": 8006,
    "KLAX": 12091,
    "KBOS": 10083,
}

WEATHER = {
    "KSFO": "Marine layer, 800 ft overcast, visibility 4 SM, wind 280 at 14.",
    "KDEN": "Clear, visibility 10 SM, wind 350 at 22 gusting 31.",
    "KJFK": "Broken 3500 ft, visibility 10 SM, wind 040 at 9.",
    "KASE": "Few 12000 ft, visibility 10 SM, wind 300 at 6, mountain wave advisory.",
    "KLAX": "Clear, visibility 10 SM, wind 260 at 8.",
    "KBOS": "Overcast 1200 ft, visibility 6 SM, wind 120 at 17.",
}


@tool
def lookup_field_elevation(airport: str) -> str:
    """Return the field elevation in feet for a four-letter ICAO airport code."""
    elevation = FIELD_ELEVATION_FT.get(airport.upper())
    if elevation is None:
        return f"No field elevation on file for {airport.upper()}."
    return f"{airport.upper()} field elevation is {elevation} ft."


@tool
def lookup_runway_length(airport: str) -> str:
    """Return the longest runway length in feet for a four-letter ICAO airport code."""
    length = RUNWAY_LENGTH_FT.get(airport.upper())
    if length is None:
        return f"No runway data on file for {airport.upper()}."
    return f"{airport.upper()} longest runway is {length} ft."


@tool
def lookup_weather(airport: str) -> str:
    """Return the current field conditions for a four-letter ICAO airport code."""
    conditions = WEATHER.get(airport.upper())
    if conditions is None:
        return f"No observation on file for {airport.upper()}."
    return f"{airport.upper()}: {conditions}"


def build_planning_agent():
    """Build the planning agent.

    `TodoListMiddleware` is passed explicitly rather than relying on the
    `create_deep_agent` default set so the capability shows exactly which
    middleware puts `todos` on the state.
    """
    return create_deep_agent(
        model=ChatOpenAI(model="gpt-4.1", temperature=0),
        tools=[lookup_field_elevation, lookup_runway_length, lookup_weather],
        system_prompt=(PROMPTS_DIR / "planning.md").read_text(),
        middleware=[TodoListMiddleware()],
    )


graph = build_planning_agent()

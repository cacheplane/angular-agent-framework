"""Deep Agents subagents capability: real child agents behind the `task` tool.

`SubAgentMiddleware` gives the orchestrator a `task` tool taking
`{description, subagent_type}`. Each dispatch runs a real child graph in its own
`tools:<call_id>` namespace, and the child is seeded with the orchestrator's
`description` before its first token.

That ordering is what lets the frontend attribute child output: the
SubagentTracker registers the dispatch from the `task` call, then matches the
child stream by its description — exact match first, then containment either
way, then a single remaining candidate. On the Angular side the only wiring
needed is `subagentToolNames: ['task']`.

Parallel fan-out works: two `task` calls in one turn produce two children with
distinct namespaces, distinct transcripts, and no cross-wiring.
"""

from pathlib import Path

from deepagents import SubAgent, create_deep_agent
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


# region lookup-tools
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


# endregion

# region specialists
FIELD_RESEARCHER: SubAgent = {
    "name": "field-researcher",
    "description": "Gathers field elevation and runway length for one airport.",
    "system_prompt": (
        "You research airport field data for a dispatch desk. Use "
        "lookup_field_elevation and lookup_runway_length for the airport you were "
        "given. Reply with two sentences: the numbers, and whether the runway is "
        "long enough for a mid-size business jet at that elevation."
    ),
    "tools": [lookup_field_elevation, lookup_runway_length],
}

WEATHER_ANALYST: SubAgent = {
    "name": "weather-analyst",
    "description": "Reads the current conditions for one airport and calls out the operational impact.",
    "system_prompt": (
        "You read weather for a dispatch desk. Use lookup_weather for the airport "
        "you were given. Reply with two sentences: the conditions, and what they "
        "mean for a departure or arrival there."
    ),
    "tools": [lookup_weather],
}
# endregion


# region orchestrator
def build_subagents_agent():
    """Build the orchestrator.

    Passing `subagents` is what installs `SubAgentMiddleware` and, with it, the
    `task` tool. The orchestrator gets no lookup tools of its own so it has no
    way to answer without delegating.
    """
    return create_deep_agent(
        model=ChatOpenAI(model="gpt-4.1", temperature=0),
        system_prompt=(PROMPTS_DIR / "subagents.md").read_text(),
        subagents=[FIELD_RESEARCHER, WEATHER_ANALYST],
    )


graph = build_subagents_agent()
# endregion

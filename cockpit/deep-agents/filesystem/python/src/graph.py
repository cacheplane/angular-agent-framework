"""Deep Agents filesystem capability: a real agent-visible file tree.

`create_deep_agent` always installs `FilesystemMiddleware`. What this
capability adds is the two things that make the file tree worth rendering:

1. `StateBackend` — the agent's files live on the graph state under `files`,
   so every write streams to the client as a `values` update. A backend that
   stores files anywhere else (a host directory, a remote store) writes nothing
   to the state and the panel would stay empty.
2. A `FilesystemPermission` in `interrupt` mode on `/reports/**` — writes under
   that prefix pause the run for human approval instead of completing, which is
   what the interrupt panel renders.

Resuming an approval takes `{"decisions": [{"type": "approve"}]}`. A bare list
is a server-side TypeError.
"""

from pathlib import Path

from deepagents import create_deep_agent
from deepagents.backends import StateBackend
from deepagents.middleware import FilesystemPermission
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
# endregion


# region agent
def build_filesystem_agent():
    """Build the filesystem agent.

    `permissions` reaches `FilesystemMiddleware`, which pairs with
    `HumanInTheLoopMiddleware` to raise the interrupt. Anchor the pattern with a
    literal prefix: bulk tools (`ls`, `glob`, `grep`) decide whether to fire
    based on whether their search subtree could overlap the anchored prefix, so
    an unanchored pattern over-fires on every listing.
    """
    return create_deep_agent(
        model=ChatOpenAI(model="gpt-4.1", temperature=0),
        tools=[lookup_field_elevation, lookup_runway_length],
        system_prompt=(PROMPTS_DIR / "filesystem.md").read_text(),
        backend=StateBackend(),
        permissions=[
            FilesystemPermission(operations=["write"], paths=["/reports/**"], mode="interrupt"),
        ],
    )
# endregion


graph = build_filesystem_agent()

"""Deep Agents skills capability: SKILL.md progressive disclosure.

A skill is a folder with a `SKILL.md` whose YAML frontmatter carries a `name`
and a `description`. `SkillsMiddleware` loads only that frontmatter into the
system prompt — a short index the model can scan — and leaves the body on the
filesystem for the agent to `read_file` when a request actually matches. That
two-stage load is what "progressive disclosure" means: the instructions cost
nothing until they are needed, and a reference file inside the skill costs
nothing until the SKILL.md sends the agent to it.

Where the skills live matters. They must be readable through a backend, and this
demo is deployed on a shared public LangGraph deployment, so a host-filesystem
backend is out — `FilesystemBackend` documents itself as inappropriate for
servers, and the same reasoning retired the sandboxes topic. Instead the bundled
skills are seeded into a process-local `InMemoryStore` at import and mounted
read-only at `/skills/` through a `CompositeBackend`; everything else the agent
writes goes to the thread's own `StateBackend`.

Visibility: `skills_metadata` is annotated `PrivateStateAttr`, so it never
reaches the `values` stream. `SkillsVisibilityMiddleware` republishes it as a
`custom` stream event.
"""

from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from langchain.agents.middleware import AgentMiddleware
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.config import get_stream_writer
from langgraph.store.memory import InMemoryStore

# region skills-constants
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
SKILLS_DIR = Path(__file__).parent.parent / "skills"

#: Mount point the agent sees. `SkillsMiddleware` scans one level below it.
SKILLS_ROOT = "/skills/"

SKILLS_NAMESPACE = ("cockpit", "deep-agents-skills")

#: Custom stream event name the Angular panel listens for.
SKILLS_EVENT = "deep_agents.skills"
# endregion

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


# region seed-store
def _seed_skills_store() -> InMemoryStore:
    """Load the bundled skill folders into a process-local store.

    Read once at import. The store is never written to at runtime, so the agent
    sees `/skills/` as a stable read-only mount even though it is served by the
    same `StoreBackend` machinery as a writable one.
    """
    store = InMemoryStore()
    backend = StoreBackend(namespace=lambda _runtime: SKILLS_NAMESPACE, store=store)
    for path in sorted(SKILLS_DIR.rglob("*.md")):
        # Paths are stored WITHOUT the mount prefix. `CompositeBackend` strips
        # the route prefix before delegating, so a store seeded at
        # `/skills/runway-analysis/...` would surface as
        # `/skills/skills/runway-analysis/...` to the agent.
        backend.write(f"/{path.relative_to(SKILLS_DIR).as_posix()}", path.read_text())
    return store


SKILLS_STORE = _seed_skills_store()
# endregion


# region visibility-middleware
class SkillsVisibilityMiddleware(AgentMiddleware):
    """Republish `skills_metadata` as a `custom` stream event.

    Same shim as the memory capability's: the key stays private on the state and
    is announced alongside it, so a panel can render the loaded skill index
    while the agent works rather than only once the run settles.
    """

    @property
    def name(self) -> str:
        return "SkillsVisibilityMiddleware"

    def _emit(self, state: dict[str, Any]) -> None:
        metadata = state.get("skills_metadata")
        if metadata is None:
            return
        try:
            writer = get_stream_writer()
        except (RuntimeError, KeyError):
            return
        writer(
            {
                "name": SKILLS_EVENT,
                "data": {
                    "skills_metadata": metadata,
                    "skills_load_errors": state.get("skills_load_errors") or [],
                },
            }
        )

    def before_model(self, state: dict[str, Any], runtime: Any) -> None:  # noqa: ANN401, ARG002
        self._emit(state)
        return None

    def after_agent(self, state: dict[str, Any], runtime: Any) -> None:  # noqa: ANN401, ARG002
        self._emit(state)
        return None


# endregion


# region skills-agent
def build_skills_agent():
    """Build the skills agent.

    `CompositeBackend` routes by path prefix, longest first. `/skills/` resolves
    to the seeded store; everything else falls through to `StateBackend`, so any
    notes the agent writes stay on the thread and never touch the skill mount.
    """
    return create_deep_agent(
        model=ChatOpenAI(model="gpt-4.1", temperature=0),
        tools=[lookup_field_elevation, lookup_runway_length, lookup_weather],
        system_prompt=(PROMPTS_DIR / "skills.md").read_text(),
        backend=CompositeBackend(
            default=StateBackend(),
            routes={
                SKILLS_ROOT: StoreBackend(
                    namespace=lambda _runtime: SKILLS_NAMESPACE,
                    store=SKILLS_STORE,
                ),
            },
        ),
        skills=[SKILLS_ROOT],
        middleware=[SkillsVisibilityMiddleware()],
    )


# endregion


graph = build_skills_agent()

"""Deep Agents memory capability: cross-thread memory the agent writes itself.

Two pieces make this work:

* `memory=["/memories/AGENTS.md"]` installs `MemoryMiddleware`, which loads that
  file into the system prompt on every turn and tells the model to keep it up to
  date with `edit_file`. The agent authors its own memory; nothing here parses
  the conversation for facts.
* `StoreBackend` on a fixed namespace puts the file in LangGraph's `BaseStore`
  rather than on the thread's state, so it survives into the next thread. That
  is the whole point: a new conversation starts already knowing.

The visibility problem: `MemoryMiddleware` annotates `memory_contents` with
`PrivateStateAttr`, so it never appears in the `values` stream and a panel bound
to `agent.value()` would stay empty. `MemoryVisibilityMiddleware` below
republishes it as a `custom` stream event, which does reach the client. Custom
events are live-only, so the client also hydrates from `getState` when a thread
is reopened.
"""

from pathlib import Path
from typing import Any

from deepagents import create_deep_agent
from deepagents.backends import StoreBackend
from langchain.agents.middleware import AgentMiddleware
from langchain_openai import ChatOpenAI
from langgraph.config import get_stream_writer

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

MEMORY_FILE = "/memories/AGENTS.md"

#: Fixed namespace: every thread of this demo shares one memory. A real
#: deployment would scope it, e.g. `lambda rt: (rt.server_info.user.identity,)`.
MEMORY_NAMESPACE = ("cockpit", "deep-agents-memory")

#: Custom stream event name the Angular panel listens for.
MEMORY_EVENT = "deep_agents.memory"


class MemoryVisibilityMiddleware(AgentMiddleware):
    """Republish `memory_contents` as a `custom` stream event.

    `PrivateStateAttr` keeps the key out of the `values` stream, which is right
    for a transcript and wrong for a panel. This is a demo-side shim: the key
    stays private on the state and is simply announced alongside it.
    """

    @property
    def name(self) -> str:
        return "MemoryVisibilityMiddleware"

    def _emit(self, state: dict[str, Any]) -> None:
        contents = state.get("memory_contents")
        if contents is None:
            return
        try:
            writer = get_stream_writer()
        except (RuntimeError, KeyError):
            # No streaming context. The value is still on the checkpoint, which
            # is what the client's getState fallback reads.
            return
        writer({"name": MEMORY_EVENT, "data": {"memory_contents": contents}})

    def after_model(self, state: dict[str, Any], runtime: Any) -> None:  # noqa: ANN401, ARG002
        self._emit(state)
        return None

    def after_agent(self, state: dict[str, Any], runtime: Any) -> None:  # noqa: ANN401, ARG002
        self._emit(state)
        return None


def build_memory_agent():
    """Build the memory agent.

    `store=None` on `StoreBackend` means "resolve the store from the graph
    execution context", which is what the LangGraph server supplies. The
    namespace factory ignores its runtime argument on purpose, so every thread
    of this demo reads and writes the same memory.
    """
    return create_deep_agent(
        model=ChatOpenAI(model="gpt-4.1", temperature=0),
        system_prompt=(PROMPTS_DIR / "memory.md").read_text(),
        backend=StoreBackend(namespace=lambda _runtime: MEMORY_NAMESPACE),
        memory=[MEMORY_FILE],
        middleware=[MemoryVisibilityMiddleware()],
    )


graph = build_memory_agent()

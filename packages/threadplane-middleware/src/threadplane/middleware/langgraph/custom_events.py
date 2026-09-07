"""Emit a custom event that survives the ag-ui-langgraph bridge."""

from typing import Any, Optional

from langchain_core.callbacks.manager import adispatch_custom_event


async def emit_custom_event(
    name: str,
    value: Any,
    *,
    config: Optional[Any] = None,
) -> None:
    """Push ``value`` to the frontend as an AG-UI ``CUSTOM`` event.

    The ``ag-ui-langgraph`` bridge consumes the graph through ``astream_events``
    and forwards every ``on_custom_event`` it sees as a ``CUSTOM`` frame. Only
    ``adispatch_custom_event`` puts an ``on_custom_event`` on that stream:
    writing to ``get_stream_writer()`` with ``stream_mode="custom"`` surfaces at
    most as a raw event and is silently dropped, so nothing reaches the
    adapter's ``customEvents()`` signal. This helper is that call, named for
    what it does::

        from langchain_core.runnables import RunnableConfig
        from threadplane.middleware.langgraph import emit_custom_event

        async def analysis_node(state: State, config: RunnableConfig) -> State:
            await emit_custom_event("analysis_progress", {"pct": 42}, config=config)
            return state

    ``name`` becomes ``CustomStreamEvent.name`` on the client and ``value``
    becomes ``CustomStreamEvent.data``.

    Pass ``config`` when the node already receives one — LangChain then dispatches
    through that config's callback manager rather than the ambient contextvar,
    which is what keeps the event attributed correctly inside nested runnables
    and on Python 3.10, where the contextvar is not propagated automatically.
    Omit it and the ambient run context is used.
    """
    if config is None:
        await adispatch_custom_event(name, value)
    else:
        await adispatch_custom_event(name, value, config=config)

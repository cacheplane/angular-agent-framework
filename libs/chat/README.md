# chat

This library was generated with [Nx](https://nx.dev).

## Runtime adapters

Chat primitives consume a runtime-neutral `Agent` contract. Two adapters ship today:

- **`@ngaf/langgraph`** — for LangGraph / LangGraph Platform backends.
- **`@ngaf/ag-ui`** — for any AG-UI-compatible backend (LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime).

Custom backends can implement `Agent` directly with no library dependency.

See the capability matrix in the docs site for which primitives require which runtime capabilities.

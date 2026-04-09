# Chat Tool Calls with @cacheplane/chat

<Summary>
Display tool call execution and results using ChatToolCallsComponent
and ChatToolCallCardComponent. The agent invokes tools and the frontend
renders each call with its arguments and response.
</Summary>

<Prompt>
Add tool call visualization to your chat interface using
`ChatToolCallsComponent` and `ChatToolCallCardComponent` from
`@cacheplane/chat`. Display active tool calls in a sidebar.
</Prompt>

<Steps>
<Step title="Define tools in the backend">

Create LangChain tools using the `@tool` decorator:

```python
from langchain_core.tools import tool

@tool
def search(query: str) -> str:
    """Search the web for information."""
    return f"Results for '{query}'"
```

</Step>
<Step title="Bind tools to the LLM">

Bind the tools to the ChatOpenAI model so it can invoke them:

```python
llm = ChatOpenAI(model="gpt-5-mini", streaming=True).bind_tools(tools)
```

</Step>
<Step title="Create a tool node">

Use LangGraph's `ToolNode` to execute tool calls:

```python
from langgraph.prebuilt import ToolNode
tool_node = ToolNode(tools)
```

</Step>
<Step title="Render tool calls in the frontend">

Use `ChatToolCallsComponent` to display active tool calls:

```html
<chat-tool-calls [ref]="stream" />
```

</Step>
<Step title="Display individual tool cards">

Use `ChatToolCallCardComponent` for detailed tool call views
showing the tool name, arguments, and result:

```html
<chat-tool-call-card [ref]="stream" />
```

</Step>
</Steps>

<Tip>
Tool calls execute in a loop — the agent generates a tool call, the tool
node executes it, and the result feeds back into the agent for the next step.
</Tip>

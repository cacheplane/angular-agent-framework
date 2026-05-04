# @ngaf/langgraph

Adapter that wraps a LangGraph agent into the runtime-neutral `Agent` contract from `@ngaf/chat`.

## Citations

The `extractCitations()` function populates `Message.citations` from LangGraph message metadata. It reads from `additional_kwargs.citations` (preferred) or `additional_kwargs.sources` (fallback).

### Example: RAG chain with citations

```ts
import { additional_kwargs } from '@langchain/core/messages';

// In your LangGraph node:
const response = await llm.invoke([...]);

// Attach citations metadata:
const messageWithCitations = new AIMessage({
  content: response.content,
  additional_kwargs: {
    citations: [
      {
        id: 'doc-1',
        index: 1,
        title: 'Example Article',
        url: 'https://example.com/article',
        snippet: 'Relevant excerpt...'
      }
    ]
  }
});

// Message.citations auto-populates in @ngaf/chat via extractCitations()
```

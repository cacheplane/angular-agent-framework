# Spec A: LangSmith Deployment + Angular Runtime

## Problem

The cockpit's streaming example uses a hand-rolled `EventSource` service instead of the `angular` library — the product being demonstrated. The LangGraph backend isn't deployed anywhere. There's no CI to deploy it. Developers can't see a working example of `agent()` in action.

## Goal

Rewrite the Angular streaming example to use `agent()` from `@cacheplane/angular`. Deploy the LangGraph backend to LangGraph Cloud via CI. Make the cockpit's Run mode show a real working streaming chat powered by the library.

## Architecture

### Angular Example App

The streaming component uses `agent()` directly — no wrapper service. The function provides Signals for all state (messages, loading, errors), making the component purely reactive.

```
Angular Component
  └─ agent({ assistantId, apiUrl })
       └─ FetchStreamTransport (built-in)
            └─ @langchain/langgraph-sdk Client
                 └─ LangGraph Cloud API
```

**Key files:**

- `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts` — Standalone component with `agent()`. Chat UI bound to Signals. No service class needed.
- `cockpit/langgraph/streaming/angular/src/app/app.config.ts` — `provideAgent({ apiUrl })` for global config.
- `cockpit/langgraph/streaming/angular/src/environments/environment.ts` — Production LangGraph Cloud URL + assistant ID.
- `cockpit/langgraph/streaming/angular/src/environments/environment.development.ts` — Local dev URL (`http://localhost:8000`).

**Dependencies added to cockpit Angular app:**
- `@cacheplane/angular` (the library)
- `@langchain/langgraph-sdk` (peer dep)
- `@langchain/core` (peer dep)

**Component pattern:**

```typescript
@Component({ ... })
export class StreamingComponent {
  /**
   * Creates a streaming connection to the LangGraph Cloud backend.
   *
   * The `agent()` function returns a ref with Angular Signals
   * for messages, loading state, errors, and thread management.
   * All UI binds reactively — no manual subscriptions needed.
   */
  protected readonly stream = agent<{ messages: BaseMessage[] }>({
    assistantId: environment.streamingAssistantId,
    apiUrl: environment.langGraphApiUrl,
  });

  prompt = '';

  /**
   * Submits the user's message to the LangGraph streaming endpoint.
   *
   * Calls `stream.submit()` which fires the stream and updates
   * all Signals (messages, status, etc.) reactively as tokens arrive.
   */
  send(): void {
    const text = this.prompt.trim();
    if (!text || this.stream.isLoading()) return;
    this.prompt = '';
    this.stream.submit({ messages: [{ role: 'human', content: text }] });
  }
}
```

Template uses Signal reads directly: `stream.messages()`, `stream.isLoading()`, `stream.error()`.

### LangGraph Cloud Deployment

**CI workflow:** `.github/workflows/deploy-langgraph.yml`

Triggers:
- Push to `main` when `cockpit/**/python/**` changes
- Manual `workflow_dispatch` with optional `capability` input (e.g., `langgraph/streaming`)

Steps:
1. Checkout repo
2. Setup Python 3.12
3. Install `langgraph-cli` via pip
4. Deploy using `langgraph deploy` from the capability's python directory
5. Uses `LANGSMITH_API_KEY` secret

The existing `cockpit/langgraph/streaming/python/langgraph.json` provides the deployment config:
```json
{
  "graphs": {
    "streaming": {
      "module": "src.graph",
      "callable": "build_streaming_graph"
    }
  },
  "dependencies": ["./requirements.txt"],
  "env": ".env"
}
```

### Environment Configuration

The Angular app's environment files control which backend to connect to:

- **Production** (`environment.ts`): Points to LangGraph Cloud deployment URL
- **Development** (`environment.development.ts`): Points to `http://localhost:8123` for local LangGraph server

The cockpit's `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` controls where the Angular app itself is hosted (Vercel in prod, localhost:4300 in dev).

### Existing Capability Module Updates

The `langgraphStreamingPythonModule.codeAssetPaths` already points to the Angular files. No changes needed to the cockpit harness — only the Angular app files change.

## Deletions

- `cockpit/langgraph/streaming/angular/src/app/streaming.service.ts` — Removed. `agent()` replaces the hand-rolled EventSource service.

## Out of Scope

- Other capability examples (only streaming for this spec)
- Spec B: Narrative docs system (separate spec)
- LangGraph server for local development (developers use `langgraph dev` from the SDK)
- Angular app Vercel deployment (already configured in prior work)

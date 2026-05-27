# @threadplane/ag-ui

Adapter that wraps an [AG-UI](https://github.com/ag-ui-protocol/ag-ui) `AbstractAgent` into the runtime-neutral `Agent` contract from `@threadplane/chat`. Works with any AG-UI-compatible backend — LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime.

Part of [Threadplane](https://github.com/cacheplane/angular-agent-framework). MIT licensed.

## Install

```bash
npm install @threadplane/ag-ui @threadplane/chat @ag-ui/client
```

## Quick start

```ts
import { provideAgent, injectAgent } from '@threadplane/ag-ui';
import { ChatComponent } from '@threadplane/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ url: 'https://your.agent.endpoint' })],
};

// component
@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class App {
  protected readonly agent = injectAgent();
}
```

## Citations

The `bridgeCitationsState()` function populates `Message.citations` from AG-UI STATE_DELTA events. Citations are located at JSON Pointer `/citations/{messageId}`.

### Example: AG-UI citations state shape

```json
{
  "state": {
    "citations": {
      "msg-123": [
        {
          "id": "src1",
          "index": 1,
          "title": "Example Source",
          "url": "https://example.com",
          "snippet": "Relevant excerpt from the source..."
        }
      ]
    }
  }
}
```

Each citation object in the array supports `id`, `index`, `title`, `url`, `snippet`, and custom `extra` fields. The messageId key matches the corresponding message in the chat history.

## Documentation

- [Quickstart](https://threadplane.ai/docs/agent/getting-started/quickstart)
- [AG-UI adapter guide](https://threadplane.ai/docs/chat/guides/writing-an-adapter)
- [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui)

## License

MIT — free for any use. See [LICENSE](../../LICENSE).

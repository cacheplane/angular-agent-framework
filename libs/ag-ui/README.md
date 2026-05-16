# @ngaf/ag-ui

Adapter that wraps an [AG-UI](https://github.com/ag-ui-protocol/ag-ui) `AbstractAgent` into the runtime-neutral `Agent` contract from `@ngaf/chat`. Works with any AG-UI-compatible backend — LangGraph, CrewAI, Mastra, Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands, CopilotKit runtime.

Part of [Agent UI for Angular](https://github.com/cacheplane/angular-agent-framework). MIT licensed.

## Install

```bash
npm install @ngaf/ag-ui @ngaf/chat @ag-ui/client
```

## Quick start

```ts
import { provideAgUiAgent, AG_UI_AGENT } from '@ngaf/ag-ui';
import { ChatComponent } from '@ngaf/chat';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideAgUiAgent({ url: 'https://your.agent.endpoint' })],
};

// component
@Component({
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class App {
  protected readonly agent = inject(AG_UI_AGENT);
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

- [Quickstart](https://cacheplane.ai/docs/agent/getting-started/quickstart)
- [AG-UI adapter guide](https://cacheplane.ai/docs/chat/guides/writing-an-adapter)
- [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui)

## License

MIT — free for any use. See [LICENSE](../../LICENSE).

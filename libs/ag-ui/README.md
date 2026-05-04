# @ngaf/ag-ui

Adapter that wraps an [AG-UI](https://github.com/ag-ui-protocol/ag-ui) `AbstractAgent` into the runtime-neutral `Agent` contract from `@ngaf/chat`.

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

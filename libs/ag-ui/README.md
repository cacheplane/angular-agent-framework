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

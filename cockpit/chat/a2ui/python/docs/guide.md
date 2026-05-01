# A2UI Surfaces with @ngaf/chat

<Summary>
Render agent-driven interactive UI using the A2UI (Agent-to-UI) protocol.
The agent streams JSONL messages that build surfaces from the built-in
18-component catalog — no custom view components needed.
</Summary>

<Prompt>
Add A2UI surface rendering to your chat interface using `a2uiBasicCatalog()`
from `@ngaf/chat`. Pass it to `ChatComponent` via the `[views]` input
to enable A2UI surface rendering with automatic event routing.
</Prompt>

<Steps>
<Step title="Pass the A2UI catalog to ChatComponent">

Import `a2uiBasicCatalog()` and pass it via the `[views]` input:

```typescript
import { ChatComponent, a2uiBasicCatalog } from '@ngaf/chat';
import { agent } from '@ngaf/langgraph';

@Component({
  selector: 'app-a2ui',
  standalone: true,
  imports: [ChatComponent],
  template: `<chat [ref]="agentRef" [views]="catalog" class="block h-screen" />`,
})
export class A2uiComponent {
  protected readonly agentRef = agent({
    apiUrl: environment.langGraphApiUrl,
    assistantId: environment.a2uiAssistantId,
  });
  protected readonly catalog = a2uiBasicCatalog();
}
```

No event handler wiring needed — A2UI button events route back to the
agent automatically.

</Step>
<Step title="Configure the agent to emit A2UI JSONL">

The agent response must start with `---a2ui_JSON---` followed by
newline-delimited JSON messages:

```
---a2ui_JSON---
{"type":"createSurface","surfaceId":"s1","catalogId":"basic"}
{"type":"updateDataModel","surfaceId":"s1","value":{"name":""}}
{"type":"updateComponents","surfaceId":"s1","components":[...]}
```

Three message types build a surface:
1. `createSurface` — initializes the surface
2. `updateDataModel` — sets the initial data model state
3. `updateComponents` — defines the component tree

</Step>
<Step title="Understand the rendering pipeline">

When tokens stream in, `ContentClassifier` detects the `---a2ui_JSON---`
prefix and routes content to the A2UI pipeline:

1. `A2uiMessageParser` extracts complete JSON messages from the stream
2. `A2uiSurfaceStore` applies messages to build `A2uiSurface` objects
3. `A2uiSurfaceComponent` converts each surface to a json-render `Spec`
4. `RenderSpecComponent` renders the spec using the catalog components

</Step>
<Step title="Data model binding">

Components bind to the data model using path references:

```json
{"id": "name_field", "component": "TextField",
 "label": "Name", "value": {"path": "/name"}}
```

The `surfaceToSpec` function auto-detects path references and populates
`_bindings` for each input component — agents do not write `_bindings`
directly. When the user changes a bound input, the component emits a
data model update event.

**Known limitation:** Data model updates from user input do not currently
reflect to other components in real time. The agent can refresh state by
sending a new `updateDataModel` message.

</Step>
<Step title="Event routing">

Button actions with `event` type automatically route back to the agent
as a human message containing JSON:

```json
{"type": "a2ui_event", "surfaceId": "s1", "name": "formSubmit", "context": {"formId": "contact"}}
```

The agent receives this and can respond with a new surface, markdown, or
any other content.

</Step>
</Steps>

<Tip>
The 18-component A2UI catalog covers layout (Column, Row, Card), display
(Text, Image, Icon, Divider, List), input (TextField, CheckBox,
ChoicePicker, DateTimeInput, Slider), media (Video, AudioPlayer),
interactive (Button, Tabs, Modal). No custom components are needed for
standard forms and dashboards.
</Tip>

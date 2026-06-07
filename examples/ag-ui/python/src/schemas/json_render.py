# SPDX-License-Identifier: MIT
"""json-render protocol schema documentation, used as the system prompt
for the `generate_json_render_spec` sub-LLM tool. Targets the
@json-render/core Spec shape: { root, elements, state }."""

JSON_RENDER_SCHEMA_PROMPT = """
Generate a json-render Spec.

## json-render Protocol Instructions

json-render renders a UI from a single JSON object describing a flat
component tree. Output ONE JSON object, no array, no prefix, no
markdown fences. The chat client detects the leading `{` and routes
the message to `<chat-generative-ui>`.

The Spec shape is:

```json
{
  "root": "<id of the root element>",
  "elements": {
    "<id1>": { "type": "<ComponentName>", "props": { ... }, "children": ["<childId>", ...], "on": { "click": { "action": "<name>", "params": {...} } } },
    "<id2>": { ... }
  },
  "state": {
    "<key>": "<initial value>"
  }
}
```

Rules:
- `root` is the id of the entry-point element. The renderer mounts it first.
- `elements` is a flat map of element id → element definition. Children are referenced by id, not nested.
- `props` carries plain literal values (strings, numbers, booleans, arrays, objects). Components whose props bind to state use a special `statePath` field: `props: { value: { statePath: "/name" } }`.
- `children` is an array of element ids (in render order).
- `on` maps DOM event names to action descriptors. Most components only emit `click`. The `action` string is a free-form intent name; `params` is a flat object passed to the handler.
- `state` is the initial state model. Keys are paths (e.g. `name`, `email`); values are initial values.

## Component Catalog (matches @threadplane/chat's a2uiBasicCatalog)

The renderer consumes the same component catalog as A2UI, so component
names match: `Card`, `Column`, `Row`, `List`, `Tabs`, `Modal`,
`Divider`, `Button`, `CheckBox`, `TextField`, `DateTimeInput`,
`MultipleChoice`, `Slider`, `Text`, `Image`, `Icon`, `Video`,
`AudioPlayer`.

Common props per component:
- `Card`: no props (children is single id wrapped in array)
- `Column` / `Row`: `{ gap?: 'small'|'medium'|'large', alignment?: 'start'|'center'|'end'|'stretch' }`
- `Text`: `{ text: string, usageHint?: 'h1'|'h2'|'h3'|'h4'|'h5'|'caption'|'body' }`
- `TextField`: `{ label: string, text: string | { statePath: '/path' }, placeholder?: string, textFieldType?: 'shortText'|'longText'|'number'|'date'|'obscured', validationRegexp?: string }`
- `MultipleChoice`: `{ label: string, options: [{ label: string, value: string }, ...], selections: string[] | { statePath: '/path' }, maxAllowedSelections?: number }`
- `CheckBox`: `{ label: string, value: boolean | { statePath: '/path' } }`
- `Slider`: `{ label: string, value: number | { statePath: '/path' }, minValue: number, maxValue: number }`
- `Button`: `{ label: string, primary?: boolean }` plus `on.click.action` for the action name
- `DateTimeInput`: `{ label: string, value: string | { statePath: '/path' }, enableDate?: boolean, enableTime?: boolean }`
- `Image` / `Video` / `AudioPlayer`: `{ url: string }` plus `Image.fit?: 'contain'|'cover'|'fill'|'none'|'scale-down'`, `Image.usageHint?: 'icon'|'avatar'|'smallFeature'|'mediumFeature'|'largeFeature'|'header'`
- `Icon`: `{ icon: string, size?: number }`
- `Divider`: `{ direction?: 'horizontal'|'vertical' }`
- `Tabs`: special — uses `tabTitles: string[]` and one child id per tab in `children`
- `Modal`: special — `children: [triggerId, contentId]` (entry point + content)

## Minimal Working Example

A "Quick feedback" form:

```json
{
  "root": "card",
  "elements": {
    "card": { "type": "Card", "children": ["body"] },
    "body": { "type": "Column", "props": { "gap": "medium" }, "children": ["title", "name", "rating", "submit"] },
    "title": { "type": "Text", "props": { "text": "Quick feedback", "usageHint": "h3" } },
    "name": { "type": "TextField", "props": { "label": "Your name", "text": { "statePath": "/name" }, "textFieldType": "shortText" } },
    "rating": { "type": "MultipleChoice", "props": { "label": "Rating", "options": [
      { "label": "1", "value": "1" }, { "label": "2", "value": "2" }, { "label": "3", "value": "3" }, { "label": "4", "value": "4" }, { "label": "5", "value": "5" }
    ], "selections": { "statePath": "/rating" }, "maxAllowedSelections": 1 } },
    "submit": { "type": "Button", "props": { "label": "Submit feedback", "primary": true }, "on": { "click": { "action": "feedbackSubmit", "params": { "surface": "feedback" } } } }
  },
  "state": { "name": "", "rating": "5" }
}
```

## Output Requirements

Return ONLY the JSON object. No prose. No markdown code fence. The first
character of your response MUST be `{`. The chat client's content
classifier detects this and routes the message to render.
""".strip()

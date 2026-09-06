# A2UI Reference — booking-form demo

This capability drives an A2UI (Agent-to-UI) v0.9 surface. It is a reference
for the protocol and for the shape this demo emits; the graph does not read
this file at runtime. Each node carries its own inline instructions, and the
model never authors protocol envelopes directly.

## How the graph produces a surface

`route` inspects the newest message and dispatches to one of three nodes:

| Last message | Node | Surface |
|---|---|---|
| Anything that is not an event | `build_form` | A booking form |
| A `bookingSubmit` event | `search_flights` | Flight results |
| A flight-selection event | `confirm_booking` | A confirmation card |

Each node asks the model for **structured output** against a Pydantic schema
(`BookingFormSpec`, `FlightResultsSpec`, `ConfirmationSpec`) — a surface id, a
flat component list, and an optional data model. The node then wraps that
validated spec into A2UI JSONL itself: a `---a2ui_JSON---` prefix line followed
by `createSurface`, `updateComponents`, and, when a data model is present,
`updateDataModel`. Every envelope carries `"version": "v0.9"`. Because the
wrapping is code, a malformed surface is impossible; a schema violation falls
back to a sentinel form instead.

A `generate_title` node runs after every surface node and writes a short thread
title into thread metadata.

## Message Types

| Message | Purpose |
|---------|---------|
| `createSurface` | Initialize a surface. Must come first. `catalogId` is the basic-catalog URL. Set `sendDataModel: true` to receive the full data model with form submissions. |
| `updateDataModel` | Set data model values. `value` is plain JSON; optional `path` (JSON pointer) scopes the write, omitted or `/` replaces the whole model. Omitting `value` deletes the key at `path`. |
| `updateComponents` | Define the component tree. Components are FLAT: each has `id`, a `component` type string, and its props at the same level. Exactly one component must have `id: "root"`. |
| `deleteSurface` | Remove a surface. |

Dynamic prop values are bare literals (`"Hello"`, `5`, `true`) or `{"path": "/json/pointer"}` data-model bindings. There are no `literalString`-style wrappers and no type-keyed component wrappers.

## Available Components

### Display

| Component | Props |
|-----------|-------|
| `Text` | `text` (string or path ref), `variant` (`"h1"`–`"h5"`, `"caption"`, `"body"`) |
| `Image` | `url` (string), `description` (string), `fit` (`"contain"`\|`"cover"`\|`"fill"`\|`"none"`\|`"scaleDown"`), `variant` (`"icon"`\|`"avatar"`\|`"smallFeature"`\|`"mediumFeature"`\|`"largeFeature"`\|`"header"`) |
| `Icon` | `name` (Material Symbols camelCase name, e.g. `"check"`, `"shoppingCart"`) |
| `Divider` | `axis` (`"horizontal"`\|`"vertical"`) |

### Layout

| Component | Props |
|-----------|-------|
| `Column` | `children` (string[] of component IDs, or `{path, componentId}` template), `justify`, `align` |
| `Row` | `children` (same as Column), `justify`, `align` |
| `Card` | `child` (single component ID — wrap multiple elements in a Column/Row first) |
| `List` | `children`, `direction` (`"vertical"`\|`"horizontal"`), `align` |
| `Tabs` | `tabs` (array of `{title, child}` — `child` is a component ID) |
| `Modal` | `trigger` (component ID that opens it), `content` (component ID shown inside) |

### Input

| Component | Props |
|-----------|-------|
| `TextField` | `label` (string), `value` (string or path ref), `variant` (`"shortText"`\|`"longText"`\|`"number"`\|`"obscured"`), `validationRegexp` (string) |
| `CheckBox` | `label` (string), `value` (boolean or path ref) |
| `ChoicePicker` | `label` (string), `options` (array of `{label, value}`), `value` (path ref to a string array), `variant` (`"mutuallyExclusive"`\|`"multipleSelection"`), `displayStyle` (`"checkbox"`\|`"chips"`), `filterable` (boolean) |
| `DateTimeInput` | `label` (string), `value` (ISO 8601 string or path ref), `enableDate` (boolean), `enableTime` (boolean), `min` (string), `max` (string) |
| `Slider` | `label` (string), `value` (number or path ref), `min` (number), `max` (number, required) |

### Interactive

| Component | Props |
|-----------|-------|
| `Button` | `child` (ID of a `Text` component — the label; Button has NO text prop), `variant` (`"default"`\|`"primary"`\|`"borderless"`), `action` (Action object), `checks` (CheckRule[]) |

### Media

| Component | Props |
|-----------|-------|
| `Video` | `url` (string) |
| `AudioPlayer` | `url` (string), `description` (string) |

## Data Model Binding

Use `{"path": "/fieldName"}` as a prop value to bind it to the data model. When the user changes an input, the value at that path updates automatically.

```json
{"id": "name", "component": "TextField", "label": "Name", "value": {"path": "/name"}}
```

A `_bindings` prop is never emitted — the renderer generates bindings automatically from path references.

## Actions

Buttons carry an event action that sends data back to the graph. The event wraps a `name` and a plain-object `context`:

```json
{
  "action": {
    "event": {
      "name": "bookingSubmit",
      "context": {
        "formId": "booking",
        "origin": {"path": "/origin"}
      }
    }
  }
}
```

Context values can be path references (resolved at click time) or literal values. An event arrives back as a human-role JSON message, which is what `route` matches on.

## Validation (checks)

Input components and buttons can have a `checks` array for client-side validation. Each check has a `condition` and an error `message`. If any check fails, the button is disabled and error messages display.

```json
{
  "checks": [
    {
      "condition": {"call": "required", "args": {"value": {"path": "/name"}}},
      "message": "Name is required"
    }
  ]
}
```

Built-in validation functions: `required`, `email`, `regex`, `length`, `numeric`.

Compose with `and`, `or`, `not`:

```json
{
  "condition": {
    "call": "and",
    "args": {
      "values": [
        {"call": "required", "args": {"value": {"path": "/name"}}},
        {"call": "email", "args": {"value": {"path": "/email"}}}
      ]
    }
  },
  "message": "Name and valid email required"
}
```

## Invariants the emitted surfaces hold

1. The message body starts with `---a2ui_JSON---`, then one JSON envelope per line, every one carrying `"version": "v0.9"`.
2. `createSurface` comes first, then `updateComponents`, then `updateDataModel` when there is a data model.
3. Every component referenced in `children` / `child` / `trigger` / `content` has a matching `id` in the components array.
4. Exactly one component has `id: "root"`, early in the components array so rendering can start immediately.
5. No component definition carries `_bindings`.

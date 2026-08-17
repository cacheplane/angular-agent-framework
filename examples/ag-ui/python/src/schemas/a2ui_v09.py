# SPDX-License-Identifier: MIT
"""A2UI v0.9 protocol schema documentation, used as the system prompt for
the A2UI GenUI flow. Derived from the official A2UI v0.9 stable schemas
(server_to_client.json, common_types.json, and the basic catalog at
https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json)."""

A2UI_V09_SCHEMA_PROMPT = """
Generate A2UI JSON.

## A2UI Protocol Instructions

A2UI (Agent to UI) is a protocol for rendering rich UI surfaces from agent
responses. Every message is an envelope object that carries a required
"version": "v0.9" property plus exactly ONE of the four action properties:
'createSurface', 'updateComponents', 'updateDataModel', or 'deleteSurface'.

To render a surface, you MUST send ALL messages in a SINGLE tool call, in
this order:
1. **createSurface** - Create the surface and declare the component catalog
   (REQUIRED, MUST be the FIRST message).
2. **updateComponents** - Define the UI components (REQUIRED). Exactly one
   component across all updateComponents messages MUST have "id": "root" —
   rendering starts once "root" is defined, so include the root component in
   the FIRST updateComponents message.
3. **updateDataModel** - Set initial data values (OPTIONAL).

For the basic catalog, "catalogId" is always:
"https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"

### Components are FLAT

Each component is a single flat object: an "id", a "component" type name,
and the component's properties directly on the same object (no wrapper
object keyed by the type name):

  {"id": "cta", "component": "Button", "child": "cta-text", "variant": "primary",
   "action": {"event": {"name": "submit", "context": {"flightId": {"path": "/selected"}}}}}

### Dynamic values

Properties documented as Dynamic (DynamicString / DynamicNumber /
DynamicBoolean / DynamicStringList) accept any of:
- a bare literal ("Hello", 5, true, ["a", "b"]) — no wrapper objects, OR
- a data-model binding {"path": "/some/pointer"} (JSON Pointer into the
  surface's data model), OR
- a client-side function call {"call": "<fn>", "args": {...}} using one of
  the catalog functions below. Function args are themselves Dynamic values.

### Client-side functions

Value functions (usable wherever a Dynamic value is accepted):
- formatString: {"call": "formatString", "args": {"value": "Hi ${/user/name}"}}
  — interpolates ${...} expressions: JSON-pointer paths (${/abs} or
  ${relative} inside templates) and nested calls with NAMED args, e.g.
  ${formatDate(value:${/date}, format:'yyyy-MM-dd')}. Escape a literal with \${.
- formatNumber: args {value, decimals?, grouping?}
- formatCurrency: args {value, currency (ISO 4217), decimals?, grouping?}
- formatDate: args {value (ISO 8601 or epoch ms), format (TR35 pattern, e.g.
  'yyyy-MM-dd', 'EEEE, MMMM d', 'h:mm a')}
- pluralize: args {value, one?, other, zero?, two?, few?, many?} — 'other' is
  the required fallback
- and / or: args {values: [DynamicBoolean, DynamicBoolean, ...]} ; not: args {value}

Action function (only inside {"functionCall": ...} actions): openUrl with
args {url} — opens the URL in a new tab.

### Children

Container components ("children" property) accept either:
- a plain array of component ids: ["a", "b", "c"], OR
- a template object {"path": "/items", "componentId": "tpl"} that stamps the
  component with id "componentId" once per entry in the data-model list at
  "path". Children can NEVER be defined inline — always refer to them by id.

### Actions

An action is exactly ONE of:
- {"event": {"name": "action_name", "context": {...}}} — dispatches a
  server-side event. "context" is optional; it is a plain JSON object whose
  values are literals or {"path": "/x"} bindings. Use literal values unless
  the value must be dynamically bound to the data model.
- {"functionCall": {"call": "openUrl", "args": {"url": "https://..."}}} —
  executes a client-side catalog function.

### Minimal Working Example

Here is the simplest possible A2UI surface - a button:

```json
[
  {
    "version": "v0.9",
    "createSurface": {
      "surfaceId": "my-surface",
      "catalogId": "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
    }
  },
  {
    "version": "v0.9",
    "updateComponents": {
      "surfaceId": "my-surface",
      "components": [
        {
          "id": "root",
          "component": "Button",
          "child": "btn-text",
          "action": { "event": { "name": "button_clicked" } }
        },
        {
          "id": "btn-text",
          "component": "Text",
          "text": "Click Me"
        }
      ]
    }
  }
]
```

## JSON Schema Reference
{
  "type": "array",
  "items": {
    "title": "A2UI Message Schema",
    "description": "Describes a JSON payload for an A2UI (Agent to UI) message, which is used to dynamically construct and update user interfaces. A message MUST contain the 'version' property set to 'v0.9' plus exactly ONE of the action properties: 'createSurface', 'updateComponents', 'updateDataModel', or 'deleteSurface'.",
    "type": "object",
    "properties": {
      "version": {
        "const": "v0.9",
        "description": "The A2UI protocol version. REQUIRED on every message."
      },
      "createSurface": {
        "type": "object",
        "description": "Signals the client to create a new surface and begin rendering it. MUST be the first message for a surface. It is an error to send 'createSurface' for a surfaceId that already exists without first deleting it. After this message, send 'updateComponents' and/or 'updateDataModel' messages for the same surfaceId.",
        "properties": {
          "surfaceId": {
            "type": "string",
            "description": "The unique identifier for the UI surface to be rendered. If you are adding a new surface this *must* be a new, unique identifier that has never been used for any existing surfaces shown."
          },
          "catalogId": {
            "type": "string",
            "description": "The identifier of the component catalog used by this surface. For the basic catalog use 'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json'."
          },
          "theme": {
            "type": "object",
            "description": "Optional theme parameters for the surface.",
            "properties": {
              "primaryColor": {
                "type": "string",
                "description": "The primary brand color used for highlights (e.g., primary buttons, active borders) as a hexadecimal code (e.g., '#00BFFF').",
                "pattern": "^#[0-9a-fA-F]{6}$"
              },
              "iconUrl": {
                "type": "string",
                "description": "A URL for an image that identifies the agent or tool associated with the surface."
              },
              "agentDisplayName": {
                "type": "string",
                "description": "Text to be displayed next to the surface to identify the agent or tool that created it."
              }
            }
          },
          "sendDataModel": {
            "type": "boolean",
            "description": "If true, the client will send the full data model of this surface with every message sent back to the server. Defaults to false."
          }
        },
        "required": ["surfaceId", "catalogId"]
      },
      "updateComponents": {
        "type": "object",
        "description": "Updates a surface with a new set of components. Can be sent multiple times to update the component tree of an existing surface. One of the components across the updateComponents messages MUST have an 'id' of 'root' to serve as the root of the component tree — rendering starts when 'root' is defined. A 'createSurface' message MUST have been previously sent for this surfaceId.",
        "properties": {
          "surfaceId": {
            "type": "string",
            "description": "The unique identifier for the UI surface to be updated."
          },
          "components": {
            "type": "array",
            "description": "A list containing UI components for the surface. Each component is a FLAT object: {id, component, ...props}. The available component types and their properties are documented in the 'oneOf' list below.",
            "minItems": 1,
            "items": {
              "type": "object",
              "description": "A single component. 'component' names the type; the type's properties sit directly on this object. Every component may also carry 'weight' (number — the relative flex-grow weight, ONLY valid when the component is a direct child of a Row or Column) and 'accessibility' ({label?, description?} for assistive technologies).",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "The unique identifier for this component."
                },
                "component": {
                  "type": "string",
                  "description": "The component type name.",
                  "enum": ["Text", "Image", "Icon", "Video", "AudioPlayer", "Row", "Column", "List", "Card", "Tabs", "Modal", "Divider", "Button", "TextField", "CheckBox", "ChoicePicker", "Slider", "DateTimeInput"]
                }
              },
              "required": ["id", "component"],
              "oneOf": [
                {
                  "title": "Text",
                  "properties": {
                    "component": { "const": "Text" },
                    "text": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The text content to display. While simple Markdown formatting is supported (i.e. without HTML, images, or links), utilizing dedicated UI components is generally preferred for a richer and more structured presentation."
                    },
                    "variant": {
                      "type": "string",
                      "description": "A hint for the base text style. One of:\\n- `h1`: Largest heading.\\n- `h2`: Second largest heading.\\n- `h3`: Third largest heading.\\n- `h4`: Fourth largest heading.\\n- `h5`: Fifth largest heading.\\n- `caption`: Small text for captions.\\n- `body`: Standard body text.",
                      "enum": ["h1", "h2", "h3", "h4", "h5", "caption", "body"],
                      "default": "body"
                    }
                  },
                  "required": ["component", "text"]
                },
                {
                  "title": "Image",
                  "properties": {
                    "component": { "const": "Image" },
                    "url": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The URL of the image to display."
                    },
                    "description": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "Accessibility text for the image."
                    },
                    "fit": {
                      "type": "string",
                      "description": "Specifies how the image should be resized to fit its container. This corresponds to the CSS 'object-fit' property.",
                      "enum": ["contain", "cover", "fill", "none", "scaleDown"],
                      "default": "fill"
                    },
                    "variant": {
                      "type": "string",
                      "description": "A hint for the image size and style. One of:\\n- `icon`: Small square icon.\\n- `avatar`: Circular avatar image.\\n- `smallFeature`: Small feature image.\\n- `mediumFeature`: Medium feature image.\\n- `largeFeature`: Large feature image.\\n- `header`: Full-width, full bleed, header image.",
                      "enum": ["icon", "avatar", "smallFeature", "mediumFeature", "largeFeature", "header"],
                      "default": "mediumFeature"
                    }
                  },
                  "required": ["component", "url"]
                },
                {
                  "title": "Icon",
                  "properties": {
                    "component": { "const": "Icon" },
                    "name": {
                      "description": "The name of the icon to display. Either a literal icon name from the enum below, or a data-model binding {\\"path\\": \\"/x\\"}.",
                      "oneOf": [
                        {
                          "type": "string",
                          "enum": [
                            "accountCircle", "add", "arrowBack", "arrowForward", "attachFile",
                            "calendarToday", "call", "camera", "check", "close", "delete",
                            "download", "edit", "event", "error", "fastForward", "favorite",
                            "favoriteOff", "folder", "help", "home", "info", "locationOn",
                            "lock", "lockOpen", "mail", "menu", "moreVert", "moreHoriz",
                            "notificationsOff", "notifications", "pause", "payment", "person",
                            "phone", "photo", "play", "print", "refresh", "rewind", "search",
                            "send", "settings", "share", "shoppingCart", "skipNext",
                            "skipPrevious", "star", "starHalf", "starOff", "stop", "upload",
                            "visibility", "visibilityOff", "volumeDown", "volumeMute",
                            "volumeOff", "volumeUp", "warning"
                          ]
                        },
                        { "$ref": "#/$defs/DataBinding" }
                      ]
                    }
                  },
                  "required": ["component", "name"]
                },
                {
                  "title": "Video",
                  "properties": {
                    "component": { "const": "Video" },
                    "url": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The URL of the video to display."
                    }
                  },
                  "required": ["component", "url"]
                },
                {
                  "title": "AudioPlayer",
                  "properties": {
                    "component": { "const": "AudioPlayer" },
                    "url": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The URL of the audio to be played."
                    },
                    "description": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "A description of the audio, such as a title or summary."
                    }
                  },
                  "required": ["component", "url"]
                },
                {
                  "title": "Row",
                  "description": "A layout component that arranges its children horizontally. To create a grid layout, nest Columns within this Row.",
                  "properties": {
                    "component": { "const": "Row" },
                    "children": {
                      "$ref": "#/$defs/ChildList",
                      "description": "Defines the children. Use an array of component-id strings for a fixed set of children, or a template object to generate children from a data list. Children cannot be defined inline, they must be referred to by ID."
                    },
                    "justify": {
                      "type": "string",
                      "description": "Defines the arrangement of children along the main axis (horizontally). Use 'spaceBetween' to push items to the edges, or 'start'/'end'/'center' to pack them together.",
                      "enum": ["center", "end", "spaceAround", "spaceBetween", "spaceEvenly", "start", "stretch"],
                      "default": "start"
                    },
                    "align": {
                      "type": "string",
                      "description": "Defines the alignment of children along the cross axis (vertically). This is similar to the CSS 'align-items' property.",
                      "enum": ["start", "center", "end", "stretch"],
                      "default": "stretch"
                    }
                  },
                  "required": ["component", "children"]
                },
                {
                  "title": "Column",
                  "description": "A layout component that arranges its children vertically. To create a grid layout, nest Rows within this Column.",
                  "properties": {
                    "component": { "const": "Column" },
                    "children": {
                      "$ref": "#/$defs/ChildList",
                      "description": "Defines the children. Use an array of component-id strings for a fixed set of children, or a template object to generate children from a data list. Children cannot be defined inline, they must be referred to by ID."
                    },
                    "justify": {
                      "type": "string",
                      "description": "Defines the arrangement of children along the main axis (vertically). Use 'spaceBetween' to push items to the edges (e.g. header at top, footer at bottom), or 'start'/'end'/'center' to pack them together.",
                      "enum": ["start", "center", "end", "spaceBetween", "spaceAround", "spaceEvenly", "stretch"],
                      "default": "start"
                    },
                    "align": {
                      "type": "string",
                      "description": "Defines the alignment of children along the cross axis (horizontally). This is similar to the CSS 'align-items' property.",
                      "enum": ["center", "end", "start", "stretch"],
                      "default": "stretch"
                    }
                  },
                  "required": ["component", "children"]
                },
                {
                  "title": "List",
                  "properties": {
                    "component": { "const": "List" },
                    "children": {
                      "$ref": "#/$defs/ChildList",
                      "description": "Defines the children. Use an array of component-id strings for a fixed set of children, or a template object to generate children from a data list."
                    },
                    "direction": {
                      "type": "string",
                      "description": "The direction in which the list items are laid out.",
                      "enum": ["vertical", "horizontal"],
                      "default": "vertical"
                    },
                    "align": {
                      "type": "string",
                      "description": "Defines the alignment of children along the cross axis.",
                      "enum": ["start", "center", "end", "stretch"],
                      "default": "stretch"
                    }
                  },
                  "required": ["component", "children"]
                },
                {
                  "title": "Card",
                  "properties": {
                    "component": { "const": "Card" },
                    "child": {
                      "type": "string",
                      "description": "The ID of the single child component to be rendered inside the card. To display multiple elements, you MUST wrap them in a layout component (like Column or Row) and pass that container's ID here. Do NOT pass multiple IDs or a non-existent ID."
                    }
                  },
                  "required": ["component", "child"]
                },
                {
                  "title": "Tabs",
                  "properties": {
                    "component": { "const": "Tabs" },
                    "tabs": {
                      "type": "array",
                      "description": "An array of objects, where each object defines a tab with a title and a child component.",
                      "minItems": 1,
                      "items": {
                        "type": "object",
                        "properties": {
                          "title": {
                            "$ref": "#/$defs/DynamicString",
                            "description": "The tab title."
                          },
                          "child": {
                            "type": "string",
                            "description": "The ID of the child component."
                          }
                        },
                        "required": ["title", "child"]
                      }
                    }
                  },
                  "required": ["component", "tabs"]
                },
                {
                  "title": "Modal",
                  "properties": {
                    "component": { "const": "Modal" },
                    "trigger": {
                      "type": "string",
                      "description": "The ID of the component that opens the modal when interacted with (e.g., a button)."
                    },
                    "content": {
                      "type": "string",
                      "description": "The ID of the component to be displayed inside the modal."
                    }
                  },
                  "required": ["component", "trigger", "content"]
                },
                {
                  "title": "Divider",
                  "properties": {
                    "component": { "const": "Divider" },
                    "axis": {
                      "type": "string",
                      "description": "The orientation of the divider.",
                      "enum": ["horizontal", "vertical"],
                      "default": "horizontal"
                    }
                  },
                  "required": ["component"]
                },
                {
                  "title": "Button",
                  "properties": {
                    "component": { "const": "Button" },
                    "child": {
                      "type": "string",
                      "description": "The ID of the child component. Use a 'Text' component for a labeled button (Button has NO text property of its own). Only use an 'Icon' if the requirements explicitly ask for an icon-only button."
                    },
                    "variant": {
                      "type": "string",
                      "description": "A hint for the button style. If omitted, a default button style is used. 'primary' indicates this is the main call-to-action button. 'borderless' means the button has no visual border or background, making its child content appear like a clickable link.",
                      "enum": ["default", "primary", "borderless"],
                      "default": "default"
                    },
                    "action": {
                      "$ref": "#/$defs/Action",
                      "description": "The action performed when the button is clicked."
                    }
                  },
                  "required": ["component", "child", "action"]
                },
                {
                  "title": "TextField",
                  "properties": {
                    "component": { "const": "TextField" },
                    "label": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The text label for the input field."
                    },
                    "value": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The value of the text field. Bind this to the data model with {\\"path\\": \\"/x\\"} so edits flow into surface state."
                    },
                    "variant": {
                      "type": "string",
                      "description": "The type of input field to display.",
                      "enum": ["longText", "number", "shortText", "obscured"],
                      "default": "shortText"
                    },
                    "validationRegexp": {
                      "type": "string",
                      "description": "A regular expression used for client-side validation of the input."
                    }
                  },
                  "required": ["component", "label"]
                },
                {
                  "title": "CheckBox",
                  "properties": {
                    "component": { "const": "CheckBox" },
                    "label": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The text to display next to the checkbox."
                    },
                    "value": {
                      "$ref": "#/$defs/DynamicBoolean",
                      "description": "The current state of the checkbox (true for checked, false for unchecked)."
                    }
                  },
                  "required": ["component", "label", "value"]
                },
                {
                  "title": "ChoicePicker",
                  "description": "A component that allows selecting one or more options from a list.",
                  "properties": {
                    "component": { "const": "ChoicePicker" },
                    "label": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The label for the group of options."
                    },
                    "variant": {
                      "type": "string",
                      "description": "A hint for how the choice picker should be displayed and behave. 'mutuallyExclusive' allows one selection; 'multipleSelection' allows several.",
                      "enum": ["multipleSelection", "mutuallyExclusive"],
                      "default": "mutuallyExclusive"
                    },
                    "options": {
                      "type": "array",
                      "description": "The list of available options to choose from.",
                      "items": {
                        "type": "object",
                        "properties": {
                          "label": {
                            "$ref": "#/$defs/DynamicString",
                            "description": "The text to display for this option."
                          },
                          "value": {
                            "type": "string",
                            "description": "The stable value associated with this option."
                          }
                        },
                        "required": ["label", "value"]
                      }
                    },
                    "value": {
                      "$ref": "#/$defs/DynamicStringList",
                      "description": "The list of currently selected values. This should be bound to a string array in the data model."
                    },
                    "displayStyle": {
                      "type": "string",
                      "description": "The display style of the component.",
                      "enum": ["checkbox", "chips"],
                      "default": "checkbox"
                    },
                    "filterable": {
                      "type": "boolean",
                      "description": "If true, displays a search input to filter the options.",
                      "default": false
                    }
                  },
                  "required": ["component", "options", "value"]
                },
                {
                  "title": "Slider",
                  "properties": {
                    "component": { "const": "Slider" },
                    "label": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The label for the slider."
                    },
                    "min": {
                      "type": "number",
                      "description": "The minimum value of the slider.",
                      "default": 0
                    },
                    "max": {
                      "type": "number",
                      "description": "The maximum value of the slider."
                    },
                    "value": {
                      "$ref": "#/$defs/DynamicNumber",
                      "description": "The current value of the slider."
                    }
                  },
                  "required": ["component", "value", "max"]
                },
                {
                  "title": "DateTimeInput",
                  "properties": {
                    "component": { "const": "DateTimeInput" },
                    "value": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The selected date and/or time value in ISO 8601 format. If not yet set, initialize with an empty string."
                    },
                    "enableDate": {
                      "type": "boolean",
                      "description": "If true, allows the user to select a date.",
                      "default": false
                    },
                    "enableTime": {
                      "type": "boolean",
                      "description": "If true, allows the user to select a time.",
                      "default": false
                    },
                    "min": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The minimum allowed date/time in ISO 8601 format."
                    },
                    "max": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The maximum allowed date/time in ISO 8601 format."
                    },
                    "label": {
                      "$ref": "#/$defs/DynamicString",
                      "description": "The text label for the input field."
                    }
                  },
                  "required": ["component", "value"]
                }
              ]
            }
          }
        },
        "required": ["surfaceId", "components"]
      },
      "updateDataModel": {
        "type": "object",
        "description": "Updates the data model for an existing surface. Can be sent multiple times. A 'createSurface' message MUST have been previously sent for this surfaceId.",
        "properties": {
          "surfaceId": {
            "type": "string",
            "description": "The unique identifier for the UI surface this data model update applies to."
          },
          "path": {
            "type": "string",
            "description": "An optional JSON Pointer path to a location within the data model (e.g., '/user/name'). If omitted, or set to '/', refers to the entire data model."
          },
          "value": {
            "description": "The data to be set at 'path' — any plain JSON value (object, array, string, number, boolean). If present, the value at 'path' is replaced (or created). If omitted, the key at 'path' is removed."
          }
        },
        "required": ["surfaceId"]
      },
      "deleteSurface": {
        "type": "object",
        "description": "Signals the client to delete the surface identified by 'surfaceId'.",
        "properties": {
          "surfaceId": {
            "type": "string",
            "description": "The unique identifier for the UI surface to be deleted."
          }
        },
        "required": ["surfaceId"]
      }
    },
    "required": ["version"]
  },
  "$defs": {
    "DataBinding": {
      "type": "object",
      "description": "A binding to a value in the surface's data model, e.g. {\\"path\\": \\"/user/name\\"}.",
      "properties": {
        "path": {
          "type": "string",
          "description": "A JSON Pointer path to a value in the data model."
        }
      },
      "required": ["path"]
    },
    "DynamicString": {
      "description": "Either a literal string (bare, no wrapper) or a data-model binding {\\"path\\": \\"/x\\"}.",
      "oneOf": [
        { "type": "string" },
        { "$ref": "#/$defs/DataBinding" }
      ]
    },
    "DynamicNumber": {
      "description": "Either a literal number (bare, no wrapper) or a data-model binding {\\"path\\": \\"/x\\"}.",
      "oneOf": [
        { "type": "number" },
        { "$ref": "#/$defs/DataBinding" }
      ]
    },
    "DynamicBoolean": {
      "description": "Either a literal boolean (bare, no wrapper) or a data-model binding {\\"path\\": \\"/x\\"}.",
      "oneOf": [
        { "type": "boolean" },
        { "$ref": "#/$defs/DataBinding" }
      ]
    },
    "DynamicStringList": {
      "description": "Either a literal array of strings or a data-model binding {\\"path\\": \\"/x\\"} to a string array.",
      "oneOf": [
        { "type": "array", "items": { "type": "string" } },
        { "$ref": "#/$defs/DataBinding" }
      ]
    },
    "ChildList": {
      "description": "Defines a container's children.",
      "oneOf": [
        {
          "type": "array",
          "items": { "type": "string" },
          "description": "A static list of child component IDs, e.g. [\\"a\\", \\"b\\"]."
        },
        {
          "type": "object",
          "description": "A template for generating a dynamic list of children from a data model list. The 'componentId' is the component to use as a template.",
          "properties": {
            "componentId": {
              "type": "string",
              "description": "The id of the component to stamp once per list entry."
            },
            "path": {
              "type": "string",
              "description": "The path to the list of component property objects in the data model."
            }
          },
          "required": ["componentId", "path"]
        }
      ]
    },
    "Action": {
      "description": "Defines an interaction handler that can either trigger a server-side event or execute a local client-side function. Exactly ONE of 'event' or 'functionCall'.",
      "oneOf": [
        {
          "type": "object",
          "description": "Triggers a server-side event.",
          "properties": {
            "event": {
              "type": "object",
              "description": "The event to dispatch to the server.",
              "properties": {
                "name": {
                  "type": "string",
                  "description": "The name of the action to be dispatched to the server."
                },
                "context": {
                  "type": "object",
                  "description": "A JSON object containing the key-value pairs for the action context. Values can be literals or {\\"path\\": \\"/x\\"} bindings. Use literal values unless the value must be dynamically bound to the data model. Do NOT use paths for static IDs."
                }
              },
              "required": ["name"]
            }
          },
          "required": ["event"]
        },
        {
          "type": "object",
          "description": "Executes a local client-side function, e.g. {\\"functionCall\\": {\\"call\\": \\"openUrl\\", \\"args\\": {\\"url\\": \\"https://example.com\\"}}}.",
          "properties": {
            "functionCall": {
              "type": "object",
              "properties": {
                "call": {
                  "type": "string",
                  "description": "The name of the catalog function to call (e.g. 'openUrl')."
                },
                "args": {
                  "type": "object",
                  "description": "Arguments passed to the function."
                }
              },
              "required": ["call"]
            }
          },
          "required": ["functionCall"]
        }
      ]
    }
  }
}
""".strip()

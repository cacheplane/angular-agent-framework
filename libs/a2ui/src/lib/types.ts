// SPDX-License-Identifier: MIT

// --- Protocol constants ---

/** Wire version stamped on every A2UI v0.9-family envelope. */
export const A2UI_WIRE_VERSION = 'v0.9';
/** MIME type for A2UI payloads, standardized in the v0.9.1 release. */
export const A2UI_MIME_TYPE = 'application/a2ui+json';
/** Catalog id of the standard A2UI basic component catalog. */
export const A2UI_BASIC_CATALOG_ID =
  'https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json';

// --- Dynamic values ---
// A dynamic value is a bare literal, a data-model binding, or a client-side
// function call (typed here; function execution ships in a later phase).

/** JSON-pointer data-model binding. Absolute (`/a/b`) or relative inside templates. */
export interface A2uiPathRef {
  path: string;
}

/** Client-side function invocation (e.g. `formatString`, `required`). */
export interface A2uiFunctionCall {
  call: string;
  args?: Record<string, unknown>;
  returnType?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any' | 'void';
}

export type DynamicString = string | A2uiPathRef | A2uiFunctionCall;
export type DynamicNumber = number | A2uiPathRef | A2uiFunctionCall;
export type DynamicBoolean = boolean | A2uiPathRef | A2uiFunctionCall;
export type DynamicStringList = string[] | A2uiPathRef | A2uiFunctionCall;
/** Any dynamic value position where the concrete type is component-defined. */
export type DynamicValue = unknown;

// --- Children ---

/** Static child-id list, or a template stamped per element of a data-model list. */
export type A2uiChildren = string[] | { path: string; componentId: string };

// --- Actions ---

/** Dispatches a named event (with optional context) to the agent. */
export interface A2uiEventAction {
  event: {
    name: string;
    context?: Record<string, DynamicValue>;
  };
}

/** Executes a client-side function locally (e.g. `openUrl`). */
export interface A2uiFunctionAction {
  functionCall: A2uiFunctionCall;
}

export type A2uiAction = A2uiEventAction | A2uiFunctionAction;

// --- Validation checks (typed in Phase 1, enforced in Phase 3) ---

export interface A2uiCheck {
  call: string;
  args?: Record<string, DynamicValue>;
  message?: string;
}

// --- Components (flat, discriminated by the `component` string) ---

export interface A2uiComponentBase {
  id: string;
  component: string;
  /** Overrides the surface's default catalog for this component. */
  catalogId?: string;
  /** Flex-grow-like weight; only valid as a direct child of Row/Column. */
  weight?: number;
  /** Accessibility attributes (spec `AccessibilityAttributes`). */
  accessibility?: Record<string, unknown>;
}

/** Mixin for input components that support client-side validation checks. */
export interface A2uiCheckable {
  checks?: A2uiCheck[];
}

export interface A2uiText extends A2uiComponentBase {
  component: 'Text';
  text: DynamicString;
  variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';
}

export interface A2uiImage extends A2uiComponentBase {
  component: 'Image';
  url: DynamicString;
  description?: DynamicString;
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scaleDown';
  variant?: 'icon' | 'avatar' | 'smallFeature' | 'mediumFeature' | 'largeFeature' | 'header';
}

export interface A2uiIcon extends A2uiComponentBase {
  component: 'Icon';
  name: DynamicString | { svgPath: string };
}

export interface A2uiVideo extends A2uiComponentBase {
  component: 'Video';
  url: DynamicString;
}

export interface A2uiAudioPlayer extends A2uiComponentBase {
  component: 'AudioPlayer';
  url: DynamicString;
  description?: DynamicString;
}

type A2uiJustify =
  | 'start' | 'center' | 'end'
  | 'spaceAround' | 'spaceBetween' | 'spaceEvenly' | 'stretch';
type A2uiAlign = 'start' | 'center' | 'end' | 'stretch';

export interface A2uiRow extends A2uiComponentBase {
  component: 'Row';
  children: A2uiChildren;
  justify?: A2uiJustify;
  align?: A2uiAlign;
}

export interface A2uiColumn extends A2uiComponentBase {
  component: 'Column';
  children: A2uiChildren;
  justify?: A2uiJustify;
  align?: A2uiAlign;
}

export interface A2uiList extends A2uiComponentBase {
  component: 'List';
  children: A2uiChildren;
  direction?: 'vertical' | 'horizontal';
  align?: A2uiAlign;
}

export interface A2uiCard extends A2uiComponentBase {
  component: 'Card';
  child: string;
}

export interface A2uiTabs extends A2uiComponentBase {
  component: 'Tabs';
  tabs: { title: DynamicString; child: string }[];
}

export interface A2uiModal extends A2uiComponentBase {
  component: 'Modal';
  trigger: string;
  content: string;
}

export interface A2uiDivider extends A2uiComponentBase {
  component: 'Divider';
  axis?: 'horizontal' | 'vertical';
}

export interface A2uiButton extends A2uiComponentBase {
  component: 'Button';
  child: string;
  variant?: 'default' | 'primary' | 'borderless';
  action: A2uiAction;
}

export interface A2uiCheckBox extends A2uiComponentBase, A2uiCheckable {
  component: 'CheckBox';
  label: DynamicString;
  value: DynamicBoolean;
}

export interface A2uiTextField extends A2uiComponentBase, A2uiCheckable {
  component: 'TextField';
  label: DynamicString;
  value?: DynamicString;
  variant?: 'shortText' | 'longText' | 'number' | 'obscured';
  validationRegexp?: string;
}

export interface A2uiDateTimeInput extends A2uiComponentBase, A2uiCheckable {
  component: 'DateTimeInput';
  /** ISO 8601 value. */
  value: DynamicString;
  enableDate?: boolean;
  enableTime?: boolean;
  min?: DynamicString;
  max?: DynamicString;
  label?: DynamicString;
}

export interface A2uiChoicePicker extends A2uiComponentBase, A2uiCheckable {
  component: 'ChoicePicker';
  options: { label: DynamicString; value: string }[];
  value: DynamicStringList;
  variant?: 'mutuallyExclusive' | 'multipleSelection';
  displayStyle?: 'checkbox' | 'chips';
  filterable?: boolean;
  label?: DynamicString;
}

export interface A2uiSlider extends A2uiComponentBase, A2uiCheckable {
  component: 'Slider';
  value: DynamicNumber;
  max: number;
  min?: number;
  label?: DynamicString;
}

/** Union of the basic-catalog component shapes. */
export type A2uiCatalogComponent =
  | A2uiText | A2uiImage | A2uiIcon | A2uiVideo | A2uiAudioPlayer
  | A2uiRow | A2uiColumn | A2uiList | A2uiCard | A2uiTabs | A2uiModal | A2uiDivider
  | A2uiButton | A2uiCheckBox | A2uiTextField | A2uiDateTimeInput
  | A2uiChoicePicker | A2uiSlider;

/**
 * Any component, including non-basic-catalog types. Renderers treat unknown
 * `component` strings as unrenderable and fall back gracefully.
 */
export type A2uiComponent = A2uiCatalogComponent | (A2uiComponentBase & Record<string, unknown>);

// --- Theme ---

export interface A2uiTheme {
  primaryColor?: string;
  iconUrl?: string;
  agentDisplayName?: string;
}

// --- Envelopes (agent → client) ---

export interface A2uiCreateSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  /** When true, the client attaches the surface's full data model to every outbound message. */
  sendDataModel?: boolean;
}

export interface A2uiUpdateComponents {
  surfaceId: string;
  components: A2uiComponent[];
}

export interface A2uiUpdateDataModel {
  surfaceId: string;
  /** JSON pointer into the data model. Omitted or `/` targets the whole model. */
  path?: string;
  /** Replacement value at `path`. Omitted value deletes the key at `path`. */
  value?: unknown;
}

export interface A2uiDeleteSurface {
  surfaceId: string;
}

interface A2uiEnvelopeBase {
  /** Wire version; `v0.9` for the stable family. */
  version: string;
}

export type A2uiMessage = A2uiEnvelopeBase &
  (
    | { createSurface: A2uiCreateSurface }
    | { updateComponents: A2uiUpdateComponents }
    | { updateDataModel: A2uiUpdateDataModel }
    | { deleteSurface: A2uiDeleteSurface }
  );

// --- Client → agent messages ---

export interface A2uiClientDataModel {
  surfaces: Record<string, Record<string, unknown>>;
}

export interface A2uiClientCapabilities {
  supportedCatalogIds: string[];
  inlineCatalogs?: unknown[];
}

export interface A2uiActionMessage {
  version: string;
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context?: Record<string, unknown>;
    /**
     * Threadplane extension: optional human-friendly label for the action —
     * typically derived from the source component's authored text (e.g. a
     * Button's child Text). Used by the chat-lib's transcript renderer to
     * label the user bubble; backends may ignore. See spec
     * 2026-05-19-llm-generated-labels-design.md.
     */
    label?: string;
  };
  metadata?: {
    a2uiClientDataModel?: A2uiClientDataModel;
  };
}

export interface A2uiErrorMessage {
  version: string;
  error: {
    code: string;
    surfaceId?: string;
    path?: string;
    message?: string;
  };
}

// --- Surface (internal renderer model, not wire format) ---

export interface A2uiSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  sendDataModel?: boolean;
  components: Map<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
}

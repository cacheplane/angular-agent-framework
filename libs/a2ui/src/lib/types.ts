// SPDX-License-Identifier: MIT

// --- Theme ---

export interface A2uiTheme {
  primaryColor?: string;
  iconUrl?: string;
  agentDisplayName?: string;
}

// --- Dynamic value types (always wrapped in v1) ---

export type DynamicString =
  | { literalString: string }
  | { path: string };

export type DynamicNumber =
  | { literalNumber: number }
  | { path: string };

export type DynamicBoolean =
  | { literalBoolean: boolean }
  | { path: string };

export type DynamicStringList =
  | { literalArray: string[] }
  | { path: string };

// --- Children ---

export type A2uiChildren =
  | { explicitList: string[] }
  | { template: { componentId: string; dataBinding: string } };

// --- Actions ---

export interface A2uiActionContextEntry {
  key: string;
  value: DynamicString | DynamicNumber | DynamicBoolean;
}

export interface A2uiAction {
  name: string;
  context?: A2uiActionContextEntry[];
}

// --- Per-component property interfaces ---

export interface A2uiText {
  text: DynamicString;
  usageHint?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'caption' | 'body';
}

export interface A2uiImage {
  url: DynamicString;
  alt?: DynamicString;
  width?: number;
  height?: number;
}

export interface A2uiIcon {
  icon: DynamicString;
  size?: number;
}

export interface A2uiVideo {
  url: DynamicString;
  autoPlay?: boolean;
  controls?: boolean;
}

export interface A2uiAudioPlayer {
  url: DynamicString;
  autoPlay?: boolean;
  controls?: boolean;
}

export interface A2uiRow {
  children: A2uiChildren;
  gap?: number;
  alignment?: 'start' | 'center' | 'end' | 'stretch';
  distribution?: 'start' | 'center' | 'end' | 'space-between' | 'space-around';
}

export interface A2uiColumn {
  children: A2uiChildren;
  gap?: number;
  alignment?: 'start' | 'center' | 'end' | 'stretch';
}

export interface A2uiList {
  children: A2uiChildren;
  direction?: 'vertical' | 'horizontal';
}

export interface A2uiCard {
  child: string;
}

export interface A2uiTabItem {
  title: DynamicString;
  child: string;
}

export interface A2uiTabs {
  tabItems: A2uiTabItem[];
}

export interface A2uiDivider {
  direction?: 'horizontal' | 'vertical';
}

export interface A2uiModal {
  entryPointChild: string;
  contentChild: string;
  title?: DynamicString;
}

export interface A2uiButton {
  child: string;
  primary?: boolean;
  action: A2uiAction;
}

export interface A2uiCheckBox {
  label: DynamicString;
  checked: DynamicBoolean;
  action?: A2uiAction;
}

export interface A2uiTextField {
  label: DynamicString;
  text?: DynamicString;
  textFieldType?: 'date' | 'longText' | 'number' | 'shortText' | 'obscured';
  validationRegexp?: string;
}

export interface A2uiDateTimeInput {
  label: DynamicString;
  value?: DynamicString;
  enableDate?: boolean;
  enableTime?: boolean;
}

export interface A2uiMultipleChoice {
  selections: DynamicStringList;
  options: { label: DynamicString; value: string }[];
  maxAllowedSelections?: number;
  label?: DynamicString;
}

export interface A2uiSlider {
  value: DynamicNumber;
  minValue?: number;
  maxValue?: number;
  step?: number;
  label?: DynamicString;
}

// --- Component wrapper (type-keyed discriminated union) ---

export type A2uiComponentDef =
  | { Text: A2uiText }
  | { Image: A2uiImage }
  | { Icon: A2uiIcon }
  | { Video: A2uiVideo }
  | { AudioPlayer: A2uiAudioPlayer }
  | { Row: A2uiRow }
  | { Column: A2uiColumn }
  | { List: A2uiList }
  | { Card: A2uiCard }
  | { Tabs: A2uiTabs }
  | { Divider: A2uiDivider }
  | { Modal: A2uiModal }
  | { Button: A2uiButton }
  | { CheckBox: A2uiCheckBox }
  | { TextField: A2uiTextField }
  | { DateTimeInput: A2uiDateTimeInput }
  | { MultipleChoice: A2uiMultipleChoice }
  | { Slider: A2uiSlider };

export interface A2uiComponent {
  id: string;
  weight?: number;
  component: A2uiComponentDef;
}

// --- Envelopes ---

export interface A2uiSurfaceUpdate {
  surfaceId: string;
  components: A2uiComponent[];
}

export interface A2uiDataModelEntry {
  key: string;
  valueString?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueMap?: A2uiDataModelEntry[];
}

export interface A2uiDataModelUpdate {
  surfaceId: string;
  path?: string;
  contents: A2uiDataModelEntry[];
}

export interface A2uiBeginRendering {
  surfaceId: string;
  root: string;
  styles?: { font?: string; primaryColor?: string };
}

export interface A2uiDeleteSurface {
  surfaceId: string;
}

export type A2uiMessage =
  | { surfaceUpdate: A2uiSurfaceUpdate }
  | { dataModelUpdate: A2uiDataModelUpdate }
  | { beginRendering: A2uiBeginRendering }
  | { deleteSurface: A2uiDeleteSurface };

// --- Surface (internal model, not constrained by wire format) ---

export interface A2uiSurface {
  surfaceId: string;
  catalogId: string;
  theme?: A2uiTheme;
  sendDataModel?: boolean;
  components: Map<string, A2uiComponent>;
  dataModel: Record<string, unknown>;
  /** Styles set by the agent via `beginRendering.styles`. The
   * canonical v1 spec defines exactly two fields: `font` (primary
   * font for the UI) and `primaryColor` (hex `#RRGGBB`). The renderer
   * applies these as CSS custom properties on the surface root,
   * overriding any consumer-set defaults for the duration of the
   * surface's life. Anything richer (typography scale, spacing,
   * elevation, etc.) is the renderer's private vocabulary and not
   * communicated through this field. */
  styles?: { font?: string; primaryColor?: string };
}

// --- Outbound shapes ---

export interface A2uiClientDataModel {
  version: 'v1';
  surfaces: Record<string, Record<string, unknown>>;
}

export interface A2uiActionMessage {
  version: 'v1';
  action: {
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context: Record<string, unknown>;
  };
  metadata?: {
    a2uiClientDataModel: A2uiClientDataModel;
  };
}

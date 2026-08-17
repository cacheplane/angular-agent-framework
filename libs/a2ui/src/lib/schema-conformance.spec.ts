// SPDX-License-Identifier: MIT
//
// Drift tripwire against the OFFICIAL A2UI v0.9 JSON schemas vendored in
// libs/a2ui/schemas/ (see the README there for source URLs + refresh steps).
//
// These are hand-rolled structural checks, not a JSON-schema validator: the
// expectations below were derived by reading the vendored files once and
// writing them out explicitly. When the vendored schemas are refreshed and
// upstream changed (or a local prop typo sneaks in), these tests fail and
// point at what to update.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createA2uiFunctionRegistry } from './functions';
import { A2UI_WIRE_VERSION } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonSchema = Record<string, any>;

function loadSchema(name: string): JsonSchema {
  return JSON.parse(readFileSync(join(__dirname, '../../schemas', name), 'utf8'));
}

const catalog = loadSchema('basic-catalog.json');
const envelope = loadSchema('server_to_client.json');

// --- Structural extraction helpers ------------------------------------------
// Merges allOf/oneOf/anyOf branches, resolves only local #/$defs refs, and
// treats external refs (common_types.json etc.) as opaque.

function resolveLocal(root: JsonSchema, node: unknown): JsonSchema | undefined {
  if (node === null || typeof node !== 'object') return undefined;
  const schema = node as JsonSchema;
  const ref = schema['$ref'];
  if (typeof ref === 'string') {
    if (!ref.startsWith('#/$defs/')) return schema; // external ref: opaque
    return resolveLocal(root, root['$defs']?.[ref.slice('#/$defs/'.length)]);
  }
  return schema;
}

interface ExtractedShape {
  props: Set<string>;
  enums: Record<string, string[]>;
}

function extractShape(
  root: JsonSchema,
  node: unknown,
  out: ExtractedShape = { props: new Set(), enums: {} },
): ExtractedShape {
  const schema = resolveLocal(root, node);
  if (!schema) return out;
  for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
    if (Array.isArray(schema[key])) {
      for (const branch of schema[key]) extractShape(root, branch, out);
    }
  }
  if (schema['properties'] && typeof schema['properties'] === 'object') {
    for (const [name, propNode] of Object.entries(schema['properties'])) {
      out.props.add(name);
      const prop = resolveLocal(root, propNode);
      if (!prop) continue;
      if (Array.isArray(prop['enum'])) out.enums[name] = prop['enum'];
      if (Array.isArray(prop['oneOf'])) {
        for (const branch of prop['oneOf']) {
          const resolved = resolveLocal(root, branch);
          if (resolved && Array.isArray(resolved['enum'])) {
            out.enums[name] = resolved['enum'];
          }
        }
      }
    }
  }
  return out;
}

// --- (a) Component set -------------------------------------------------------

/**
 * The 18 basic-catalog components our `A2uiCatalogComponent` union covers —
 * see libs/a2ui/src/lib/types.ts. If this assertion fails after refreshing
 * the vendored catalog, upstream added/removed/renamed a component: update
 * the union in types.ts (and the renderer) plus this list.
 */
const OUR_COMPONENTS = [
  'AudioPlayer',
  'Button',
  'Card',
  'CheckBox',
  'ChoicePicker',
  'Column',
  'DateTimeInput',
  'Divider',
  'Icon',
  'Image',
  'List',
  'Modal',
  'Row',
  'Slider',
  'Tabs',
  'Text',
  'TextField',
  'Video',
] as const;

describe('vendored catalog component set', () => {
  it('matches the components our A2uiCatalogComponent union covers', () => {
    const catalogComponents = Object.keys(catalog['components']).sort();
    expect(catalogComponents).toEqual([...OUR_COMPONENTS]);
  });
});

// --- (b) Per-component properties + enums ------------------------------------

const JUSTIFY = ['start', 'center', 'end', 'spaceAround', 'spaceBetween', 'spaceEvenly', 'stretch'];
const ALIGN = ['start', 'center', 'end', 'stretch'];

/**
 * Expected structural shape of each catalog component schema, transcribed
 * from the vendored basic-catalog.json (props are the schema's own property
 * names after merging allOf branches; shared base props like `id`, `checks`
 * and `accessibility` live behind external/common refs and are opaque here).
 * A mismatch after a refresh means upstream changed a component contract —
 * reconcile types.ts and the renderer, then update this map.
 */
const EXPECTED_SHAPES: Record<string, { props: string[]; enums?: Record<string, string[]> }> = {
  Text: {
    props: ['component', 'text', 'variant', 'weight'],
    enums: { variant: ['h1', 'h2', 'h3', 'h4', 'h5', 'caption', 'body'] },
  },
  Image: {
    props: ['component', 'description', 'fit', 'url', 'variant', 'weight'],
    enums: {
      fit: ['contain', 'cover', 'fill', 'none', 'scaleDown'],
      variant: ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'],
    },
  },
  Icon: {
    // `name` is a large enum of standard icon names (or an svgPath object);
    // we intentionally pass names through without enumerating them.
    props: ['component', 'name', 'weight'],
  },
  Video: { props: ['component', 'url', 'weight'] },
  AudioPlayer: { props: ['component', 'description', 'url', 'weight'] },
  Row: {
    props: ['align', 'children', 'component', 'justify', 'weight'],
    enums: { justify: JUSTIFY, align: ALIGN },
  },
  Column: {
    props: ['align', 'children', 'component', 'justify', 'weight'],
    enums: { justify: JUSTIFY, align: ALIGN },
  },
  List: {
    props: ['align', 'children', 'component', 'direction', 'weight'],
    enums: { direction: ['vertical', 'horizontal'], align: ALIGN },
  },
  Card: { props: ['child', 'component', 'weight'] },
  Tabs: { props: ['component', 'tabs', 'weight'] },
  Modal: { props: ['component', 'content', 'trigger', 'weight'] },
  Divider: {
    props: ['axis', 'component', 'weight'],
    enums: { axis: ['horizontal', 'vertical'] },
  },
  Button: {
    props: ['action', 'child', 'component', 'variant', 'weight'],
    enums: { variant: ['default', 'primary', 'borderless'] },
  },
  TextField: {
    props: ['component', 'label', 'validationRegexp', 'value', 'variant', 'weight'],
    enums: { variant: ['shortText', 'longText', 'number', 'obscured'] },
  },
  CheckBox: { props: ['component', 'label', 'value', 'weight'] },
  ChoicePicker: {
    props: ['component', 'displayStyle', 'filterable', 'label', 'options', 'value', 'variant', 'weight'],
    enums: {
      variant: ['mutuallyExclusive', 'multipleSelection'],
      displayStyle: ['checkbox', 'chips'],
    },
  },
  Slider: { props: ['component', 'label', 'max', 'min', 'value', 'weight'] },
  DateTimeInput: {
    props: ['component', 'enableDate', 'enableTime', 'label', 'max', 'min', 'value', 'weight'],
  },
};

describe('vendored catalog component shapes', () => {
  for (const name of OUR_COMPONENTS) {
    it(`${name} properties and enums match the implemented contract`, () => {
      const expected = EXPECTED_SHAPES[name];
      expect(expected, `missing EXPECTED_SHAPES entry for ${name}`).toBeDefined();
      const shape = extractShape(catalog, catalog['components'][name]);
      expect([...shape.props].sort()).toEqual([...expected.props].sort());
      for (const [prop, values] of Object.entries(expected.enums ?? {})) {
        expect(
          [...(shape.enums[prop] ?? [])].sort(),
          `${name}.${prop} enum drifted`,
        ).toEqual([...values].sort());
      }
      // No unexpected enums appeared on props we treat as free-form
      // (Icon.name's icon-name enum is deliberately exempt).
      const knownEnums = new Set(Object.keys(expected.enums ?? {}));
      if (name === 'Icon') knownEnums.add('name');
      for (const prop of Object.keys(shape.enums)) {
        expect(knownEnums.has(prop), `${name}.${prop} gained an enum upstream`).toBe(true);
      }
    });
  }
});

// --- (c) Envelope messages ---------------------------------------------------

describe('vendored server_to_client envelope', () => {
  const MESSAGES = [
    'CreateSurfaceMessage',
    'UpdateComponentsMessage',
    'UpdateDataModelMessage',
    'DeleteSurfaceMessage',
  ];

  it('defines exactly the four messages we parse', () => {
    const refs = (envelope['oneOf'] as JsonSchema[]).map((b) => b['$ref']);
    expect(refs.sort()).toEqual(MESSAGES.map((m) => `#/$defs/${m}`).sort());
    expect(Object.keys(envelope['$defs']).sort()).toEqual([...MESSAGES].sort());
  });

  for (const message of MESSAGES) {
    it(`${message} requires version const A2UI_WIRE_VERSION`, () => {
      const def = envelope['$defs'][message];
      expect(def['required']).toContain('version');
      expect(def['properties']['version']['const']).toBe(A2UI_WIRE_VERSION);
    });
  }
});

// --- (d) Client-side functions -----------------------------------------------

describe('vendored catalog functions map', () => {
  it('equals our registry keys plus openUrl (action-only, handled by the renderer)', () => {
    const schemaFunctions = Object.keys(catalog['functions']).sort();
    const ourFunctions = [...createA2uiFunctionRegistry().keys(), 'openUrl'].sort();
    expect(schemaFunctions).toEqual(ourFunctions);
  });
});

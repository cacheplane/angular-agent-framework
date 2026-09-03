import { describe, expect, test } from 'vitest';
import {
  A2UI_WIRE_VERSION, A2UI_MIME_TYPE, A2UI_BASIC_CATALOG_ID,
} from './types';
import type {
  A2uiMessage, A2uiComponent, DynamicString,
  A2uiButton, A2uiText, A2uiTextField, A2uiCard, A2uiChoicePicker,
  A2uiChildren, A2uiAction, A2uiActionMessage, A2uiErrorMessage,
} from './types';

describe('a2ui v0.9 types', () => {
  test('protocol constants', () => {
    expect(A2UI_WIRE_VERSION).toBe('v0.9');
    expect(A2UI_MIME_TYPE).toBe('application/a2ui+json');
    expect(A2UI_BASIC_CATALOG_ID).toContain('catalogs/basic/catalog.json');
  });

  test('DynamicString accepts bare literal, path binding, or function call', () => {
    const lit: DynamicString = 'hello';
    const ref: DynamicString = { path: '/title' };
    const call: DynamicString = { call: 'formatString', args: { value: { path: '/n' } } };
    expect(lit).toBeDefined();
    expect(ref).toBeDefined();
    expect(call).toBeDefined();
  });

  test('components are flat, discriminated by component string', () => {
    const button: A2uiButton = {
      id: 'cta', component: 'Button', child: 'cta-text', variant: 'primary',
      action: { event: { name: 'submit', context: { flightId: { path: '/selected' } } } },
    };
    const text: A2uiText = { id: 't', component: 'Text', text: 'Hi', variant: 'h2' };
    expect(button.component).toBe('Button');
    expect(text.component).toBe('Text');
  });

  test('every envelope carries version and is discriminated by envelope key', () => {
    const create: A2uiMessage = {
      version: 'v0.9',
      createSurface: { surfaceId: 's1', catalogId: A2UI_BASIC_CATALOG_ID, sendDataModel: true },
    };
    const update: A2uiMessage = {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: 'Column', children: ['title', 'cta'] } as A2uiComponent,
          { id: 'title', component: 'Text', text: 'Hello' } as A2uiComponent,
        ],
      },
    };
    const data: A2uiMessage = {
      version: 'v0.9',
      updateDataModel: { surfaceId: 's1', path: '/selected', value: 'UA-42' },
    };
    const del: A2uiMessage = { version: 'v0.9', deleteSurface: { surfaceId: 's1' } };
    expect('createSurface' in create).toBe(true);
    expect('updateComponents' in update).toBe(true);
    expect('updateDataModel' in data).toBe(true);
    expect('deleteSurface' in del).toBe(true);
  });

  test('updateDataModel value is optional (omission means delete at path)', () => {
    const del: A2uiMessage = {
      version: 'v0.9',
      updateDataModel: { surfaceId: 's1', path: '/stale' },
    };
    expect('updateDataModel' in del && del.updateDataModel.value).toBeUndefined();
  });

  test('children accept a static id list or a template object', () => {
    const list: A2uiChildren = ['a', 'b'];
    const template: A2uiChildren = { path: '/items', componentId: 'row-template' };
    expect(Array.isArray(list)).toBe(true);
    expect('componentId' in template).toBe(true);
  });

  test('actions are event- or functionCall-shaped', () => {
    const evt: A2uiAction = { event: { name: 'submit', context: { id: 'x' } } };
    const fn: A2uiAction = { functionCall: { call: 'openUrl', args: { url: 'https://x' } } };
    expect('event' in evt).toBe(true);
    expect('functionCall' in fn).toBe(true);
  });

  test('A2uiTextField uses bare or bound label/value with v0.9 variant enum', () => {
    const tf: A2uiTextField = {
      id: 'name', component: 'TextField',
      label: 'Name', value: { path: '/name' }, variant: 'shortText',
    };
    expect(tf.label).toBe('Name');
  });

  test('A2uiCard has single child (not array)', () => {
    const card: A2uiCard = { id: 'c', component: 'Card', child: 'inner' };
    expect(card.child).toBe('inner');
  });

  test('A2uiChoicePicker has options + value + variant/displayStyle', () => {
    const cp: A2uiChoicePicker = {
      id: 'pick', component: 'ChoicePicker',
      value: { path: '/picked' },
      options: [
        { label: 'A', value: 'a' },
        { label: { path: '/labels/b' }, value: 'b' },
      ],
      variant: 'mutuallyExclusive',
      displayStyle: 'chips',
    };
    expect(cp.options).toHaveLength(2);
  });

  test('outbound action message carries name/surface/source/timestamp/context', () => {
    const msg: A2uiActionMessage = {
      version: 'v0.9',
      action: {
        name: 'submit', surfaceId: 's1', sourceComponentId: 'cta',
        timestamp: '2026-08-17T00:00:00Z', context: { flightId: 'UA-42' },
      },
    };
    expect(msg.action.name).toBe('submit');
  });

  test('outbound error message shape', () => {
    const err: A2uiErrorMessage = {
      version: 'v0.9',
      error: { code: 'VALIDATION_FAILED', surfaceId: 's1', path: '/name', message: 'required' },
    };
    expect(err.error.code).toBe('VALIDATION_FAILED');
  });
});

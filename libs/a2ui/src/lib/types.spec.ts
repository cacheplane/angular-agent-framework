// SPDX-License-Identifier: MIT
import { describe, expect, test } from 'vitest';
import type {
  A2uiMessage, A2uiComponentDef, DynamicString, DynamicNumber,
  A2uiButton, A2uiText, A2uiTextField, A2uiCard, A2uiMultipleChoice,
  A2uiSurfaceUpdate, A2uiBeginRendering, A2uiDataModelUpdate,
} from './types';

describe('a2ui v1 types', () => {
  test('DynamicString accepts literalString or path', () => {
    const lit: DynamicString = { literalString: 'hello' };
    const ref: DynamicString = { path: '/title' };
    expect(lit).toBeDefined();
    expect(ref).toBeDefined();
  });

  test('A2uiComponentDef is discriminated by component type key', () => {
    const button: A2uiComponentDef = {
      Button: { child: 'btn-text', action: { name: 'click' } },
    };
    const text: A2uiComponentDef = {
      Text: { text: { literalString: 'Hi' } },
    };
    expect('Button' in button).toBe(true);
    expect('Text' in text).toBe(true);
  });

  test('A2uiMessage discriminated by envelope key', () => {
    const surfaceUpdate: A2uiMessage = {
      surfaceUpdate: {
        surfaceId: 's1',
        components: [
          { id: 'root', component: { Card: { child: 'inner' } } },
        ],
      },
    };
    const beginRendering: A2uiMessage = {
      beginRendering: { surfaceId: 's1', root: 'root' },
    };
    expect('surfaceUpdate' in surfaceUpdate).toBe(true);
    expect('beginRendering' in beginRendering).toBe(true);
  });

  test('A2uiTextField uses wrapped DynamicString for label and text', () => {
    const tf: A2uiTextField = {
      label: { literalString: 'Name' },
      text: { path: '/name' },
      textFieldType: 'shortText',
    };
    expect(tf.label).toEqual({ literalString: 'Name' });
  });

  test('A2uiCard has single child (not array)', () => {
    const card: A2uiCard = { child: 'inner' };
    expect(card.child).toBe('inner');
  });

  test('A2uiMultipleChoice has selections + options + maxAllowedSelections', () => {
    const mc: A2uiMultipleChoice = {
      selections: { path: '/picked' },
      options: [
        { label: { literalString: 'A' }, value: 'a' },
        { label: { literalString: 'B' }, value: 'b' },
      ],
      maxAllowedSelections: 1,
    };
    expect(mc.options).toHaveLength(2);
  });
});

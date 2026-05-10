// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@ngaf/a2ui';
import { buildA2uiActionMessage } from './build-action-message';

function makeSurface(
  components: A2uiComponent[],
  dataModel: Record<string, unknown> = {},
  sendDataModel?: boolean,
): A2uiSurface {
  const map = new Map<string, A2uiComponent>();
  for (const c of components) map.set(c.id, c);
  return { surfaceId: 's1', catalogId: 'basic', sendDataModel, components: map, dataModel };
}

function makeTextComp(): A2uiComponent {
  return { id: 'root', component: { Text: { text: { literalString: 'hi' } } } };
}

describe('buildA2uiActionMessage (v1)', () => {
  it('builds an action message with required fields', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'submit-btn',
      name: 'formSubmit',
      context: {},
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.version).toBe('v0.9');
    expect(msg.action.name).toBe('formSubmit');
    expect(msg.action.surfaceId).toBe('s1');
    expect(msg.action.sourceComponentId).toBe('submit-btn');
    expect(msg.action.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(msg.metadata).toBeUndefined();
  });

  it('wraps string context values as literalString DynamicValue', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'btn',
      name: 'submit',
      context: { surface: 'feedback' },
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context['surface']).toEqual({ literalString: 'feedback' });
  });

  it('wraps number context values as literalNumber DynamicValue', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'btn',
      name: 'rate',
      context: { score: 5 },
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context['score']).toEqual({ literalNumber: 5 });
  });

  it('wraps boolean context values as literalBoolean DynamicValue', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'btn',
      name: 'toggle',
      context: { checked: true },
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context['checked']).toEqual({ literalBoolean: true });
  });

  it('attaches data model when sendDataModel is true', () => {
    const surface = makeSurface(
      [makeTextComp()],
      { name: 'Alice', email: 'alice@co.com' },
      true,
    );
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeDefined();
    expect(msg.metadata!.a2uiClientDataModel.version).toBe('v0.9');
    expect(msg.metadata!.a2uiClientDataModel.surfaces['s1']).toEqual({ name: 'Alice', email: 'alice@co.com' });
  });

  it('does not attach data model when sendDataModel is false', () => {
    const surface = makeSurface([makeTextComp()], {}, false);
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('defaults context to empty object when not provided in params', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'click' } as Record<string, unknown>;
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context).toEqual({});
  });
});

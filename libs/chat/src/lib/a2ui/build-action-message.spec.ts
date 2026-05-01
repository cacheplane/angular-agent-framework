// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import type { A2uiSurface, A2uiComponent } from '@ngaf/a2ui';
import { buildA2uiActionMessage } from './build-action-message';

describe('buildA2uiActionMessage', () => {
  function makeSurface(
    components: A2uiComponent[],
    dataModel: Record<string, unknown> = {},
    sendDataModel?: boolean,
  ): A2uiSurface {
    const map = new Map<string, A2uiComponent>();
    for (const c of components) map.set(c.id, c);
    return { surfaceId: 's1', catalogId: 'basic', sendDataModel, components: map, dataModel };
  }

  it('builds a v0.9 action message with all required fields', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }]);
    const params = {
      surfaceId: 's1',
      sourceComponentId: 'submit-btn',
      name: 'formSubmit',
      context: { email: 'alice@example.com' },
    };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.version).toBe('v0.9');
    expect(msg.action.name).toBe('formSubmit');
    expect(msg.action.surfaceId).toBe('s1');
    expect(msg.action.sourceComponentId).toBe('submit-btn');
    expect(msg.action.context).toEqual({ email: 'alice@example.com' });
    expect(msg.action.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(msg.metadata).toBeUndefined();
  });

  it('attaches data model when sendDataModel is true', () => {
    const surface = makeSurface(
      [{ id: 'root', component: 'Text' }],
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
    const surface = makeSurface(
      [{ id: 'root', component: 'Text' }],
      { name: 'Alice' },
      false,
    );
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('does not attach data model when sendDataModel is undefined', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }], { name: 'Alice' });
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'submit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.metadata).toBeUndefined();
  });

  it('defaults context to empty object when not provided in params', () => {
    const surface = makeSurface([{ id: 'root', component: 'Text' }]);
    const params = { surfaceId: 's1', sourceComponentId: 'btn', name: 'click' } as any;
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.context).toEqual({});
  });
});

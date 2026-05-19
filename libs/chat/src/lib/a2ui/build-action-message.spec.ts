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
    expect(msg.version).toBe('v1');
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
    expect(msg.metadata!.a2uiClientDataModel.version).toBe('v1');
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

  it('derives action.label from source Button child Text (wrapped literalString)', () => {
    const components: A2uiComponent[] = [
      { id: 'submit-btn', component: { Button: { child: 'submit-label', action: { name: 'formSubmit' } } } },
      { id: 'submit-label', component: { Text: { text: { literalString: 'Search flights' } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'submit-btn', name: 'formSubmit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBe('Search flights');
  });

  it('derives action.label from source Button child Text (raw string shorthand)', () => {
    // The LLM sometimes authors `text` as a raw string (ergonomic shorthand)
    // rather than the canonical `{ literalString }` shape. Both are valid in
    // the wild — the derivation accepts both. Real example from c-a2ui.
    const components: A2uiComponent[] = [
      { id: 'submit', component: { Button: { child: 'submit_label', action: { name: 'bookingSubmit' } } } },
      { id: 'submit_label', component: { Text: { text: 'Search flights' as unknown as { literalString: string } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'submit', name: 'bookingSubmit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBe('Search flights');
  });

  it('leaves action.label undefined when source is not a Button', () => {
    const components: A2uiComponent[] = [
      { id: 'cb', component: { CheckBox: { label: { literalString: 'Agree' }, checked: { literalBoolean: false } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'cb', name: 'agreeToggle', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBeUndefined();
  });

  it('leaves action.label undefined when Button has no child Text id', () => {
    const components: A2uiComponent[] = [
      { id: 'submit-btn', component: { Button: { action: { name: 'formSubmit' } } as unknown as { child: string; action: { name: string } } } },
    ];
    const surface = makeSurface(components);
    const params = { surfaceId: 's1', sourceComponentId: 'submit-btn', name: 'formSubmit', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBeUndefined();
  });

  it('leaves action.label undefined when sourceComponentId does not exist in surface', () => {
    const surface = makeSurface([makeTextComp()]);
    const params = { surfaceId: 's1', sourceComponentId: 'ghost-id', name: 'click', context: {} };
    const msg = buildA2uiActionMessage(params, surface);
    expect(msg.action.label).toBeUndefined();
  });
});

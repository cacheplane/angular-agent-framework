// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { Spec } from '@json-render/core';
import { createContentClassifier, type ContentClassifier } from './content-classifier';

describe('ContentClassifier', () => {
  function setup(): ContentClassifier {
    let classifier!: ContentClassifier;
    TestBed.runInInjectionContext(() => {
      classifier = createContentClassifier();
    });
    return classifier;
  }

  describe('initial state', () => {
    it('type is undetermined', () => {
      const c = setup();
      expect(c.type()).toBe('undetermined');
    });

    it('markdown is empty', () => {
      const c = setup();
      expect(c.markdown()).toBe('');
    });

    it('spec is null', () => {
      const c = setup();
      expect(c.spec()).toBeNull();
    });

    it('elementStates is empty', () => {
      const c = setup();
      expect(c.elementStates().size).toBe(0);
    });

    it('streaming is false', () => {
      const c = setup();
      expect(c.streaming()).toBe(false);
    });
  });

  describe('markdown detection', () => {
    it('detects plain text as markdown', () => {
      const c = setup();
      c.update('Hello world');
      expect(c.type()).toBe('markdown');
      expect(c.markdown()).toBe('Hello world');
    });

    it('accumulates markdown across updates', () => {
      const c = setup();
      c.update('Hello');
      c.update('Hello world');
      expect(c.markdown()).toBe('Hello world');
    });

    it('spec remains null for markdown', () => {
      const c = setup();
      c.update('# Some heading\nSome text');
      expect(c.spec()).toBeNull();
    });
  });

  describe('json-render detection', () => {
    it('detects leading { as json-render', () => {
      const c = setup();
      c.update('{');
      expect(c.type()).toBe('json-render');
    });

    it('produces spec from streamed JSON', () => {
      const c = setup();
      const json = JSON.stringify({
        root: 'el-1',
        elements: {
          'el-1': { type: 'card', props: { title: 'Hello' } },
        },
      });
      c.update(json);
      const spec = c.spec() as Spec;
      expect(spec).not.toBeNull();
      expect(spec.root).toBe('el-1');
      expect(spec.elements['el-1'].type).toBe('card');
    });

    it('streams incrementally', () => {
      const c = setup();
      c.update('{"root":');
      expect(c.type()).toBe('json-render');
      expect(c.spec()).not.toBeNull();

      c.update('{"root":"el-1","elements":{}}');
      const spec = c.spec() as Spec;
      expect(spec.root).toBe('el-1');
    });

    it('markdown is empty for pure JSON', () => {
      const c = setup();
      c.update('{"root":"el-1","elements":{}}');
      expect(c.markdown()).toBe('');
    });
  });

  describe('delta processing', () => {
    it('only processes new characters', () => {
      const c = setup();
      c.update('{"root":');
      const spec1 = c.spec();

      // Same content — no delta to process
      c.update('{"root":');
      const spec2 = c.spec();

      // Same reference since nothing changed
      expect(spec2).toBe(spec1);
    });

    it('handles empty delta (same content twice)', () => {
      const c = setup();
      c.update('Hello');
      c.update('Hello');
      expect(c.markdown()).toBe('Hello');
      expect(c.type()).toBe('markdown');
    });
  });

  describe('type transitions', () => {
    it('never downgrades from markdown', () => {
      const c = setup();
      c.update('Hello');
      expect(c.type()).toBe('markdown');

      // Even if subsequent content looks like JSON, type doesn't downgrade
      c.update('Hello {"root":"el-1"}');
      expect(c.type()).not.toBe('json-render');
    });

    it('never downgrades from json-render', () => {
      const c = setup();
      c.update('{"root":"el-1"}');
      expect(c.type()).toBe('json-render');

      // Stays json-render even with more content
      c.update('{"root":"el-1","elements":{}}');
      expect(c.type()).toBe('json-render');
    });
  });

  describe('streaming state', () => {
    it('is true while content is arriving for json-render', () => {
      const c = setup();
      c.update('{"root":');
      expect(c.streaming()).toBe(true);
    });

    it('is false after complete JSON', () => {
      const c = setup();
      c.update('{"root":"el-1","elements":{}}');
      expect(c.streaming()).toBe(false);
    });

    it('transitions from true to false when JSON completes', () => {
      const c = setup();
      c.update('{"root":"el-1"');
      expect(c.streaming()).toBe(true);

      c.update('{"root":"el-1","elements":{}}');
      expect(c.streaming()).toBe(false);
    });
  });

  describe('a2ui detection', () => {
    it('detects ---a2ui_JSON--- prefix', () => {
      const c = setup();
      c.update('---a2ui_JSON---{"root":"el-1","elements":{}}');
      expect(c.type()).toBe('a2ui');
    });
  });

  describe('dispose', () => {
    it('can be called without errors', () => {
      const c = setup();
      c.update('Hello');
      expect(() => c.dispose()).not.toThrow();
    });

    it('can be called on fresh instance', () => {
      const c = setup();
      expect(() => c.dispose()).not.toThrow();
    });
  });
});

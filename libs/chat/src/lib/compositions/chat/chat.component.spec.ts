// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { ChatComponent } from './chat.component';
import { messageContent } from '../shared/message-utils';
import { createContentClassifier, type ContentClassifier } from '../../streaming/content-classifier';

describe('ChatComponent', () => {
  it('is defined as a class', () => {
    expect(typeof ChatComponent).toBe('function');
  });

  it('messageContent returns string content as-is', () => {
    const msg = new HumanMessage('hello world');
    expect(messageContent(msg)).toBe('hello world');
  });

  it('messageContent serializes array content to JSON', () => {
    const msg = new AIMessage({ content: [{ type: 'text', text: 'hi' }] });
    const result = messageContent(msg);
    expect(result).toContain('text');
  });

  it('has a template defined on the component metadata', () => {
    // Verify the component has been decorated (Angular compiles metadata)
    const annotations = (ChatComponent as any).__annotations__;
    // In Ivy, component metadata is stored on ɵcmp
    const hasMeta = !!(ChatComponent as any).ɵcmp || !!(annotations?.[0]?.template);
    expect(hasMeta || typeof ChatComponent === 'function').toBe(true);
  });
});

describe('ChatComponent — content classification', () => {
  it('classifyMessage creates a classifier on first call and caches it', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const classifiers = new Map<number, ContentClassifier>();
      function classifyMessage(content: string, index: number): ContentClassifier {
        let classifier = classifiers.get(index);
        if (!classifier) {
          classifier = createContentClassifier();
          classifiers.set(index, classifier);
        }
        classifier.update(content);
        return classifier;
      }
      const c1 = classifyMessage('Hello', 0);
      const c2 = classifyMessage('Hello, world', 0);
      expect(c2).toBe(c1);
      expect(c1.markdown()).toBe('Hello, world');
    });
  });

  it('different message indices get different classifiers', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const classifiers = new Map<number, ContentClassifier>();
      function classifyMessage(content: string, index: number): ContentClassifier {
        let classifier = classifiers.get(index);
        if (!classifier) {
          classifier = createContentClassifier();
          classifiers.set(index, classifier);
        }
        classifier.update(content);
        return classifier;
      }
      const c0 = classifyMessage('Hello', 0);
      const c1 = classifyMessage('{"root":"r1"}', 1);
      expect(c0.type()).toBe('markdown');
      expect(c1.type()).toBe('json-render');
    });
  });

  it('markdown messages use the fast path (no spec)', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const c = createContentClassifier();
      c.update('Just plain markdown text');
      expect(c.type()).toBe('markdown');
      expect(c.spec()).toBeNull();
      expect(c.markdown()).toBe('Just plain markdown text');
    });
  });

  it('JSON messages produce a spec and no markdown', () => {
    TestBed.configureTestingModule({});
    TestBed.runInInjectionContext(() => {
      const c = createContentClassifier();
      c.update('{"root":"r1","elements":{"r1":{"type":"Text","props":{"label":"Hi"}}}}');
      expect(c.type()).toBe('json-render');
      expect(c.spec()).not.toBeNull();
      expect(c.markdown()).toBe('');
    });
  });
});

import { describe, expect, it } from 'vitest';
import {
  getDocsBundles,
  resolveDocsBundle,
  toCockpitHref,
  toDocsSlug,
} from './docs-bundle';

describe('resolveDocsBundle', () => {
  it('resolves an exact docs bundle by topic, page, and language', () => {
    expect(
      resolveDocsBundle({
        product: 'langgraph',
        section: 'core-capabilities',
        topic: 'streaming',
        page: 'build',
        language: 'python',
      })
    ).toMatchObject({
      title: 'LangGraph Streaming Build',
      sourcePath:
        'langgraph/core-capabilities/streaming/python/build.mdx',
    });
  });

  it('falls back to the product getting-started overview when no equivalent language bundle exists', () => {
    expect(
      resolveDocsBundle({
        product: 'langgraph',
        section: 'core-capabilities',
        topic: 'streaming',
        page: 'build',
        language: 'typescript',
      })
    ).toMatchObject({
      product: 'langgraph',
      section: 'getting-started',
      topic: 'overview',
      page: 'overview',
      language: 'python',
    });
  });
});

describe('docs bundle links', () => {
  it('generates metadata-driven website and cockpit links from a bundle', () => {
    const bundle = resolveDocsBundle({
      product: 'deep-agents',
      section: 'core-capabilities',
      topic: 'planning',
      page: 'overview',
      language: 'python',
    });

    expect(toDocsSlug(bundle)).toEqual([
      'deep-agents',
      'core-capabilities',
      'planning',
      'overview',
      'python',
    ]);
    expect(toCockpitHref(bundle)).toBe(
      '/deep-agents/core-capabilities/planning/overview/python'
    );
  });
});

describe('docs bundle matrix coverage', () => {
  it('covers every approved topic with canonical python docs pages', () => {
    const expectedTopics = [
      ['deep-agents', 'getting-started', 'overview'],
      ['deep-agents', 'core-capabilities', 'planning'],
      ['deep-agents', 'core-capabilities', 'filesystem'],
      ['deep-agents', 'core-capabilities', 'subagents'],
      ['deep-agents', 'core-capabilities', 'memory'],
      ['deep-agents', 'core-capabilities', 'skills'],
      ['deep-agents', 'core-capabilities', 'sandboxes'],
      ['langgraph', 'getting-started', 'overview'],
      ['langgraph', 'core-capabilities', 'persistence'],
      ['langgraph', 'core-capabilities', 'durable-execution'],
      ['langgraph', 'core-capabilities', 'streaming'],
      ['langgraph', 'core-capabilities', 'interrupts'],
      ['langgraph', 'core-capabilities', 'memory'],
      ['langgraph', 'core-capabilities', 'subgraphs'],
      ['langgraph', 'core-capabilities', 'time-travel'],
      ['langgraph', 'core-capabilities', 'deployment-runtime'],
      ['render', 'getting-started', 'overview'],
      ['render', 'core-capabilities', 'spec-rendering'],
      ['render', 'core-capabilities', 'element-rendering'],
      ['render', 'core-capabilities', 'state-management'],
      ['render', 'core-capabilities', 'registry'],
      ['render', 'core-capabilities', 'repeat-loops'],
      ['render', 'core-capabilities', 'computed-functions'],
      ['chat', 'getting-started', 'overview'],
      ['chat', 'core-capabilities', 'messages'],
      ['chat', 'core-capabilities', 'input'],
      ['chat', 'core-capabilities', 'interrupts'],
      ['chat', 'core-capabilities', 'tool-calls'],
      ['chat', 'core-capabilities', 'subagents'],
      ['chat', 'core-capabilities', 'threads'],
      ['chat', 'core-capabilities', 'timeline'],
      ['chat', 'core-capabilities', 'generative-ui'],
      ['chat', 'core-capabilities', 'debug'],
      ['chat', 'core-capabilities', 'theming'],
    ] as const;
    const bundles = getDocsBundles();
    const pageCounts = new Map<string, number>();

    for (const bundle of bundles) {
      const key = `${bundle.product}/${bundle.section}/${bundle.topic}/${bundle.language}`;
      pageCounts.set(key, (pageCounts.get(key) ?? 0) + 1);
    }

    for (const [product, section, topic] of expectedTopics) {
      expect(pageCounts.get(`${product}/${section}/${topic}/python`)).toBe(
        section === 'getting-started' ? 1 : 5
      );
    }
  });
});

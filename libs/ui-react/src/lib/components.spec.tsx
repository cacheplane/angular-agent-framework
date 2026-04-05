import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GlassPanel, GlassButton, Callout, Steps, Step, NavLink, Card, CardGroup } from '../index';

describe('GlassPanel', () => {
  it('renders with glass CSS variable classes', () => {
    const html = renderToStaticMarkup(<GlassPanel>Content</GlassPanel>);
    expect(html).toContain('Content');
    expect(html).toContain('--ds-glass');
  });
});

describe('GlassButton', () => {
  it('renders primary variant', () => {
    const html = renderToStaticMarkup(<GlassButton>Click</GlassButton>);
    expect(html).toContain('Click');
    expect(html).toContain('--ds-accent');
  });

  it('renders outline variant', () => {
    const html = renderToStaticMarkup(<GlassButton variant="outline">Click</GlassButton>);
    expect(html).toContain('--ds-accent-border');
  });
});

describe('Callout', () => {
  it('renders with title and content', () => {
    const html = renderToStaticMarkup(<Callout type="warning" title="Watch out">Be careful</Callout>);
    expect(html).toContain('Watch out');
    expect(html).toContain('Be careful');
  });
});

describe('Steps', () => {
  it('renders numbered steps', () => {
    const html = renderToStaticMarkup(
      <Steps>
        <Step title="First">Do this</Step>
        <Step title="Second">Then this</Step>
      </Steps>
    );
    expect(html).toContain('First');
    expect(html).toContain('Second');
  });
});

describe('NavLink', () => {
  it('renders active state', () => {
    const html = renderToStaticMarkup(<NavLink href="/test" active>Test</NavLink>);
    expect(html).toContain('/test');
    expect(html).toContain('--ds-accent');
  });
});

describe('Card', () => {
  it('renders with title and content', () => {
    const html = renderToStaticMarkup(
      <CardGroup><Card title="Test" href="/test">Desc</Card></CardGroup>
    );
    expect(html).toContain('Test');
    expect(html).toContain('Desc');
  });
});

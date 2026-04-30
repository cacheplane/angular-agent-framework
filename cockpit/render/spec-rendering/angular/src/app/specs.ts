// SPDX-License-Identifier: MIT
export interface DemoSpec {
  label: string;
  json: string;
}

export const SPEC_RENDERING_SPECS: DemoSpec[] = [
  {
    label: 'Heading + Text',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Welcome to Spec Rendering' },
          children: ['desc'],
        },
        desc: {
          type: 'Text',
          props: { content: 'This UI is rendered entirely from a JSON specification. Each element maps to a registered Angular component.' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Card + Badge',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Card',
          props: { title: 'Streaming Demo' },
          children: ['badge', 'info'],
        },
        badge: {
          type: 'Badge',
          props: { label: 'Live Preview' },
        },
        info: {
          type: 'Text',
          props: { content: 'Badges, headings, and text components are all resolved from the registry at runtime.' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Nested Layout',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Multi-Level Nesting' },
          children: ['section1', 'section2'],
        },
        section1: {
          type: 'Card',
          props: { title: 'Section One' },
          children: ['s1text'],
        },
        s1text: {
          type: 'Text',
          props: { content: 'First section with a card wrapper and nested text content inside.' },
        },
        section2: {
          type: 'Card',
          props: { title: 'Section Two' },
          children: ['s2text'],
        },
        s2text: {
          type: 'Text',
          props: { content: 'Second section demonstrating that the parser handles multiple sibling branches.' },
        },
      },
    }, null, 2),
  },
];

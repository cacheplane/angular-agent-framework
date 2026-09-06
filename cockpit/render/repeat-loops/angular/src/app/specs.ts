import type { DemoSpec } from '../../../../spec-rendering/angular/src/app/specs';

export const REPEAT_LOOPS_SPECS: DemoSpec[] = [
  {
    label: 'Simple List',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Simple List' },
          children: ['row'],
        },
        // One element declaration, one rendered row per entry in /items.
        // `{ $item: '' }` resolves to the whole item, which here is a string.
        row: {
          type: 'Text',
          repeat: { statePath: '/items' },
          props: { content: { $item: '' } },
        },
      },
    }, null, 2),
  },
  {
    label: 'Task List',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Card',
          props: { title: 'Task List' },
          children: ['task1', 'task2', 'task3'],
        },
        task1: {
          type: 'Text',
          props: { content: 'Review pull request' },
        },
        task2: {
          type: 'Text',
          props: { content: 'Update documentation' },
        },
        task3: {
          type: 'Text',
          props: { content: 'Deploy to staging' },
        },
      },
    }, null, 2),
  },
  {
    label: 'Sections',
    json: JSON.stringify({
      root: 'root',
      elements: {
        root: {
          type: 'Heading',
          props: { content: 'Multiple Sections' },
          children: ['sectionA', 'sectionB'],
        },
        sectionA: {
          type: 'Card',
          props: { title: 'Frontend Tasks' },
          children: ['feTask1', 'feTask2'],
        },
        feTask1: {
          type: 'Text',
          props: { content: 'Build component library' },
        },
        feTask2: {
          type: 'Text',
          props: { content: 'Add accessibility tests' },
        },
        sectionB: {
          type: 'Card',
          props: { title: 'Backend Tasks' },
          children: ['beTask1', 'beTask2'],
        },
        beTask1: {
          type: 'Text',
          props: { content: 'Optimize database queries' },
        },
        beTask2: {
          type: 'Text',
          props: { content: 'Add rate limiting' },
        },
      },
    }, null, 2),
  },
];

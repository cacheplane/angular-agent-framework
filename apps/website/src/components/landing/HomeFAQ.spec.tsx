// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HomeFAQ } from './HomeFAQ';

describe('HomeFAQ', () => {
  it('asks only what the page above did not answer', () => {
    const { container } = render(<HomeFAQ />);
    const questions = [
      'Is Threadplane a backend agent framework?',
      'Can I use my existing Angular component library and design system?',
      'Does generated UI execute arbitrary code?',
      'Does Threadplane require a hosted service or an account?',
    ];
    for (const q of questions) expect(screen.getByText(q)).toBeTruthy();
    expect(screen.queryByText('Does Threadplane require LangGraph?')).toBeNull();
    expect(screen.queryByText(/raw streaming SDK/)).toBeNull();
    expect(container.querySelectorAll('summary')).toHaveLength(4);
    expect(container.querySelectorAll('a')).toHaveLength(4);
  });
});

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostCard } from './PostCard';
import { formatCardDate, type Post } from '../../lib/blog';

const post: Post = {
  slug: 'streaming-chat',
  date: '2026-05-17',
  filename: '2026-05-17-streaming-chat.mdx',
  content: '',
  frontmatter: {
    title: 'Build a streaming chat UI',
    description: 'A tutorial.',
    date: '2026-05-17',
    author: 'brian',
    tags: ['tutorial', 'streaming'],
  },
};

describe('PostCard', () => {
  it('renders title, date, and tag chips', () => {
    render(<PostCard post={post} />);
    expect(screen.getByText('Build a streaming chat UI')).toBeTruthy();
    // Derive through the same formatter the card uses. `formatCardDate` omits
    // the year for same-year posts, so a literal ('May 17') would silently rot
    // the moment the calendar year rolls over.
    expect(screen.getByText(new RegExp(formatCardDate(post.frontmatter.date)))).toBeTruthy();
    expect(screen.getByText('tutorial')).toBeTruthy();
    expect(screen.getByText('streaming')).toBeTruthy();
  });

  it('links to /blog/[slug]', () => {
    const { container } = render(<PostCard post={post} />);
    const link = container.querySelector('a[href="/blog/streaming-chat"]');
    expect(link).toBeTruthy();
  });
});

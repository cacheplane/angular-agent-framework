// SPDX-License-Identifier: MIT
export interface Author {
  name: string;
  role?: string;
  bio?: string;
  /**
   * Topics this author has published work behind. Rendered as schema.org
   * `knowsAbout` on /about, so it is an expertise claim: list only subjects
   * with docs and code in this repository.
   */
  knowsAbout?: readonly string[];
  twitter?: string;
  github?: string;
  avatar?: string;
}

export const blogAuthors: Record<string, Author> = {
  brian: {
    name: 'Brian Love',
    role: 'Founder, Threadplane',
    bio: 'Agentic software architect building developer tooling for fullstack AI-powered web applications.',
    knowsAbout: ['Angular', 'TypeScript', 'LangGraph', 'AG-UI', 'Generative UI', 'Agent user interfaces'],
    github: 'blove',
  },
};

export function getAuthor(key: string): Author {
  return blogAuthors[key] ?? { name: key };
}

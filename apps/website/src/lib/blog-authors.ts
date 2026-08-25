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
  /**
   * Profile handles, not URLs. Each is opt-in: `sameAs` is an identity claim, so
   * a handle the record does not name must never be synthesized from another.
   */
  twitter?: string;
  linkedin?: string;
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
    twitter: 'blovedev',
    linkedin: 'blove',
  },
};

export function getAuthor(key: string): Author {
  return blogAuthors[key] ?? { name: key };
}

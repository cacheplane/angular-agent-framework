// SPDX-License-Identifier: MIT
export interface Author {
  name: string;
  role?: string;
  bio?: string;
  twitter?: string;
  github?: string;
  avatar?: string;
}

export const blogAuthors: Record<string, Author> = {
  brian: {
    name: 'Brian Love',
    role: 'Founder, ThreadPlane',
    bio: 'Angular consultant and open-source maintainer. Building agent UI for Angular teams.',
    github: 'blove',
  },
};

export function getAuthor(key: string): Author {
  return blogAuthors[key] ?? { name: key };
}

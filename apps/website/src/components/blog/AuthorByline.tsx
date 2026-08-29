import type { Author } from '../../lib/blog-authors';

export function AuthorByline({ author }: { author: Author }) {
  return (
    <div className="author-byline">
      {author.avatar ? (
        <img
          src={author.avatar}
          alt={`${author.name} avatar`}
          width={32}
          height={32}
          className="author-byline-avatar"
        />
      ) : null}
      <div>
        <span className="author-byline-name">{author.name}</span>
        {author.role ? (
          <span className="author-byline-role"> · {author.role}</span>
        ) : null}
      </div>
    </div>
  );
}

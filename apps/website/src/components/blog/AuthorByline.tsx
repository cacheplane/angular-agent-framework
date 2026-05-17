import type { Author } from '../../lib/blog-authors';

export function AuthorByline({ author }: { author: Author }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 14,
        opacity: 0.8,
      }}
    >
      {author.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={author.avatar}
          alt={`${author.name} avatar`}
          width={32}
          height={32}
          style={{ borderRadius: '50%' }}
        />
      ) : null}
      <div>
        <span style={{ fontWeight: 600 }}>{author.name}</span>
        {author.role ? <span style={{ opacity: 0.7 }}> · {author.role}</span> : null}
      </div>
    </div>
  );
}

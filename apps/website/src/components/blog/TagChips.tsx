import Link from 'next/link';

/**
 * Tag pills on the article page. Each pill links to the blog landing page
 * filtered by that tag (`/blog?tag=<tag>`), matching the affordance offered
 * by the BlogTagFilter row on `/blog`.
 */
export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="tag-chips">
      {tags.map((tag) => (
        <Link key={tag} href={`/blog?tag=${encodeURIComponent(tag)}`} className="tag-chip">
          {tag}
        </Link>
      ))}
    </div>
  );
}

import { tokens } from '@threadplane/design-tokens';

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        marginBottom: 24,
      }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          style={{
            fontSize: 13,
            padding: '4px 10px',
            borderRadius: 999,
            background: tokens.colors.accentSurface,
            color: tokens.colors.accent,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

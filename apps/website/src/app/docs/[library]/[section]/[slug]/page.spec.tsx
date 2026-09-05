import { isValidElement, type ComponentType, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { DocsPageHeader } from '../../../../../components/docs/DocsPageHeader';
import { LibraryMark } from '../../../../../components/docs/LibraryMark';
import { DocsSearchFooter } from '../../../../../components/docs/DocsSearchFooter';
import { DocsTOC } from '../../../../../components/docs/DocsTOC';
import { MdxRenderer } from '../../../../../components/docs/MdxRenderer';
import { WebsiteWorkspace } from '../../../../../components/workspace/WebsiteWorkspace';
import DocsPage, { generateMetadata } from './page';

interface ElementProps {
  children?: ReactNode;
  docsSlot?: ReactNode;
  requestedMode?: string | null;
  resolution?: { kind?: string; identity?: { availableModes?: string[] } };
  contentBundle?: { runtimeUrl?: string | null };
  contextTrail?: readonly { label: string; href?: string; icon?: ReactNode }[];
  docsContext?: unknown;
  exampleCode?: { assetPaths?: readonly string[] } | null;
}

function findElement(
  node: ReactNode,
  type: ComponentType<never>
): React.ReactElement<ElementProps> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<ElementProps>(node)) return null;
  if (node.type === type) return node;
  return findElement(node.props.children, type);
}

const route = (library: string, section: string, slug: string, mode?: string) =>
  DocsPage({
    params: Promise.resolve({ library, section, slug }),
    searchParams: Promise.resolve(mode ? { mode } : {}),
  } as never);

describe('unified docs workspace route', () => {
  it('passes mapped descriptor-backed content and the requested mode to the client boundary', async () => {
    const tree = await route('langgraph', 'guides', 'streaming', 'code');
    const workspace = findElement(
      tree,
      WebsiteWorkspace as ComponentType<never>
    );

    expect(workspace).toBeTruthy();
    // Search state belongs to the client workspace adapter so this canonical
    // Docs route remains statically generated.
    expect(workspace?.props.requestedMode).toBeUndefined();
    expect(workspace?.props.resolution).toMatchObject({
      kind: 'mapped',
      identity: { availableModes: ['Docs', 'Run', 'Code', 'API'] },
    });
    expect(workspace?.props.contentBundle?.runtimeUrl).toMatch(
      /(?:langgraph\/streaming|localhost:4300)$/
    );
    expect(workspace?.props.docsContext).toEqual({
      activeLibrary: 'langgraph',
      activeSection: 'guides',
      activeSlug: 'streaming',
    });

    const mdx = findElement(
      workspace?.props.docsSlot,
      MdxRenderer as ComponentType<never>
    );
    expect(mdx?.props.exampleCode?.assetPaths).toContain(
      'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts'
    );
  });

  it('keeps an unmapped page as a complete server Docs slot', async () => {
    const tree = await route('langgraph', 'guides', 'testing', 'run');
    const workspace = findElement(
      tree,
      WebsiteWorkspace as ComponentType<never>
    );
    const slot = workspace?.props.docsSlot;

    expect(workspace?.props.resolution).toMatchObject({ kind: 'docs-only' });
    expect(
      findElement(slot, DocsPageHeader as ComponentType<never>)
    ).toBeTruthy();
    expect(findElement(slot, MdxRenderer as ComponentType<never>)).toBeTruthy();
    expect(
      findElement(slot, MdxRenderer as ComponentType<never>)?.props.exampleCode
    ).toBeNull();
    expect(findElement(slot, DocsTOC as ComponentType<never>)).toBeTruthy();
  });

  it('invites a search at the foot of a content page', async () => {
    const tree = await route('langgraph', 'guides', 'testing');
    const workspace = findElement(
      tree,
      WebsiteWorkspace as ComponentType<never>
    );

    expect(
      findElement(
        workspace?.props.docsSlot,
        DocsSearchFooter as ComponentType<never>
      )
    ).toBeTruthy();
  });

  it('hands the shell one accurate trail instead of four renditions', async () => {
    const tree = await route('ag-ui', 'getting-started', 'introduction');
    const workspace = findElement(
      tree,
      WebsiteWorkspace as ComponentType<never>
    );

    // Docs titles, not manifest identity: the derived label read
    // "Ag Ui / Getting Started / Overview".
    const trail = workspace?.props.contextTrail ?? [];
    expect(trail.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: 'Docs', href: '/docs' },
      { label: 'AG-UI', href: '/docs/ag-ui/getting-started/introduction' },
      { label: 'Getting Started', href: undefined },
      { label: 'Introduction', href: undefined },
    ]);

    // Only the library rung carries the mark; the rest are plain labels.
    trail.forEach((crumb, index) => {
      if (index === 1) {
        expect(isValidElement(crumb.icon)).toBe(true);
        expect((crumb.icon as React.ReactElement).type).toBe(LibraryMark);
      } else {
        expect(crumb.icon).toBeUndefined();
      }
    });
  });

  it('keeps canonical metadata independent of the workspace mode query', async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({
        library: 'langgraph',
        section: 'guides',
        slug: 'streaming',
      }),
      searchParams: Promise.resolve({ mode: 'run' }),
    } as never);

    expect(metadata.alternates?.canonical).toBe(
      '/docs/langgraph/guides/streaming'
    );
    expect(String(metadata.alternates?.canonical)).not.toContain('mode');
  });
});

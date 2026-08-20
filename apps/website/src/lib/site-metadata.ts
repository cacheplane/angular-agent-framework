import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { getAllSolutionSlugs } from './solutions-data';
import { docsConfig, specialDocsPages } from './docs-config';
import { getAllPosts } from './blog';
import { SITE_ORIGIN } from './site-origin';

export { SITE_ORIGIN };
export const SITE_NAME = 'Threadplane';
export const DEFAULT_SOCIAL_IMAGE = '/opengraph-image';
export {
  DEFAULT_META_DESCRIPTION,
  HERO_SUBHEAD,
  LONG_SUBHEAD,
  POSITIONING_PROOF_POINTS,
  PRIMARY_TAGLINE,
  SHORT_POSITIONING_DESCRIPTION,
} from './positioning';

export function getCanonicalPath(pathname: string): string {
  if (pathname === '/') return '/';
  return `/${pathname.replace(/^\/+|\/+$/g, '')}`;
}

export function getCanonicalUrl(pathname: string): string {
  return new URL(getCanonicalPath(pathname), SITE_ORIGIN).toString();
}

export function createPageMetadata({
  title,
  description,
  pathname,
  type = 'article',
}: {
  title: string;
  description: string;
  pathname: string;
  type?: 'article' | 'website';
}): Metadata {
  const canonicalPath = getCanonicalPath(pathname);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: SITE_NAME,
      type,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [DEFAULT_SOCIAL_IMAGE],
    },
  };
}

export function getSitemapRoutes(): string[] {
  const staticRoutes = ['/', '/langgraph', '/render', '/chat', '/ag-ui', '/pricing', '/solutions', '/pilot-to-prod', '/docs', '/blog', '/contact'];
  const solutionRoutes = getAllSolutionSlugs().map((slug) => `/solutions/${slug}`);
  const docsRoutes = docsConfig.flatMap((library) =>
    library.sections.flatMap((section) =>
      section.pages.map((page) => `/docs/${library.id}/${page.section}/${page.slug}`),
    ),
  );
  const specialDocsRoutes = specialDocsPages.map((page) => page.path);
  const blogRoutes = getAllPosts().map((p) => `/blog/${p.slug}`);

  return [...staticRoutes, ...solutionRoutes, ...docsRoutes, ...specialDocsRoutes, ...blogRoutes];
}

/** A sitemap URL plus the honest last-modified time of the source it renders from. */
export interface SitemapEntry {
  route: string;
  /**
   * Omitted when no honest value can be determined. An absent `<lastmod>` is
   * valid sitemap XML; a fabricated one (e.g. "now" on every build, which is
   * what raw file mtimes give you on a fresh CI checkout) teaches crawlers to
   * ignore the signal across the whole site.
   */
  lastModified?: Date;
}

/** Website-relative source paths that a route's content is rendered from. */
function sourcePathsForRoute(route: string): string[] {
  const special = specialDocsPages.find((page) => page.path === route);
  if (special) return [path.join('content', 'docs', special.contentPath)];

  if (route.startsWith('/docs/')) {
    const [, , library, section, slug] = route.split('/');
    if (library && section && slug) {
      return [path.join('content', 'docs', library, section, `${slug}.mdx`)];
    }
    // Anything else under /docs is a hand-written route, dated like any other.
  }

  if (route.startsWith('/solutions/')) {
    // Programmatic pages: one dynamic route template rendering data from a
    // single module, so a change to either re-renders the page.
    return [
      path.join('src', 'app', 'solutions', '[slug]', 'page.tsx'),
      path.join('src', 'lib', 'solutions-data.ts'),
    ];
  }

  const routeDir = route === '/' ? '' : route.replace(/^\//, '');
  return [path.join('src', 'app', routeDir, 'page.tsx')];
}

// `nx build website` and a standalone `next build` disagree about cwd, exactly
// as `blog.ts` already has to handle.
const WEBSITE_DIR_CANDIDATES = [path.join(process.cwd(), 'apps', 'website'), process.cwd()];

/** Absolute path for a website-relative source path, or null when it is missing. */
function resolveSourcePath(relativePath: string): string | null {
  for (const dir of WEBSITE_DIR_CANDIDATES) {
    const candidate = path.join(dir, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const GIT_LOG_MARKER = 'commit-time ';

interface GitTimes {
  /** Last commit time (epoch seconds) keyed by website-relative path. */
  times: Map<string, number>;
  /**
   * True when the clone has full history, which is also the only situation in
   * which a file's absence from `times` means "never committed" (and so its
   * mtime is a real edit time rather than a checkout timestamp).
   */
  complete: boolean;
}

let gitTimesCache: GitTimes | null | undefined;

/**
 * Last commit time (epoch seconds) keyed by website-relative path.
 *
 * Returns null when git history yields nothing usable (no git, not a repo, or a
 * clone so shallow that only grafted commits are visible).
 *
 * Shallow clones — which is what CI hosts do by default — need care: a grafted
 * boundary commit has no parent, so `git log --name-only` reports *every* file
 * in the tree as changed at that commit's timestamp. Those entries are dropped;
 * files git genuinely saw change in the visible history keep real dates, and
 * everything older simply gets no `lastmod`.
 */
function computeGitTimes(): GitTimes | null {
  try {
    const git = (args: string[], cwd: string): string =>
      execFileSync('git', args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });

    const root = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
    const graftedCommits = new Set<string>();
    if (git(['rev-parse', '--is-shallow-repository'], root).trim() === 'true') {
      const shallowFile = path.join(git(['rev-parse', '--absolute-git-dir'], root).trim(), 'shallow');
      if (!fs.existsSync(shallowFile)) return null;
      for (const sha of fs.readFileSync(shallowFile, 'utf8').split('\n')) {
        if (sha.trim()) graftedCommits.add(sha.trim());
      }
    }

    const prefix = fs.existsSync(path.join(root, 'apps', 'website')) ? 'apps/website/' : '';
    const log = git(
      [
        'log',
        `--format=${GIT_LOG_MARKER}%ct %H`,
        '--name-only',
        '--',
        `${prefix}content`,
        `${prefix}src/app`,
        `${prefix}src/lib`,
      ],
      root,
    );

    const times = new Map<string, number>();
    let commitTime = 0;
    for (const line of log.split('\n')) {
      if (line.startsWith(GIT_LOG_MARKER)) {
        const [seconds, sha] = line.slice(GIT_LOG_MARKER.length).split(' ');
        commitTime = graftedCommits.has(sha) ? 0 : Number(seconds);
        continue;
      }
      const file = line.trim();
      if (!file || !commitTime) continue;
      const relative = prefix && file.startsWith(prefix) ? file.slice(prefix.length) : file;
      // `git log` walks newest-first, so the first mention of a path wins.
      if (!times.has(relative)) times.set(relative, commitTime);
    }
    return times.size > 0 ? { times, complete: graftedCommits.size === 0 } : null;
  } catch {
    return null;
  }
}

function getGitTimes(): GitTimes | null {
  if (gitTimesCache !== undefined) return gitTimesCache;
  gitTimesCache = computeGitTimes();

  if (gitTimesCache === null) {
    // Visible in the build log: the sitemap will carry `lastmod` only for blog
    // posts (which date themselves in frontmatter) until history is available.
    console.warn('[sitemap] git history unavailable; omitting <lastmod> for file-derived routes.');
  }

  return gitTimesCache;
}

/**
 * Newest honest modification time across a route's sources.
 *
 * Git commit time is authoritative. A file mtime is only trusted when the clone
 * has full history and git still has no record of the file — i.e. uncommitted
 * local work. Without that guard every URL would carry the checkout time, since
 * a fresh CI clone rewrites every mtime to the moment it ran.
 */
function sourceModifiedTime(relativePaths: string[]): Date | undefined {
  const git = getGitTimes();
  let newest: number | undefined;

  for (const relativePath of relativePaths) {
    const absolute = resolveSourcePath(relativePath);
    if (!absolute) continue;

    const gitSeconds = git?.times.get(relativePath.split(path.sep).join('/'));
    const millis =
      gitSeconds !== undefined
        ? gitSeconds * 1000
        : git?.complete
          ? fs.statSync(absolute).mtimeMs
          : undefined;
    if (millis === undefined) continue;
    if (newest === undefined || millis > newest) newest = millis;
  }

  return newest === undefined ? undefined : new Date(newest);
}

export function getSitemapEntries(): SitemapEntry[] {
  const blogDates = new Map(
    getAllPosts().map((post) => [`/blog/${post.slug}`, new Date(`${post.frontmatter.date}T00:00:00Z`)]),
  );

  return getSitemapRoutes().map((route) => {
    const blogDate = blogDates.get(route);
    if (blogDate && !Number.isNaN(blogDate.getTime())) return { route, lastModified: blogDate };

    const lastModified = sourceModifiedTime(sourcePathsForRoute(route));
    return lastModified ? { route, lastModified } : { route };
  });
}

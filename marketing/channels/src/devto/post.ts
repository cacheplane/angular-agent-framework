// SPDX-License-Identifier: MIT
import { http } from '../http';
import { writeDryRunResult } from '../dry-run';
import type { Draft, PostResult } from '../types';

const ARTICLES_URL = 'https://dev.to/api/articles';

interface DevToArticleResponse {
  id: number;
  url: string;
  published_at?: string;
}

interface ArticleBody {
  title: string;
  body_markdown: string;
  published: boolean;
  tags?: string[];
  canonical_url?: string;
  description?: string;
}

export async function postDevTo(apiKey: string, draft: Draft): Promise<PostResult> {
  if (process.env.DRY_RUN === '1') {
    return writeDryRunResult(draft);
  }

  const article: ArticleBody = {
    title: draft.article!.title,
    body_markdown: draft.text!,
    published: true,
  };
  if (draft.article!.tags !== undefined) article.tags = draft.article!.tags;
  if (draft.article!.canonicalUrl !== undefined) article.canonical_url = draft.article!.canonicalUrl;
  if (draft.article!.description !== undefined) article.description = draft.article!.description;

  let response: DevToArticleResponse;
  try {
    response = await http<DevToArticleResponse>({
      method: 'POST',
      url: ARTICLES_URL,
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'cacheplane-marketing/1.0',
      },
      body: JSON.stringify({ article }),
      retryOn5xx: true,
    });
  } catch (err) {
    const message = (err as Error).message;
    if (message.startsWith('HTTP 401')) {
      throw new Error(
        'Dev.to API key rejected — re-generate at https://dev.to/settings/extensions and update DEVTO_API_KEY.',
      );
    }
    throw err;
  }

  return {
    channel: 'devto',
    postId: String(response.id),
    url: response.url,
    postedAt: response.published_at ?? new Date().toISOString(),
  };
}

// SPDX-License-Identifier: MIT
import fs from 'fs';
import path from 'path';

export interface ApiDocsJson {
  children?: ApiSymbol[];
}

export interface ApiSymbol {
  name: string;
  kind?: string;
  kindString?: string;
  description?: string;
  params?: {
    name: string;
    type?: string;
    description?: string;
  }[];
  comment?: { summary?: { text: string }[] };
  signatures?: {
    parameters?: {
      name: string;
      type: { name?: string };
      comment?: { summary?: { text: string }[] };
    }[];
  }[];
}

let cachedDocs: ApiDocsJson | null = null;

export function getApiDocs(): ApiDocsJson {
  if (cachedDocs) return cachedDocs;
  const candidates = [
    path.join(__dirname, '../../api-docs.json'),
    path.join(__dirname, '../../../../apps/website/content/docs/agent/api/api-docs.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as ApiDocsJson | ApiSymbol[];
      cachedDocs = Array.isArray(parsed) ? { children: parsed } : parsed;
      return cachedDocs;
    }
  }
  return { children: [] };
}

export function findSymbol(name: string): ApiSymbol | undefined {
  const docs = getApiDocs();
  return docs.children?.find((c) => c.name === name);
}

export function getAllSymbolNames(): string[] {
  return getApiDocs().children?.map((c) => c.name) ?? [];
}

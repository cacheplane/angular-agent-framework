// SPDX-License-Identifier: MIT
import fs from 'fs';
import path from 'path';

export interface ApiDocsJson {
  children?: ApiSymbol[];
}

export interface ApiSymbol {
  name: string;
  kindString?: string;
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
    path.join(__dirname, '../../../../apps/website/public/api-docs.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      cachedDocs = JSON.parse(fs.readFileSync(p, 'utf8')) as ApiDocsJson;
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

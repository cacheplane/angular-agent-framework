/**
 * Resolution for `<ExampleCode>`: which asset a docs page means, which slice
 * of it, and the fence that feeds it back through the MDX code pipeline.
 * Pure so the build-time component and the unit guard share one rule.
 */

export interface ExampleCodeContext {
  /** The docs route the include appears on; only used in error messages. */
  readonly docsPath: string;
  /** codeAssetPaths + backendAssetPaths of the page's capability. */
  readonly assetPaths: readonly string[];
  /** Raw text per asset path (ContentBundle.codeSources). */
  readonly sources: Readonly<Record<string, string>>;
}

export class ExampleCodeError extends Error {
  override readonly name = 'ExampleCodeError';
}

export function resolveExampleFile(
  file: string,
  context: ExampleCodeContext
): string {
  const matches = context.assetPaths.filter(
    (path) => path === file || path.endsWith(`/${file}`)
  );
  if (matches.length === 0) {
    throw new ExampleCodeError(
      `${
        context.docsPath
      }: <ExampleCode file="${file}"> matches none of the page's example files: ${context.assetPaths.join(
        ', '
      )}`
    );
  }
  if (matches.length > 1) {
    throw new ExampleCodeError(
      `${
        context.docsPath
      }: <ExampleCode file="${file}"> is ambiguous: ${matches.join(
        ', '
      )}. Use the full path.`
    );
  }
  const [path] = matches;
  if (!(path in context.sources)) {
    throw new ExampleCodeError(
      `${context.docsPath}: <ExampleCode file="${file}"> resolves to ${path}, which could not be read`
    );
  }
  return path;
}

const REGION_START = /^\s*(?:\/\/|#|<!--)\s*#?region\s+(\S+?)\s*(?:-->)?\s*$/;
const REGION_END = /^\s*(?:\/\/|#|<!--)\s*#?endregion\b/;

export function sliceRegion(
  source: string,
  region: string,
  filePath: string
): string {
  const lines = source.split('\n');
  const start = lines.findIndex(
    (line) => REGION_START.exec(line)?.[1] === region
  );
  if (start === -1) {
    throw new ExampleCodeError(`${filePath}: no "#region ${region}" marker`);
  }
  let depth = 1;
  let end = -1;
  for (let index = start + 1; index < lines.length; index++) {
    const line = lines[index];
    if (REGION_START.test(line)) {
      depth++;
    } else if (REGION_END.test(line)) {
      depth--;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) {
    throw new ExampleCodeError(
      `${filePath}: "#region ${region}" is unterminated`
    );
  }
  const body = lines.slice(start + 1, end);
  const nonEmpty = body.filter((line) => line.trim().length > 0);
  const indent =
    nonEmpty.length === 0
      ? 0
      : Math.min(...nonEmpty.map((line) => /^\s*/.exec(line)![0].length));
  return body
    .map((line) => line.slice(Math.min(indent, line.length)))
    .join('\n');
}

const FENCE_LANG: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  mjs: 'js',
  py: 'python',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'md',
  yaml: 'yaml',
  yml: 'yaml',
};

export function fenceFor(code: string, filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1);
  const lang = FENCE_LANG[ext] ?? 'text';
  const longestRun = Math.max(
    0,
    ...(code.match(/`+/g) ?? []).map((run) => run.length)
  );
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const body = code.endsWith('\n') ? code.slice(0, -1) : code;
  return `${fence}${lang}\n${body}\n${fence}`;
}

export function exampleTitle(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}

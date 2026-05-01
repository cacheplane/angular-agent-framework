/* eslint-disable @typescript-eslint/no-explicit-any -- TypeDoc reflection API is untyped */
import { Application, TSConfigReader, ReflectionKind } from 'typedoc';
import fs from 'fs';
import path from 'path';

interface ApiParam {
  name: string;
  type: string;
  description: string;
  optional?: boolean;
}

interface ApiMethod {
  name: string;
  signature: string;
  description: string;
  params?: ApiParam[];
}

interface ApiDocEntry {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type';
  description: string;
  signature?: string;
  params?: ApiParam[];
  returns?: { type: string; description: string };
  examples?: string[];
  properties?: ApiParam[];
  methods?: ApiMethod[];
}

function extractDescription(comment: any): string {
  if (!comment?.summary) return '';
  return comment.summary.map((p: any) => p.text ?? '').join('').trim();
}

function extractExamples(comment: any): string[] {
  if (!comment?.blockTags) return [];
  return comment.blockTags
    .filter((t: any) => t.tag === '@example')
    .map((t: any) => t.content.map((c: any) => c.text ?? '').join('').trim());
}

function extractType(typeObj: any): string {
  if (!typeObj) return 'unknown';
  if (typeObj.type === 'intrinsic') return typeObj.name;
  if (typeObj.type === 'reference') return typeObj.name + (typeObj.typeArguments ? `<${typeObj.typeArguments.map(extractType).join(', ')}>` : '');
  if (typeObj.type === 'union') return typeObj.types.map(extractType).join(' | ');
  if (typeObj.type === 'literal') return JSON.stringify(typeObj.value);
  if (typeObj.type === 'reflection') return 'object';
  if (typeObj.type === 'array') return `${extractType(typeObj.elementType)}[]`;
  return typeObj.toString?.() ?? 'unknown';
}

function extractParams(sig: any): ApiParam[] {
  if (!sig?.parameters) return [];
  return sig.parameters.map((p: any) => ({
    name: p.name,
    type: extractType(p.type),
    description: extractDescription(p.comment),
    optional: p.flags?.isOptional ?? false,
  }));
}

function reflectionToEntry(ref: any): ApiDocEntry | null {
  const kind = ref.kind;
  const desc = extractDescription(ref.comment);
  const examples = extractExamples(ref.comment);

  if (kind === ReflectionKind.Function) {
    const sig = ref.signatures?.[0];
    return {
      name: ref.name,
      kind: 'function',
      description: desc || extractDescription(sig?.comment),
      signature: sig ? `${ref.name}(${(sig.parameters ?? []).map((p: any) => `${p.name}: ${extractType(p.type)}`).join(', ')}): ${extractType(sig.type)}` : ref.name,
      params: extractParams(sig),
      returns: sig?.type ? { type: extractType(sig.type), description: '' } : undefined,
      examples: examples.length ? examples : extractExamples(sig?.comment),
    };
  }

  if (kind === ReflectionKind.Class) {
    const props = (ref.children ?? [])
      .filter((c: any) => c.kind === ReflectionKind.Property)
      .map((c: any) => ({ name: c.name, type: extractType(c.type), description: extractDescription(c.comment), optional: c.flags?.isOptional }));
    const methods = (ref.children ?? [])
      .filter((c: any) => c.kind === ReflectionKind.Method)
      .map((c: any) => {
        const sig = c.signatures?.[0];
        return { name: c.name, signature: `${c.name}(${(sig?.parameters ?? []).map((p: any) => `${p.name}: ${extractType(p.type)}`).join(', ')})`, description: extractDescription(c.comment) || extractDescription(sig?.comment), params: extractParams(sig) };
      });
    const ctorSig = (ref.children ?? []).find((c: any) => c.kind === ReflectionKind.Constructor)?.signatures?.[0];
    return {
      name: ref.name,
      kind: 'class',
      description: desc,
      params: ctorSig ? extractParams(ctorSig) : undefined,
      examples,
      properties: props,
      methods,
    };
  }

  if (kind === ReflectionKind.Interface) {
    const props = (ref.children ?? []).map((c: any) => ({
      name: c.name,
      type: extractType(c.type),
      description: extractDescription(c.comment),
      optional: c.flags?.isOptional,
    }));
    return { name: ref.name, kind: 'interface', description: desc, properties: props, examples };
  }

  if (kind === ReflectionKind.TypeAlias) {
    return { name: ref.name, kind: 'type', description: desc, signature: extractType(ref.type), examples };
  }

  return null;
}

interface LibraryEntryConfig {
  /** Doc-site library slug (e.g. 'agent', 'chat') — used as the output folder under apps/website/content/docs/. */
  docSlug: string;
  /** TypeDoc entry point — usually libs/<name>/src/public-api.ts. */
  entryPoint: string;
}

const LIBRARIES: LibraryEntryConfig[] = [
  { docSlug: 'agent',  entryPoint: 'libs/langgraph/src/public-api.ts' },
  { docSlug: 'chat',   entryPoint: 'libs/chat/src/public-api.ts' },
  { docSlug: 'render', entryPoint: 'libs/render/src/public-api.ts' },
  { docSlug: 'ag-ui',  entryPoint: 'libs/ag-ui/src/public-api.ts' },
];

async function generateForLibrary(cfg: LibraryEntryConfig): Promise<void> {
  const outDir = `apps/website/content/docs/${cfg.docSlug}/api`;
  if (!fs.existsSync(cfg.entryPoint)) {
    console.warn(`Entry point not found for ${cfg.docSlug}: ${cfg.entryPoint} — writing empty api-docs.json`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'api-docs.json'), JSON.stringify([], null, 2));
    return;
  }

  const libDir = path.dirname(path.dirname(cfg.entryPoint));
  const libTsconfig = fs.existsSync(path.join(libDir, 'tsconfig.lib.json'))
    ? path.join(libDir, 'tsconfig.lib.json')
    : undefined;

  const app = await Application.bootstrapWithPlugins({
    entryPoints: [cfg.entryPoint],
    skipErrorChecking: true,
    ...(libTsconfig ? { tsconfig: libTsconfig } : {}),
  });
  app.options.addReader(new TSConfigReader());
  const project = await app.convert();
  if (!project) throw new Error(`TypeDoc failed to convert ${cfg.docSlug}`);

  const entries: ApiDocEntry[] = [];
  for (const child of project.children ?? []) {
    const entry = reflectionToEntry(child);
    if (entry) entries.push(entry);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'api-docs.json'), JSON.stringify(entries, null, 2));
  console.log(`✓ ${cfg.docSlug}/api/api-docs.json (${entries.length} entries)`);
}

async function main() {
  for (const cfg of LIBRARIES) {
    await generateForLibrary(cfg);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

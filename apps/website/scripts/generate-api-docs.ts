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

/** Renders a single parameter for a signature string, preserving rest (`...`) syntax. */
function paramToSigString(p: any): string {
  return `${p.flags?.isRest ? '...' : ''}${p.name}: ${extractType(p.type)}`;
}

/** Builds a `(a: A, ...rest: B[]): R` signature body from a TypeDoc signature reflection. */
function signatureToString(name: string, sig: any): string {
  const params = (sig?.parameters ?? []).map(paramToSigString).join(', ');
  const ret = sig?.type ? `: ${extractType(sig.type)}` : '';
  return `${name}(${params})${ret}`;
}

function extractType(typeObj: any): string {
  if (!typeObj) return 'unknown';
  if (typeObj.type === 'intrinsic') return typeObj.name;
  if (typeObj.type === 'reference') return typeObj.name + (typeObj.typeArguments ? `<${typeObj.typeArguments.map(extractType).join(', ')}>` : '');
  if (typeObj.type === 'union') return typeObj.types.map(extractType).join(' | ');
  if (typeObj.type === 'literal') return JSON.stringify(typeObj.value);
  if (typeObj.type === 'reflection') {
    // Function-typed property/value: render its call signature, e.g. `(event: RenderEvent) => void`.
    const sig = typeObj.declaration?.signatures?.[0];
    if (sig) {
      const params = (sig.parameters ?? []).map(paramToSigString).join(', ');
      return `(${params}) => ${extractType(sig.type)}`;
    }
    return 'object';
  }
  if (typeObj.type === 'array') return `${extractType(typeObj.elementType)}[]`;
  return typeObj.toString?.() ?? 'unknown';
}

function extractParams(sig: any): ApiParam[] {
  if (!sig?.parameters) return [];
  return sig.parameters.map((p: any) => ({
    name: `${p.flags?.isRest ? '...' : ''}${p.name}`,
    type: extractType(p.type),
    description: extractDescription(p.comment),
    // A parameter is optional if explicitly marked `?` OR it has a default
    // value (e.g. `opts: MockAgentOptions = {}`) — TypeDoc only sets the
    // `isOptional` flag for the former, so check `defaultValue` for the latter.
    optional: (p.flags?.isOptional ?? false) || p.defaultValue !== undefined,
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
      signature: sig ? signatureToString(ref.name, sig) : ref.name,
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
        return { name: c.name, signature: signatureToString(c.name, sig), description: extractDescription(c.comment) || extractDescription(sig?.comment), params: extractParams(sig) };
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
    const children = ref.children ?? [];
    const props = children
      .filter((c: any) => c.kind !== ReflectionKind.Method)
      .map((c: any) => ({
        name: c.name,
        type: extractType(c.type),
        description: extractDescription(c.comment),
        optional: c.flags?.isOptional,
      }));
    const methods = children
      .filter((c: any) => c.kind === ReflectionKind.Method)
      .map((c: any) => {
        const sig = c.signatures?.[0];
        return {
          name: c.name,
          signature: signatureToString(c.name, sig),
          description: extractDescription(c.comment) || extractDescription(sig?.comment),
          params: extractParams(sig),
        };
      });
    return { name: ref.name, kind: 'interface', description: desc, properties: props, methods: methods.length ? methods : undefined, examples };
  }

  if (kind === ReflectionKind.TypeAlias) {
    return { name: ref.name, kind: 'type', description: desc, signature: extractType(ref.type), examples };
  }

  return null;
}

function collectApiEntries(reflections: any[]): ApiDocEntry[] {
  return reflections.flatMap((ref) => {
    const entry = reflectionToEntry(ref);
    if (entry) return [entry];
    return collectApiEntries(ref.children ?? []);
  });
}

interface LibraryEntryConfig {
  /** Doc-site library slug (e.g. 'agent', 'chat') — used as the output folder under apps/website/content/docs/. */
  docSlug: string;
  /** TypeDoc entry points — usually libs/<name>/src/public-api.ts. */
  entryPoints: string[];
}

const LIBRARIES: LibraryEntryConfig[] = [
  { docSlug: 'langgraph', entryPoints: ['libs/langgraph/src/public-api.ts'] },
  { docSlug: 'chat',      entryPoints: ['libs/chat/src/public-api.ts', 'libs/chat/testing/public-api.ts'] },
  { docSlug: 'render',    entryPoints: ['libs/render/src/public-api.ts'] },
  { docSlug: 'ag-ui',     entryPoints: ['libs/ag-ui/src/public-api.ts'] },
  { docSlug: 'a2ui',      entryPoints: ['libs/a2ui/src/index.ts'] },
  { docSlug: 'licensing', entryPoints: ['libs/licensing/src/index.ts'] },
  {
    docSlug: 'telemetry',
    entryPoints: [
      'libs/telemetry/src/index.ts',
      'libs/telemetry/src/browser/public-api.ts',
      'libs/telemetry/src/node/index.ts',
      'libs/telemetry/src/shared/public-api.ts',
    ],
  },
];

async function generateForLibrary(cfg: LibraryEntryConfig): Promise<void> {
  const outDir = `apps/website/content/docs/${cfg.docSlug}/api`;
  const missingEntryPoints = cfg.entryPoints.filter((entryPoint) => !fs.existsSync(entryPoint));
  if (missingEntryPoints.length > 0) {
    console.warn(`Entry point not found for ${cfg.docSlug}: ${missingEntryPoints.join(', ')} — writing empty api-docs.json`);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'api-docs.json'), JSON.stringify([], null, 2));
    return;
  }

  const libDir = path.dirname(path.dirname(cfg.entryPoints[0]));
  const libTsconfig = fs.existsSync(path.join(libDir, 'tsconfig.lib.json'))
    ? path.join(libDir, 'tsconfig.lib.json')
    : undefined;

  const app = await Application.bootstrapWithPlugins({
    entryPoints: cfg.entryPoints,
    skipErrorChecking: true,
    ...(libTsconfig ? { tsconfig: libTsconfig } : {}),
  });
  app.options.addReader(new TSConfigReader());
  const project = await app.convert();
  if (!project) throw new Error(`TypeDoc failed to convert ${cfg.docSlug}`);

  const entries = collectApiEntries(project.children ?? []);

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

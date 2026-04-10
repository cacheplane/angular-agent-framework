// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { A2uiPathRef, A2uiFunctionCall } from './types';
import { getByPointer } from './pointer';
import { executeFunction } from './functions';

export interface A2uiScope {
  basePath: string;
  item: unknown;
}

function isPathRef(value: unknown): value is A2uiPathRef {
  return typeof value === 'object' && value !== null && 'path' in value && typeof (value as A2uiPathRef).path === 'string' && !('call' in value);
}

function isFunctionCall(value: unknown): value is A2uiFunctionCall {
  return typeof value === 'object' && value !== null && 'call' in value;
}

function resolvePathRef(ref: A2uiPathRef, model: Record<string, unknown>, scope?: A2uiScope): unknown {
  const path = ref.path;
  // Absolute path starts with /
  if (path.startsWith('/')) {
    return getByPointer(model, path);
  }
  // Relative path — resolve against scope
  if (scope) {
    return getByPointer(model, `${scope.basePath}/${path}`);
  }
  return getByPointer(model, '/' + path);
}

function interpolateTemplate(template: string, model: Record<string, unknown>, scope?: A2uiScope): string {
  return template.replace(/\\(\$\{)|(?<!\\\$)\$\{([^}]+)\}/g, (match, escaped, path) => {
    if (escaped) return '${';
    const value = resolvePathRef({ path }, model, scope);
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

export function resolveDynamic(
  value: unknown,
  model: Record<string, unknown>,
  scope?: A2uiScope,
): unknown {
  if (value == null) return value;

  // Array — recurse into each element
  if (Array.isArray(value)) {
    return value.map(item => resolveDynamic(item, model, scope));
  }

  // Path reference
  if (isPathRef(value)) {
    return resolvePathRef(value, model, scope);
  }

  // Function call — execute registered function
  if (isFunctionCall(value)) {
    const fc = value as A2uiFunctionCall;
    // Resolve args that may themselves be dynamic
    const resolvedArgs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fc.args)) {
      resolvedArgs[k] = resolveDynamic(v, model, scope);
    }
    const result = executeFunction(fc.call, resolvedArgs, model);
    return result ?? `[${fc.call}]`;
  }

  // Template string interpolation
  if (typeof value === 'string' && value.includes('${')) {
    return interpolateTemplate(value, model, scope);
  }

  // Literal passthrough
  return value;
}

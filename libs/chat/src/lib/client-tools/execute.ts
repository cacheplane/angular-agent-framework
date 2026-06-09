// SPDX-License-Identifier: MIT
import type { StandardSchemaV1 } from '@threadplane/render';
import type { FunctionToolDef } from './tool-def';
import type { ClientToolResult } from './client-tools-capability';

/** Validate raw model args against a Standard Schema. */
export async function validateArgs(
  schema: StandardSchemaV1,
  args: unknown,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const res = await schema['~standard'].validate(args);
  if (res.issues) {
    return { ok: false, error: res.issues.map((i) => i.message).join('; ') };
  }
  return { ok: true, value: res.value };
}

/** Validate args, run the handler, and normalize the outcome to a ClientToolResult. */
export async function executeFunctionTool(
  def: FunctionToolDef,
  rawArgs: unknown,
): Promise<ClientToolResult> {
  const v = await validateArgs(def.schema, rawArgs);
  if (!v.ok) return { ok: false, error: `invalid arguments: ${v.error}` };
  try {
    const value = await def.handler(v.value as never);
    return { ok: true, value };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// SPDX-License-Identifier: MIT

/** Emits a data model binding event if the prop has a binding path. */
export function emitBinding(
  emit: (event: string) => void,
  bindings: Record<string, string> | undefined,
  prop: string,
  value: unknown,
): void {
  const path = bindings?.[prop];
  if (path) {
    emit(`a2ui:datamodel:${path}:${value}`);
  }
}

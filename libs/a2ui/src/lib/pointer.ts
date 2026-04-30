// SPDX-License-Identifier: MIT

function parsePointer(pointer: string): string[] {
  if (!pointer || pointer === '/') return [];
  return pointer.split('/').filter(Boolean);
}

export function getByPointer(model: Record<string, unknown>, pointer: string): unknown {
  const segments = parsePointer(pointer);
  let current: unknown = model;
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[seg];
  }
  return current;
}

export function setByPointer(
  model: Record<string, unknown>,
  pointer: string,
  value: unknown,
): Record<string, unknown> {
  const segments = parsePointer(pointer);
  if (segments.length === 0) return value as Record<string, unknown>;

  function clone(obj: unknown, segs: string[], val: unknown): unknown {
    if (segs.length === 0) return val;
    const [head, ...rest] = segs;
    const base = (obj != null && typeof obj === 'object') ? obj : {};
    const isArray = Array.isArray(base);
    const copy = isArray ? [...(base as unknown[])] : { ...(base as Record<string, unknown>) };
    (copy as Record<string, unknown>)[head] = clone(
      (base as Record<string, unknown>)[head],
      rest,
      val,
    );
    return copy;
  }

  return clone(model, segments, value) as Record<string, unknown>;
}

export function deleteByPointer(
  model: Record<string, unknown>,
  pointer: string,
): Record<string, unknown> {
  const segments = parsePointer(pointer);
  if (segments.length === 0) return {};

  const parentPath = segments.slice(0, -1);
  const key = segments[segments.length - 1];

  if (parentPath.length === 0) {
    const copy = { ...model };
    delete copy[key];
    return copy;
  }

  const parent = getByPointer(model, '/' + parentPath.join('/'));
  if (parent == null || typeof parent !== 'object') return model;
  const parentCopy = { ...(parent as Record<string, unknown>) };
  delete parentCopy[key];
  return setByPointer(model, '/' + parentPath.join('/'), parentCopy);
}

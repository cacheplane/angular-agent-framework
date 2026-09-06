import { readEvidence } from '../../../../pilot/context.js';
/** List sources when sourceId is omitted; otherwise read a captured source with copy-ready citationOptions. Copy each citation object separately without joining quotes. */
export default async function tool(input: { sourceId?: string }) {
  return readEvidence(input);
}

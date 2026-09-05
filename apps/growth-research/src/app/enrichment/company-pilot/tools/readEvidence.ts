import { readEvidence } from '../../../../pilot/context.js';
/** List sources when sourceId is omitted; otherwise read one captured source in this case. */
export default async function tool(input: { sourceId?: string }) {
  return readEvidence(input);
}

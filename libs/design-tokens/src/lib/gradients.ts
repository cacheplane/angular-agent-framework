/**
 * Gradient tokens — ambient blobs and page backgrounds.
 *
 * The bgFlow gradient communicates the Angular→LangGraph bridge
 * by flowing from warm (red) to cool (blue).
 */
export const gradient = {
  /** Angular red ambient blob */
  warm: 'radial-gradient(circle, rgba(221, 0, 49, 0.18), transparent 70%)',
  /** LangGraph blue ambient blob */
  cool: 'radial-gradient(circle, rgba(0, 64, 144, 0.18), transparent 70%)',
  /** Light blue accent blob */
  coolLight: 'radial-gradient(circle, rgba(100, 195, 253, 0.15), transparent 70%)',
  /** Main page background — pink→lavender→blue flow */
  bgFlow: 'linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%)',
} as const;

export type Gradient = typeof gradient;

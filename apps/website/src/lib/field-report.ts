/**
 * The field report's own facts, in one place.
 *
 * These exist as data because the site got them wrong: it advertised "18
 * pages" for a 17-page document, and described the contents as "Error
 * boundaries, fallbacks, observability, deploy" — three phrases that return
 * zero matches in the file. Anything the site says about the document now
 * reads from here, and `field-report.spec.ts` pins the page count to the PDF
 * itself.
 *
 * To re-verify after regenerating the PDF:
 *
 *     pdftotext -f 1 -l 2 apps/website/public/whitepaper.pdf - | sed -n '1,40p'
 */
export const FIELD_REPORT = {
  /** Printed on the cover. */
  title: 'From Prototype to Production',
  /** The cover's header rule. */
  kicker: 'Threadplane · Open source · Angular',
  /** The cover's standfirst, verbatim. */
  subtitle: 'Production-ready chat, threads, and generative UI for AI agents.',
  /** The cover's date line. */
  year: '2026',
  /** Verified against the file, and asserted against it in the spec. */
  pages: 17,
  /** The table of contents, in document order. */
  chapters: [
    'Streaming State Management',
    'Thread Persistence',
    'Tool-Call Rendering',
    'Human Approval Flows',
    'Generative UI',
    'Deterministic Testing',
  ],
} as const;

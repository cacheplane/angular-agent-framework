import { FIELD_REPORT } from '../../lib/field-report';

/**
 * The field report rendered as the object it is, contents included.
 *
 * It reuses `.wp-paper` — the tilted card the library pages already show —
 * so the same artifact does not get two visual languages, and adds its own
 * classes for the content the library version does not have.
 *
 * Deliberately NOT aria-hidden. The library page's cover is artwork and hides
 * itself; this one prints the table of contents, which is the reason anyone
 * gives up an email address for it.
 */
export function FieldReportCover() {
  return (
    <div className="field-report-cover">
      <div className="wp-paper field-report-paper">
        <div>
          <p className="field-report-kicker">{FIELD_REPORT.kicker}</p>
          <h3 className="field-report-title">{FIELD_REPORT.title}</h3>
          <p className="field-report-sub">{FIELD_REPORT.subtitle}</p>
          <p className="field-report-toc-label">Contents</p>
          <ol className="field-report-toc">
            {FIELD_REPORT.chapters.map((chapter, i) => (
              <li key={chapter}>
                <span className="field-report-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {chapter}
              </li>
            ))}
          </ol>
        </div>
        <p className="field-report-foot">
          <span>threadplane.ai</span>
          <span>{FIELD_REPORT.year}</span>
        </p>
      </div>
    </div>
  );
}

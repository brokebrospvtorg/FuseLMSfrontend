/**
 * Level abbreviation badges — shared across every student-facing subject
 * list (dashboard, grade report, marks report, etc). Mirrors
 * app/core/grading.py::LEVEL_ABBREVIATIONS on the backend; keep both in
 * sync if the level catalog ever changes.
 *
 * Keys are DB level codes (Level.code / GradeReportEntry.level_code /
 * AttendanceSummary.level_code — see academic.model.ts's `Level` and
 * routers/academic.py::STANDARD_LEVEL_CODES), NOT the human-readable
 * `name` column — those are two different fields on the same row.
 */
export const LEVEL_ABBREVIATIONS: Readonly<Record<string, string>> = {
  'O-LEVEL': 'OL',
  'AS-LEVEL': 'AS',
  'A2-LEVEL': 'A2',
  'A-LEVEL': 'Composite',
};

/** Returns the short badge text for a DB level code, or null when the
 *  code is missing/unrecognized — callers should render nothing rather
 *  than a placeholder badge in that case. */
export function getLevelAbbreviation(levelCode: string | null | undefined): string | null {
  if (!levelCode) return null;
  return LEVEL_ABBREVIATIONS[levelCode.toUpperCase()] ?? null;
}

/** Convenience formatter for the "Mathematics [AS]" display pattern used
 *  in plain-text contexts (dropdown option labels, aria-labels, etc).
 *  For markup contexts, prefer rendering the badge as its own element
 *  (see marks.component.html) so it can be styled distinctly from the
 *  subject name — this is for text-only spots. */
export function formatSubjectWithLevel(subjectName: string, levelCode: string | null | undefined): string {
  const badge = getLevelAbbreviation(levelCode);
  return badge ? `${subjectName} [${badge}]` : subjectName;
}

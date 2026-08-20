/**
 * Percentage + standard letter-grade calculation, shared by every
 * marks-entry grid (Teacher, Coordinator) for an INSTANT client-side
 * preview as marks are typed — before the row is even saved.
 *
 * Mirrors app/core/grading.py::calculate_percentage / calculate_grade /
 * STANDARD_GRADE_THRESHOLDS / STANDARD_FAIL_GRADE exactly (same formula,
 * same thresholds, same rounding to 2 decimal places). Keep both in sync
 * if the school-wide scale ever changes.
 *
 * This is deliberately the single global standard scale, not level-aware:
 * an Admin-configured GradingScheme override (see grading_schemes table)
 * only ever applies server-side, once marks are saved and
 * _recompute_grades_for_subject_batch runs. The grid's live preview is a
 * best-effort "here's roughly what this will become" indicator, not the
 * authoritative grade — that's always whatever GET /academics/grades
 * returns after a save.
 */

/** Ordered highest -> lowest; first threshold the percentage clears wins. */
const STANDARD_GRADE_THRESHOLDS: ReadonlyArray<readonly [number, string]> = [
  [90, 'A*'],
  [80, 'A'],
  [70, 'B'],
  [60, 'C'],
  [50, 'D'],
];
const STANDARD_FAIL_GRADE = 'U';

/**
 * (obtained / max) * 100, rounded to 2 decimal places.
 *
 * Cleanly returns null — never NaN, never throws — for every edge case:
 * a max of 0, negative, null, undefined, or not-a-number; an obtained
 * value that's null, undefined, or not-a-number. Callers should treat a
 * null return as "nothing to show yet", not as 0%.
 */
export function calculatePercentage(
  obtainedTotal: number | null | undefined,
  maxTotal: number | null | undefined,
): number | null {
  if (
    obtainedTotal === null || obtainedTotal === undefined || Number.isNaN(obtainedTotal) ||
    maxTotal === null || maxTotal === undefined || Number.isNaN(maxTotal) || maxTotal <= 0
  ) {
    return null;
  }
  const pct = (obtainedTotal / maxTotal) * 100;
  return Math.round(pct * 100) / 100;
}

/**
 * Standard school-wide grading scale:
 *   >= 90% -> A*
 *   >= 80% -> A
 *   >= 70% -> B
 *   >= 60% -> C
 *   >= 50% -> D
 *   <  50% -> U
 *
 * Returns null (not a grade) when percentage is null/NaN — i.e. there's
 * nothing to grade yet, distinct from a genuine 0% ("U").
 */
export function calculateGrade(percentage: number | null | undefined): string | null {
  if (percentage === null || percentage === undefined || Number.isNaN(percentage)) {
    return null;
  }
  for (const [threshold, letter] of STANDARD_GRADE_THRESHOLDS) {
    if (percentage >= threshold) return letter;
  }
  return STANDARD_FAIL_GRADE;
}

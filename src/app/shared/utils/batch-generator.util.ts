import { BatchSession } from '../../core/models/enums';

/**
 * Batch Generator utility — the frontend mirror of
 * app/core/batch_utils.py. Single source of truth (on this side) for what
 * a "standard" FUSE LMS exam batch/session looks like: current year
 * through 4 years ahead, "May/June {year}" and "Oct/Nov {year}" for each.
 *
 * Every Batch selection dropdown should ultimately trace its options back
 * to either this generator (when picking which batch to CREATE — see
 * generateBatches()) or to the backend's GET /api/academic/batches
 * (when picking among batches that already exist) — never a hardcoded
 * year or free-typed session string, so the two stay in sync.
 *
 * Keep this in sync with the backend by hand if the session calendar
 * ever changes (e.g. a third session is added) — nothing generates one
 * from the other.
 */

export const DEFAULT_YEARS_AHEAD = 4; // current year + 4 future years = 5 years total

/** Ordered chronologically within a year: SESSION_ORDER[i] is followed by
 *  SESSION_ORDER[i + 1] in the same year, and the last entry is followed
 *  by the first entry of the NEXT year (see nextBatchStartDate). */
export const SESSION_ORDER: BatchSession[] = [BatchSession.MayJune, BatchSession.OctNov];

interface SessionMeta {
  label: string;
  startMonth: number; // 1-indexed
  startDay: number;
  endMonth: number;
  endDay: number;
}

const SESSION_META: Record<BatchSession, SessionMeta> = {
  [BatchSession.MayJune]: { label: 'May/June', startMonth: 5, startDay: 1, endMonth: 6, endDay: 30 },
  [BatchSession.OctNov]: { label: 'Oct/Nov', startMonth: 10, startDay: 1, endMonth: 11, endDay: 30 },
};

export interface BatchTemplate {
  session: BatchSession;
  year: number;
  name: string;
  /** ISO date string (YYYY-MM-DD), matching the backend's `date` shape. */
  startDate: string;
  endDate: string;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** 'may_june', 2026 -> 'May/June 2026'. */
export function formatBatchName(session: BatchSession, year: number): string {
  return `${SESSION_META[session].label} ${year}`;
}

/** The standard [startDate, endDate] ISO date pair for a session/year. */
export function batchDateRange(session: BatchSession, year: number): [string, string] {
  const meta = SESSION_META[session];
  return [isoDate(year, meta.startMonth, meta.startDay), isoDate(year, meta.endMonth, meta.endDay)];
}

/**
 * The reusable Batch Generator: current year through `yearsAhead` years
 * ahead (inclusive), two standardized sessions per year, in chronological
 * order. Powers Batch selection/creation dropdowns across the app.
 *
 * startYear defaults to the current calendar year — pass it explicitly
 * (e.g. in a test) for a deterministic, non-"today"-dependent range.
 */
export function generateBatches(
  startYear: number = new Date().getFullYear(),
  yearsAhead: number = DEFAULT_YEARS_AHEAD,
): BatchTemplate[] {
  const templates: BatchTemplate[] = [];
  for (let year = startYear; year <= startYear + yearsAhead; year++) {
    for (const session of SESSION_ORDER) {
      const [startDate, endDate] = batchDateRange(session, year);
      templates.push({ session, year, name: formatBatchName(session, year), startDate, endDate });
    }
  }
  return templates;
}

/**
 * The start_date of whichever standard batch immediately follows the
 * given (session, year) — mirrors batch_utils.next_batch_start_date on
 * the backend. Used for client-side "this batch is about to end" hints;
 * the actual expiry/soft-delete happens server-side (see
 * app/core/jobs.expire_ended_batches).
 */
export function nextBatchStartDate(session: BatchSession, year: number): string {
  const idx = SESSION_ORDER.indexOf(session);
  const isLast = idx === SESSION_ORDER.length - 1;
  const nextSession = isLast ? SESSION_ORDER[0] : SESSION_ORDER[idx + 1];
  const nextYear = isLast ? year + 1 : year;
  const [nextStart] = batchDateRange(nextSession, nextYear);
  return nextStart;
}

/** True once the next standard batch's month has arrived/passed. */
export function isBatchOver(session: BatchSession, year: number, asOf: Date = new Date()): boolean {
  return asOf.toISOString().slice(0, 10) >= nextBatchStartDate(session, year);
}

/** Dropdown-ready {label, value} options, value being the session+year
 *  pair encoded as `${session}:${year}` — convenient for a p-select
 *  bound directly to a generated (not-yet-created) batch choice. */
export function generateBatchOptions(
  startYear?: number,
  yearsAhead?: number,
): { label: string; value: string; template: BatchTemplate }[] {
  return generateBatches(startYear, yearsAhead).map((template) => ({
    label: template.name,
    value: `${template.session}:${template.year}`,
    template,
  }));
}

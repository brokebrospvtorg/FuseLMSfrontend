import { Observable, forkJoin, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { Batch } from '../../core/models/academic.model';
import { AcademicsStaffService } from '../../core/services/academics-staff.service';
import { TeacherFilterPair } from '../ui/teacher-cascading-filter/teacher-cascading-filter.component';

/**
 * Coordinator-facing counterpart to the Teacher cascade's `allowedPairs`.
 * The Teacher screens (Attendance, Marks) scope `<app-teacher-cascading-filter>`
 * to one teacher's own assignments/slots. The Coordinator Portal's Day-Wise
 * Attendance and Timetable Builder cascades have no such single-owner
 * scope — they need every batch+subject combination with an ACTIVE
 * offering (batch_subjects), across every batch, same authorization
 * philosophy ("never widen past what's actually active") just without a
 * teacher_id to key off of.
 *
 * Sourced from GET /academic/batches/{id}/offered-subjects — one call per
 * batch, since there's no bulk "every batch's offerings at once" endpoint
 * — rather than inferring anything from raw TimetableSlot rows, so a
 * batch/subject the Coordinator has since withdrawn the offering for
 * drops out of the cascade even if old timetable slots referencing it
 * still exist.
 */
export function loadOfferedPairs(
  staff: AcademicsStaffService,
  batches: Batch[],
): Observable<TeacherFilterPair[]> {
  if (batches.length === 0) return of([]);
  return forkJoin(batches.map((b) => staff.getOfferedSubjects(b.id))).pipe(
    map((perBatchSubjects) =>
      perBatchSubjects.flatMap((subjects, i) =>
        subjects
          .filter((s) => s.is_active)
          .map((s): TeacherFilterPair => ({
            subjectId: s.subject_id,
            batchId: batches[i].id,
            board: s.board,
          })),
      ),
    ),
  );
}
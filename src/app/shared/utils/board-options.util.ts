import { Board } from '../../core/models/enums';

/**
 * Every value the Board enum can take, in the order shown in every Board
 * dropdown across the app (Batch create, Student form, Teacher form,
 * admin-batches Board Tabs, manage-batch-dialog's Board/Offer-Subjects
 * dropdown) — kept as one shared list so they never drift out of sync.
 *
 * Lives here (not in admin-batches.component.ts, where it originally was)
 * specifically so manage-batch-dialog.component.ts can import it too
 * without creating a circular import — admin-batches.component.ts already
 * imports ManageBatchDialogComponent.
 */
export const BOARD_OPTIONS: { label: string; value: Board }[] = [
  { label: 'British Council', value: Board.BritishCouncil },
  { label: 'Edexcel', value: Board.Edexcel },
  { label: 'LRN', value: Board.LRN },
];

/**
 * schema_update_16: same 3 boards plus 'All Boards', for the Add Subject
 * dialog only — a catalog Subject can run under every board at once,
 * unlike a Student/Teacher/Batch, which always picks exactly one (or one
 * per Board for Teacher). Kept as its own list rather than appending to
 * BOARD_OPTIONS so Student/Teacher/Batch forms never see 'All' as a choice.
 */
export const SUBJECT_BOARD_OPTIONS: { label: string; value: Board }[] = [
  ...BOARD_OPTIONS,
  { label: 'All Boards', value: Board.All },
];

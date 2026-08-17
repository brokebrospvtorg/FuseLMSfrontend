import { FeeProofStatus } from './enums';

/** Mirrors app/models/fees.py + app/schemas/fees.py. Voucher status is
 *  DERIVED on the backend from the latest fee_proofs row — see the
 *  fee_vouchers table comment in 001_init_schema.sql — so the frontend
 *  just trusts whatever `status` the API returns rather than computing
 *  it client-side. */

export type DerivedVoucherStatus = 'pending' | 'submitted' | 'paid' | 'rejected';

export interface FeeVoucher {
  id: string;
  student_id: string;
  student_full_name: string;
  batch_id: string;
  amount: number;
  due_date: string;
  generated_at: string;
  status: DerivedVoucherStatus;
  /** id of the latest fee_proofs row, if any — this is what Approve/Reject
   *  and the file viewer actually act on. Null when status is 'pending'
   *  (no proof uploaded yet). */
  latest_proof_id: string | null;
}

export interface FeeProof {
  id: string;
  voucher_id: string;
  file_url: string;
  uploaded_at: string;
  status: FeeProofStatus;
  rejection_reason: string | null;
}

/** Mirrors FeeStructureOut — Admin Sub-Sprint 4 "preset layouts." */
export interface FeeStructure {
  id: string;
  subject_id: string;
  subject_name: string | null;
  student_id: string | null;
  student_name: string | null;
  amount: number;
  set_by: string;
  created_at: string;
}

export interface CreateFeeStructureRequest {
  subject_id: string;
  student_id?: string | null;
  amount: number;
}

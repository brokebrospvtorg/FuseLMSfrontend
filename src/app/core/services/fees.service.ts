import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { FeeVoucher, FeeProof, FeeStructure, CreateFeeStructureRequest } from '../models/fees.model';

@Injectable({ providedIn: 'root' })
export class FeesService {
  private readonly baseUrl = `${APP_CONFIG.apiBaseUrl}/fees`;

  constructor(private http: HttpClient) {}

  /** Student/Parent: backend scopes this to their own/linked vouchers
   *  automatically by role — no need to pass an id. */
  getMyVouchers(): Observable<FeeVoucher[]> {
    return this.http.get<FeeVoucher[]>(`${this.baseUrl}/vouchers`, { withCredentials: true });
  }

  /** Admin/Coordinator: same endpoint, but with no student_id the backend
   *  returns every voucher rather than scoping to one user. The review
   *  screen filters client-side to status === 'submitted'.
   *  `months` — Sub-Sprint 4's 3-month (or any N-month) history filter. */
  getAllVouchers(months?: number): Observable<FeeVoucher[]> {
    let params = new HttpParams();
    if (months) params = params.set('months', months);
    return this.http.get<FeeVoucher[]>(`${this.baseUrl}/vouchers`, { params, withCredentials: true });
  }

  uploadProof(voucherId: string, file: File): Observable<FeeProof> {
    const formData = new FormData();
    formData.append('voucher_id', voucherId);
    formData.append('file', file);
    return this.http.post<FeeProof>(`${this.baseUrl}/proofs`, formData, { withCredentials: true });
  }

  /** Streams the actual file as a blob — used to build an object URL for
   *  the review dialog's <img>/<iframe>. RBAC is enforced server-side on
   *  every call, same as every other read in this service. */
  getProofFile(proofId: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/proofs/${proofId}/file`, {
      withCredentials: true,
      responseType: 'blob',
    });
  }

  approveProof(proofId: string): Observable<FeeProof> {
    return this.http.patch<FeeProof>(
      `${this.baseUrl}/proofs/${proofId}/review`,
      { status: 'approved' },
      { withCredentials: true },
    );
  }

  rejectProof(proofId: string, rejectionReason: string): Observable<FeeProof> {
    return this.http.patch<FeeProof>(
      `${this.baseUrl}/proofs/${proofId}/review`,
      { status: 'rejected', rejection_reason: rejectionReason },
      { withCredentials: true },
    );
  }

  // --- Fee Structures (Admin Sub-Sprint 4: preset fee layouts) ---

  getFeeStructures(subjectId?: string): Observable<FeeStructure[]> {
    let params = new HttpParams();
    if (subjectId) params = params.set('subject_id', subjectId);
    return this.http.get<FeeStructure[]>(`${this.baseUrl}/structures`, { params, withCredentials: true });
  }

  createFeeStructure(payload: CreateFeeStructureRequest): Observable<FeeStructure> {
    return this.http.post<FeeStructure>(`${this.baseUrl}/structures`, payload, { withCredentials: true });
  }

  updateFeeStructureAmount(structureId: string, amount: number): Observable<FeeStructure> {
    return this.http.patch<FeeStructure>(`${this.baseUrl}/structures/${structureId}`, { amount }, { withCredentials: true });
  }

  deleteFeeStructure(structureId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/structures/${structureId}`, { withCredentials: true });
  }
}

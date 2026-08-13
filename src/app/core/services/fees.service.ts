import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../config/app-config';
import { FeeVoucher, FeeProof } from '../models/fees.model';

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
   *  screen filters client-side to status === 'submitted'. */
  getAllVouchers(): Observable<FeeVoucher[]> {
    return this.http.get<FeeVoucher[]>(`${this.baseUrl}/vouchers`, { withCredentials: true });
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
}

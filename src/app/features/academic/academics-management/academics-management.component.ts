import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';

import { AdminBatchesComponent } from '../../admin/batches/admin-batches.component';
import { AdminSubjectCatalogComponent } from '../../admin/subjects/admin-subject-catalog.component';

/**
 * Academics section landing page: Batches + Subject Catalog, as tabs
 * (schema_update_16 restores the "Subjects & Classes" tab schema_update_11
 * had removed — see below for that history).
 *
 * Routed from BOTH the Admin portal (/admin/batches) and the Coordinator
 * portal (/coordinator/batches) — see app.routes.ts. Each portal's own
 * `canActivate: [authGuard, roleGuard([...])]` already restricts who can
 * reach this component at all (Admin-only route tree / Coordinator-only
 * route tree respectively) — that's the real RBAC boundary, and every
 * /api/v1/batches/* and /api/academic/batches/*, /api/academic/subjects
 * call is independently enforced server-side (require_roles("admin",
 * "coordinator")) regardless.
 *
 * NOTE (schema_update_11, reversed by schema_update_16): the original
 * "Subjects & Classes" tab here let Admin/Coordinator freely create
 * ad-hoc subjects with codes; schema_update_11 replaced it with a
 * read-only, pre-declared Cambridge subject catalog. schema_update_16
 * restores admin-creatable subjects (with duplicate-checked name/code and
 * multi-level mapping — see AddSubjectDialogComponent) per the updated
 * workflow, so this page is Batches + Subject Catalog again.
 */
@Component({
  selector: 'app-academics-management',
  standalone: true,
  imports: [CommonModule, CardModule, TabViewModule, AdminBatchesComponent, AdminSubjectCatalogComponent],
  templateUrl: './academics-management.component.html',
  styleUrl: './academics-management.component.scss',
})
export class AcademicsManagementComponent {}

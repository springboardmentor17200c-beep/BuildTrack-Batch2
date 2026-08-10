import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MaterialRequest } from '../../../core/models/models';
import { NotificationService } from '../../../core/services/notification.service';
import { ProcurementService } from '../../../core/services/procurement.service';

@Component({
  selector: 'app-procurement-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Procurement / Request</p>
          <h1>Procurement Request</h1>
        </div>
        <a routerLink="/procurement" class="btn btn-outline">
          <i class="fa-solid fa-cart-shopping"></i> Procurement dashboard
        </a>
      </div>

      <div class="request-grid">
        <form class="panel request-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="panel-header"><h3>New Material Request</h3></div>
          <div class="form-body">
            <div class="form-field">
              <label for="project">Project Name</label>
              <input id="project" formControlName="project" placeholder="e.g. City Mall Phase 2" />
            </div>
            <div class="form-field">
              <label for="material_name">Material Name</label>
              <input id="material_name" formControlName="material_name" placeholder="Cement bags, steel bars..." />
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="quantity">Quantity</label>
                <input id="quantity" type="number" min="0.1" step="0.1" formControlName="quantity" />
              </div>
              <div class="form-field">
                <label for="required_date">Required Date</label>
                <input id="required_date" type="date" formControlName="required_date" />
              </div>
            </div>
            <div class="form-field">
              <label for="priority">Priority</label>
              <select id="priority" formControlName="priority">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="form-field">
              <label for="remarks">Remarks</label>
              <input id="remarks" formControlName="remarks" placeholder="Optional details..." />
            </div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">
              <i class="fa-solid fa-paper-plane"></i> Submit Request
            </button>
          </div>
        </form>

        <section class="panel">
          <div class="panel-header"><h3>Recent Requests</h3></div>
          <div class="request-list">
            <div class="request-item" *ngFor="let item of recentRequests()">
              <div>
                <strong>{{ item.request_id || item.material_name }}</strong>
                <span>{{ item.project }} - Qty: {{ item.quantity }}</span>
              </div>
              <span class="badge" [ngClass]="statusClass(item.status)">{{ item.status }}</span>
            </div>
            <p class="empty" *ngIf="recentRequests().length === 0">No procurement requests found.</p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .request-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 18px; }
    .form-body { padding: 18px 24px 0; display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-field { display: flex; flex-direction: column; gap: 4px; }
    .form-field label { font-size: 13px; font-weight: 600; color: var(--muted); }
    .form-field input, .form-field select { padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; }
    .modal-footer { padding: 16px 24px; display: flex; justify-content: flex-end; }
    .request-list { padding: 14px 18px 20px; display: grid; gap: 10px; }
    .request-item { display: flex; justify-content: space-between; gap: 12px; align-items: center; border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
    .request-item strong, .request-item span { display: block; }
    .request-item span { color: var(--muted); font-size: 12.5px; margin-top: 3px; }
    .empty { color: var(--muted); margin: 4px 0; }
    @media (max-width: 900px) { .request-grid { grid-template-columns: 1fr; } }
  `],
})
export class ProcurementRequestComponent implements OnInit {
  private fb = new FormBuilder();
  submitting = signal(false);
  recentRequests = signal<MaterialRequest[]>([]);

  form = this.fb.group({
    project: ['', [Validators.required, Validators.minLength(2)]],
    material_name: ['', [Validators.required, Validators.minLength(2)]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    required_date: [new Date().toISOString().slice(0, 10), Validators.required],
    priority: ['medium' as 'low' | 'medium' | 'high', Validators.required],
    remarks: [''],
  });

  constructor(
    private readonly procurementService: ProcurementService,
    private readonly notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.loadRecent();
  }

  loadRecent(): void {
    this.procurementService.getMaterialRequests({ limit: 6 }).subscribe({
      next: (res) => this.recentRequests.set(res.items),
      error: () => {},
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const val = this.form.getRawValue();
    const payload: Partial<MaterialRequest> = {
      project: val.project!,
      material_name: val.material_name!,
      quantity: Number(val.quantity),
      required_date: new Date(val.required_date!).toISOString(),
      priority: val.priority!,
      remarks: val.remarks || undefined,
    };

    this.procurementService.createMaterialRequest(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.notificationService.success('Material request submitted successfully');
        this.form.reset({
          project: '',
          material_name: '',
          quantity: 1,
          required_date: new Date().toISOString().slice(0, 10),
          priority: 'medium',
          remarks: '',
        });
        this.loadRecent();
      },
      error: (err) => {
        this.submitting.set(false);
        const detail = err?.error?.detail || err?.message || 'Failed to submit request';
        this.notificationService.error(`Submission failed: ${detail}`);
      },
    });
  }

  statusClass(status?: string): string {
    if (status === 'approved') return 'badge-green';
    if (status === 'rejected') return 'badge-red';
    return 'badge-amber';
  }
}

import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

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
              <label for="supplier">Supplier</label>
              <input id="supplier" formControlName="supplier" placeholder="Supplier or vendor name" />
            </div>
            <div class="form-field">
              <label for="itemsSummary">Items Summary</label>
              <input id="itemsSummary" formControlName="itemsSummary" placeholder="Cement, steel bars, wiring..." />
            </div>
            <div class="form-row">
              <div class="form-field">
                <label for="amount">Estimated Amount</label>
                <input id="amount" type="number" min="0" formControlName="amount" />
              </div>
              <div class="form-field">
                <label for="requestDate">Request Date</label>
                <input id="requestDate" type="date" formControlName="requestDate" />
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="submit" class="btn btn-primary"><i class="fa-solid fa-paper-plane"></i> Submit Request</button>
          </div>
          <p class="saved" *ngIf="saved()">Request added to procurement queue.</p>
        </form>

        <section class="panel">
          <div class="panel-header"><h3>Recent Requests</h3></div>
          <div class="request-list">
            <div class="request-item" *ngFor="let order of data.purchaseOrders.slice(0, 6)">
              <div>
                <strong>{{ order.poNo }}</strong>
                <span>{{ order.itemsSummary }}</span>
              </div>
              <span class="badge" [ngClass]="statusClass(order.status)">{{ order.status }}</span>
            </div>
            <p class="empty" *ngIf="data.purchaseOrders.length === 0">No procurement requests yet.</p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .request-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr); gap: 18px; }
    .form-body { padding: 18px 24px 0; }
    .request-list { padding: 14px 18px 20px; display: grid; gap: 10px; }
    .request-item { display: flex; justify-content: space-between; gap: 12px; align-items: center; border: 1px solid var(--border); border-radius: 12px; padding: 12px; }
    .request-item strong, .request-item span { display: block; }
    .request-item span { color: var(--muted); font-size: 12.5px; margin-top: 3px; }
    .saved { color: var(--green); font-weight: 700; font-size: 13px; padding: 0 24px 18px; margin: 0; }
    .empty { color: var(--muted); margin: 4px 0; }
    @media (max-width: 900px) { .request-grid { grid-template-columns: 1fr; } }
  `],
})
export class ProcurementRequestComponent {
  private fb = new FormBuilder();
  saved = signal(false);

  form = this.fb.group({
    supplier: ['', Validators.required],
    itemsSummary: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    requestDate: [new Date().toISOString().slice(0, 10), Validators.required],
  });

  constructor(public data: MockDataService) {}

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.data.addPurchaseOrder({
      supplier: value.supplier!,
      itemsSummary: value.itemsSummary!,
      amount: value.amount ?? 0,
      requestDate: value.requestDate!,
      status: 'Pending',
    });
    this.saved.set(true);
    this.form.reset({ supplier: '', itemsSummary: '', amount: 0, requestDate: new Date().toISOString().slice(0, 10) });
  }

  statusClass(status: string): string {
    if (status === 'Delivered') return 'badge-green';
    if (status === 'Approved') return 'badge-blue';
    if (status === 'Cancelled') return 'badge-red';
    return 'badge-amber';
  }
}

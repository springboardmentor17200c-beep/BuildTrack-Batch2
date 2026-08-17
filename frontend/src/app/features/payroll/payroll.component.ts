import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { WorkforceService } from '../../core/services/workforce.service';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-payroll',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './payroll.component.html',
  styleUrl: './payroll.component.scss',
})
export class PayrollComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workforceService = inject(WorkforceService);
  private readonly mockData = inject(MockDataService);

  workers = signal<any[]>([]);
  projects = signal<any[]>([]);
  payroll = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');

  showAddModal = signal(false);
  editingPayroll = signal<any | null>(null);

  form = this.fb.group({
    workerId: ['', Validators.required],
    projectId: [''],
    payPeriodStart: [this.firstOfMonth(), Validators.required],
    payPeriodEnd: [this.today(), Validators.required],
    basicAmount: [0, [Validators.required, Validators.min(0)]],
    overtimeHours: [0, Validators.min(0)],
    overtimeAmount: [0, Validators.min(0)],
    deductions: [0, Validators.min(0)],
    bonus: [0, Validators.min(0)],
    status: ['DRAFT', Validators.required],
  });

  ngOnInit(): void {
    this.loadProjects();
    this.loadWorkers();
  }

  private loadProjects(): void {
    this.mockData.loadProjects();
    this.projects.set(this.mockData.projects);
  }

  private loadWorkers(): void {
    this.workforceService.getWorkers().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.workers.set(list);
        // Workers are loaded now, so payroll records can safely resolve
        // worker_id -> first_name + last_name.
        this.loadPayroll();
      },
      error: (error) => console.error('Failed to load workers', error),
    });
  }

  loadPayroll(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.workforceService.getPayroll().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.payroll.set(list.map((p: any) => this.fromBackend(p)));
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load payroll', error);
        this.errorMessage.set('Failed to load payroll records.');
        this.loading.set(false);
      },
    });
  }

  private fromBackend(record: any): any {
    const worker = this.workers().find(
      (w) => w.id === record.worker_id || w._id === record.worker_id,
    );

    return {
      ...record,
      id: record._id || record.id,
      workerName: worker
        ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim()
        : record.worker_id,
      periodStart: record.pay_period_start ? String(record.pay_period_start).slice(0, 10) : '',
      periodEnd: record.pay_period_end ? String(record.pay_period_end).slice(0, 10) : '',
      basicAmount: record.basic_amount ?? 0,
      overtimeHours: record.overtime_hours ?? 0,
      overtimeAmount: record.overtime_amount ?? 0,
      deductions: record.deductions ?? 0,
      bonus: record.bonus ?? 0,
      netAmount: record.net_amount ?? 0,
      status: record.status || 'DRAFT',
    };
  }

  statusClass(status: string): string {
    switch (status) {
      case 'PAID':
        return 'badge-green';
      case 'APPROVED':
        return 'badge-blue';
      case 'PENDING':
        return 'badge-amber';
      default:
        return 'badge-red';
    }
  }

  // =========================
  // ADD / EDIT
  // =========================

  openAdd(): void {
    if (!this.workers().length) {
      alert('No worker is available here. Add workers in Worker Management first.');
      return;
    }

    this.editingPayroll.set(null);
    this.form.reset({
      workerId: this.workers()[0].id || this.workers()[0]._id,
      projectId: '',
      payPeriodStart: this.firstOfMonth(),
      payPeriodEnd: this.today(),
      basicAmount: 0,
      overtimeHours: 0,
      overtimeAmount: 0,
      deductions: 0,
      bonus: 0,
      status: 'DRAFT',
    });
    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  openEdit(record: any): void {
    this.editingPayroll.set(record);
    this.form.reset({
      workerId: record.worker_id,
      projectId: record.project_id || '',
      payPeriodStart: record.periodStart,
      payPeriodEnd: record.periodEnd,
      basicAmount: record.basicAmount,
      overtimeHours: record.overtimeHours,
      overtimeAmount: record.overtimeAmount,
      deductions: record.deductions,
      bonus: record.bonus,
      status: record.status,
    });
    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    if (this.saving()) return;
    this.showAddModal.set(false);
    this.editingPayroll.set(null);
  }

  submitAdd(): void {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please fill all required fields.');
      return;
    }

    this.saving.set(true);
    const v = this.form.getRawValue();
    const editing = this.editingPayroll();

    // net_amount is computed server-side — we don't send it.
    if (editing?.id) {
      const payload = {
        basic_amount: Number(v.basicAmount),
        overtime_hours: Number(v.overtimeHours),
        overtime_amount: Number(v.overtimeAmount),
        deductions: Number(v.deductions),
        bonus: Number(v.bonus),
        status: v.status,
      };

      this.workforceService.updatePayroll(editing.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeAdd();
          this.loadPayroll();
        },
        error: (error) => this.handleSaveError(error),
      });
      return;
    }

    const payload = {
      worker_id: v.workerId,
      project_id: v.projectId || undefined,
      pay_period_start: new Date(v.payPeriodStart!).toISOString(),
      pay_period_end: new Date(v.payPeriodEnd!).toISOString(),
      basic_amount: Number(v.basicAmount),
      overtime_hours: Number(v.overtimeHours),
      overtime_amount: Number(v.overtimeAmount),
      deductions: Number(v.deductions),
      bonus: Number(v.bonus),
      status: v.status,
    };

    this.workforceService.createPayroll(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdd();
        this.loadPayroll();
      },
      error: (error) => this.handleSaveError(error),
    });
  }

  private handleSaveError(error: any): void {
    console.error('Payroll save error:', error);
    this.errorMessage.set(this.formatError(error));
    this.saving.set(false);
  }

  deletePayroll(record: any): void {
    if (!record?.id) return;
    if (!confirm(`Delete payroll record for ${record.workerName}?`)) return;

    this.workforceService.deletePayroll(record.id).subscribe({
      next: () => {
        this.payroll.update((list) => list.filter((p) => p.id !== record.id));
      },
      error: (error) => {
        console.error('Delete payroll error:', error);
        this.errorMessage.set(this.formatError(error));
      },
    });
  }

  private formatError(error: any): string {
    const detail = error?.error?.detail;
    if (Array.isArray(detail)) {
      return detail.map((item: any) => item?.msg || 'Validation error').join(' | ');
    }
    if (typeof detail === 'string') return detail;
    return 'Failed to save payroll record.';
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private firstOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
}
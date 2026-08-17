import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { WorkforceService } from '../../../core/services/workforce.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-shift-scheduling',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './shift-scheduling.component.html',
  styles: [`
    .shift-grid {
      padding: 18px 20px 22px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 14px;
    }

    .shift-card {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      background: #fff;
    }

    .shift-card h3 { font-size: 15px; margin: 12px 0 4px; }
    .shift-card p { color: var(--slate); margin: 0 0 10px; font-size: 13px; }

    .empty, .loading { color: var(--muted); padding: 20px; }

    .error {
      padding: 12px 16px;
      margin-bottom: 16px;
      border-radius: 8px;
      background: #fee2e2;
      color: #991b1b;
    }

    @media (max-width: 1000px) { .shift-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .shift-grid { grid-template-columns: 1fr; } }
  `],
})
export class ShiftSchedulingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workforceService = inject(WorkforceService);
  readonly auth = inject(AuthService);

  get isWorkerView(): boolean {
    return this.auth.currentUser()?.role === 'Worker';
  }

  get myAssignments(): any[] {
    if (!this.isWorkerView) return this.assignments();
    const workerId = this.auth.currentUser()?.workerId;
    return this.assignments().filter((a) => a.worker_id === workerId);
  }

  shifts = signal<any[]>([]);
  assignments = signal<any[]>([]);
  workers = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');

  showShiftModal = signal(false);
  showAssignModal = signal(false);

  shiftForm = this.fb.group({
    name: ['', Validators.required],
    projectId: [''],
    startTime: ['09:00', Validators.required],
    endTime: ['17:00', Validators.required],
    description: [''],
  });

  assignForm = this.fb.group({
    workerId: ['', Validators.required],
    shiftId: ['', Validators.required],
    projectId: [''],
    date: [this.today(), Validators.required],
  });

  ngOnInit(): void {
    this.loadWorkers();
    this.loadShifts();
    this.loadAssignments();
  }

  // =========================
  // LOAD
  // =========================

  private loadWorkers(): void {
    this.workforceService.getWorkers().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.workers.set(list);
      },
      error: (error) => console.error('Failed to load workers', error),
    });
  }

  loadShifts(): void {
    this.workforceService.getShifts().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.shifts.set(list.map((s: any) => ({ ...s, id: s._id || s.id })));
      },
      error: (error) => console.error('Failed to load shifts', error),
    });
  }

  loadAssignments(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.workforceService.getShiftAssignments().subscribe({
      next: (response) => {
        const items = Array.isArray(response)
          ? response
          : response?.items ?? response?.data ?? response?.assignments ?? [];

        this.assignments.set(items.map((a: any) => this.fromBackend(a)));
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load shift assignments', error);
        this.errorMessage.set('Failed to load shift assignments.');
        this.loading.set(false);
      },
    });
  }

  private fromBackend(assignment: any): any {
    const worker = this.workers().find(
      (w) => w.id === assignment.worker_id || w._id === assignment.worker_id,
    );
    const shift = this.shifts().find(
      (s) => s.id === assignment.shift_id,
    );

    return {
      ...assignment,
      id: assignment._id || assignment.id,
      workerName: worker
        ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim()
        : assignment.worker_id,
      shiftName: shift?.name || assignment.shift_id,
      startTime: shift?.start_time,
      endTime: shift?.end_time,
      date: assignment.date ? String(assignment.date).slice(0, 10) : '',
    };
  }

  // =========================
  // CREATE SHIFT (template)
  // =========================

  openShiftModal(): void {
    this.shiftForm.reset({ name: '', projectId: '', startTime: '09:00', endTime: '17:00', description: '' });
    this.errorMessage.set('');
    this.showShiftModal.set(true);
  }

  closeShiftModal(): void {
    if (this.saving()) return;
    this.showShiftModal.set(false);
  }

  submitShift(): void {
    if (this.shiftForm.invalid) {
      this.shiftForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const v = this.shiftForm.getRawValue();

    const payload = {
      name: v.name,
      project_id: v.projectId || undefined,
      start_time: v.startTime,
      end_time: v.endTime,
      description: v.description || undefined,
      status: 'ACTIVE',
    };

    this.workforceService.createShift(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showShiftModal.set(false);
        this.loadShifts();
      },
      error: (error) => {
        console.error('Shift create error:', error);
        this.errorMessage.set(this.formatError(error));
        this.saving.set(false);
      },
    });
  }

  // =========================
  // ASSIGN WORKER TO SHIFT
  // =========================

  openAssignModal(): void {
    if (!this.shifts().length) {
      alert('Create a shift first before assigning workers to it.');
      return;
    }
    if (!this.workers().length) {
      alert('No workers available. Add workers in Worker Management first.');
      return;
    }

    this.assignForm.reset({
      workerId: this.workers()[0].id || this.workers()[0]._id,
      shiftId: this.shifts()[0].id,
      projectId: this.shifts()[0].project_id || '',
      date: this.today(),
    });
    this.errorMessage.set('');
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void {
    if (this.saving()) return;
    this.showAssignModal.set(false);
  }

  onShiftChange(shiftId: string): void {
    const shift = this.shifts().find((s) => s.id === shiftId);
    this.assignForm.patchValue({ projectId: shift?.project_id || '' });
  }

  submitAssignment(): void {
    if (this.assignForm.invalid) {
      this.assignForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const v = this.assignForm.getRawValue();

    const payload = {
      worker_id: v.workerId,
      shift_id: v.shiftId,
      project_id: v.projectId || undefined,
      date: new Date(v.date!).toISOString(),
      status: 'ACTIVE',
    };

    this.workforceService.createShiftAssignment(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAssignModal.set(false);
        this.loadAssignments();
      },
      error: (error) => {
        console.error('Shift assignment create error:', error);
        this.errorMessage.set(this.formatError(error));
        this.saving.set(false);
      },
    });
  }

  deleteAssignment(assignment: any): void {
    if (!assignment?.id) return;
    if (!confirm(`Remove ${assignment.workerName} from this shift?`)) return;

    this.workforceService.deleteShiftAssignment(assignment.id).subscribe({
      next: () => {
        this.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
      },
      error: (error) => {
        console.error('Delete assignment error:', error);
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
    return 'Something went wrong.';
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
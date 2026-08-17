import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { WorkforceService } from '../../core/services/workforce.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { AuthService } from '../../core/services/auth.service';

// Backend accepts only these three (see AttendanceBase.status in models.py)
type BackendAttendanceStatus = 'present' | 'absent' | 'leave';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workforceService = inject(WorkforceService);
  // Projects are still sourced from MockDataService — same pattern
  // WorkersComponent already uses for its project dropdown.
  private readonly mockData = inject(MockDataService);
  readonly auth = inject(AuthService);

  get isWorkerView(): boolean {
    return this.auth.currentUser()?.role === 'Worker';
  }

  workers = signal<any[]>([]);
  projects = signal<any[]>([]);
  attendance = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  searchTerm = signal('');

  showAddModal = signal(false);
  editingAttendance = signal<any | null>(null);

  statusOptions: { value: BackendAttendanceStatus; label: string }[] = [
    { value: 'present', label: 'Present' },
    { value: 'absent', label: 'Absent' },
    { value: 'leave', label: 'On Leave' },
  ];

  form = this.fb.group({
    workerId: ['', Validators.required],
    projectId: [''],
    date: [this.today(), Validators.required],
    checkIn: [''],
    checkOut: [''],
    status: ['present' as BackendAttendanceStatus, Validators.required],
    remarks: [''],
  });

  ngOnInit(): void {
    this.loadProjects();
    this.loadWorkers();
    this.loadAttendance();

    if (!this.isWorkerView) {
      this.loadLowAttendance();
    }
  }

  // =========================
  // LOAD
  // =========================

  private loadProjects(): void {
    this.mockData.loadProjects();
    this.projects.set(this.mockData.projects);
  }

  private loadWorkers(): void {
    this.workforceService.getWorkers().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response)
          ? response
          : response?.items || response?.data || [];
        this.workers.set(list);
      },
      error: (error) => {
        console.error('Failed to load workers', error);
      },
    });
  }

  loadAttendance(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    // Unfiltered — the backend's plain GET /attendance list has no
    // query filters, so we always load everything and filter client-side.
    this.workforceService.getAttendance().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response)
          ? response
          : response?.items || response?.data || [];

        this.attendance.set(list.map((item: any) => this.fromBackend(item)));
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load attendance', error);
        this.errorMessage.set('Failed to load attendance records.');
        this.loading.set(false);
      },
    });
  }

  // =========================
  // LOW ATTENDANCE
  // =========================

  lowAttendanceWorkers = signal<any[]>([]);
  loadingLowAttendance = signal(false);
  notifyingWorkerId = signal<string | null>(null);
  notifiedWorkerIds = signal<Set<string>>(new Set());

  loadLowAttendance(): void {
    this.loadingLowAttendance.set(true);

    this.workforceService
      .getLowAttendanceWorkers({ days: 30, threshold: 75 })
      .subscribe({
        next: (response: any) => {
          const list = Array.isArray(response)
            ? response
            : response?.items || response?.data || [];
          this.lowAttendanceWorkers.set(list);
          this.loadingLowAttendance.set(false);
        },
        error: (error) => {
          console.error('Failed to load low-attendance workers', error);
          this.loadingLowAttendance.set(false);
        },
      });
  }

  notifyWorker(worker: any): void {
    if (this.notifyingWorkerId()) return;

    this.notifyingWorkerId.set(worker.worker_id);

    this.workforceService.notifyLowAttendance(worker.worker_id, 30).subscribe({
      next: () => {
        this.notifyingWorkerId.set(null);
        this.notifiedWorkerIds.update((set) => new Set(set).add(worker.worker_id));
      },
      error: (error) => {
        console.error('Notify low attendance error:', error);
        this.notifyingWorkerId.set(null);
        alert(this.formatError(error));
      },
    });
  }

  isNotified(workerId: string): boolean {
    return this.notifiedWorkerIds().has(workerId);
  }

  // =========================
  // BACKEND -> FRONTEND
  // =========================

  private fromBackend(record: any): any {
    const worker = this.workers().find(
      (w) => w.id === record.worker_id || w._id === record.worker_id,
    );

    return {
      ...record,
      id: record._id || record.id,
      workerId: record.worker_id,
      workerName: worker
        ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim()
        : record.worker_id,
      role: worker?.designation || worker?.category || '-',
      projectId: record.project_id || '',
      date: record.date ? String(record.date).slice(0, 10) : '',
      checkIn: this.toTimeInput(record.check_in_time),
      checkOut: this.toTimeInput(record.check_out_time),
      status: record.status || 'absent',
      remarks: record.remarks || '',
    };
  }

  private toTimeInput(isoDateTime?: string): string {
    if (!isoDateTime) return '';
    const date = new Date(isoDateTime);
    if (Number.isNaN(date.getTime())) return '';
    return date.toTimeString().slice(0, 5); // "HH:mm"
  }

  // =========================
  // FRONTEND -> BACKEND
  // =========================

  private toIsoDateTime(dateStr: string, timeStr: string): string | null {
    if (!dateStr || !timeStr) return null;
    const iso = new Date(`${dateStr}T${timeStr}:00`);
    return Number.isNaN(iso.getTime()) ? null : iso.toISOString();
  }

  // =========================
  // SEARCH / FILTER
  // =========================

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  get filteredAttendance(): any[] {
    const term = this.searchTerm().trim().toLowerCase();
    let list = this.attendance();

    if (this.isWorkerView) {
      const workerId = this.auth.currentUser()?.workerId;
      list = list.filter((a) => a.workerId === workerId);
    }

    if (!term) return list;
    return list.filter(
      (a) =>
        String(a.workerName || '').toLowerCase().includes(term) ||
        String(a.role || '').toLowerCase().includes(term),
    );
  }

  statusClass(status: string): string {
    switch (status) {
      case 'present':
        return 'badge-green';
      case 'leave':
        return 'badge-amber';
      default:
        return 'badge-red';
    }
  }

  statusLabel(status: string): string {
    return this.statusOptions.find((s) => s.value === status)?.label || status;
  }

  // =========================
  // ADD / EDIT
  // =========================

  openAdd(): void {
    if (!this.workers().length) {
      alert('No worker is available here. Add workers in Worker Management first.');
      return;
    }

    this.editingAttendance.set(null);
    const firstWorker = this.workers()[0];

    this.form.reset({
      workerId: firstWorker.id || firstWorker._id,
      projectId: firstWorker.project_id || '',
      date: this.today(),
      checkIn: '',
      checkOut: '',
      status: 'present',
      remarks: '',
    });

    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  openEdit(record: any): void {
    this.editingAttendance.set(record);

    this.form.reset({
      workerId: record.workerId,
      projectId: record.projectId || '',
      date: record.date,
      checkIn: record.checkIn || '',
      checkOut: record.checkOut || '',
      status: record.status || 'present',
      remarks: record.remarks || '',
    });

    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    if (this.saving()) return;
    this.showAddModal.set(false);
    this.editingAttendance.set(null);
  }

  onWorkerChange(workerId: string): void {
    const worker = this.workers().find((w) => (w.id || w._id) === workerId);
    if (!worker) return;
    this.form.patchValue({ projectId: worker.project_id || '' });
  }

  // =========================
  // SUBMIT
  // =========================

  submitAdd(): void {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please fill all required fields.');
      return;
    }

    this.saving.set(true);

    const v = this.form.getRawValue();

    const payload: any = {
      worker_id: v.workerId,
      project_id: v.projectId || undefined,
      date: new Date(v.date!).toISOString(),
      check_in_time: this.toIsoDateTime(v.date!, v.checkIn || ''),
      check_out_time: this.toIsoDateTime(v.date!, v.checkOut || ''),
      status: v.status,
      remarks: v.remarks || undefined,
    };

    const editing = this.editingAttendance();

    const request$ = editing?.id
      ? this.workforceService.updateAttendance(editing.id, payload)
      : this.workforceService.createAttendance(payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdd();
        this.loadAttendance();
        if (!this.isWorkerView) {
          this.loadLowAttendance();
        }
      },
      error: (error) => {
        console.error('Attendance save error:', error);
        this.errorMessage.set(this.formatError(error));
        this.saving.set(false);
      },
    });
  }

  deleteAttendance(record: any): void {
    if (!record?.id) return;
    if (!confirm(`Delete attendance for ${record.workerName}?`)) return;

    this.workforceService.deleteAttendance(record.id).subscribe({
      next: () => {
        this.attendance.update((list) => list.filter((a) => a.id !== record.id));
        if (!this.isWorkerView) {
          this.loadLowAttendance();
        }
      },
      error: (error) => {
        console.error('Delete attendance error:', error);
        this.errorMessage.set(this.formatError(error));
      },
    });
  }

  // =========================
  // ERROR
  // =========================

  private formatError(error: any): string {
    const detail = error?.error?.detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item: any) => item?.msg || 'Validation error')
        .filter(Boolean)
        .join(' | ');
    }

    if (typeof detail === 'string') return detail;
    if (typeof error?.error?.message === 'string') return error.error.message;

    return 'Failed to save attendance.';
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
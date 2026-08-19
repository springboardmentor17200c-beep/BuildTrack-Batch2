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
  currentView = signal<'roster' | 'low_attendance'>('roster');

  showAddModal = signal(false);
  editingAttendance = signal<any | null>(null);

  switchView(view: 'roster' | 'low_attendance'): void {
    this.currentView.set(view);
    if (view === 'low_attendance') {
      this.loadLowAttendance();
    }
  }

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
        // Workers are loaded now, so attendance records can safely resolve
        // worker_id -> first_name + last_name.
        this.loadAttendance();
        if (!this.isWorkerView) {
          this.loadLowAttendance();
        }
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

    const workerCode =
      worker?.worker_code ||
      worker?.workerCode ||
      `WRK-${String(record.worker_id || '').slice(-4).toUpperCase()}`;

    return {
      ...record,
      id: record._id || record.id,
      workerId: record.worker_id,
      workerCode: workerCode,
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

  readonly pageSize = 10;
  currentPage = signal(1);
  selectedDate = signal<string>(this.today());

  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate.set(input.value);
    this.currentPage.set(1);
  }

  previousDay(): void {
    const current = this.selectedDate() || this.today();
    const d = new Date(current + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate.set(`${year}-${month}-${day}`);
    this.currentPage.set(1);
  }

  nextDay(): void {
    const current = this.selectedDate() || this.today();
    const d = new Date(current + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    this.selectedDate.set(`${year}-${month}-${day}`);
    this.currentPage.set(1);
  }

  get isFutureDate(): boolean {
    const selected = this.selectedDate();
    if (!selected) return false;
    return selected > this.today();
  }

  setToday(): void {
    this.selectedDate.set(this.today());
    this.currentPage.set(1);
  }

  clearDateFilter(): void {
    this.selectedDate.set('');
    this.currentPage.set(1);
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  get filteredAttendance(): any[] {
    if (this.isFutureDate) {
      return [];
    }

    const term = this.searchTerm().trim().toLowerCase();
    const dateFilter = this.selectedDate();
    const allWorkers = this.workers();
    const currentWorkerId = this.auth.currentUser()?.workerId;

    let list: any[] = [];

    if (dateFilter) {
      // Build a complete attendance sheet with all registered workers for this date
      const dateRecords = this.attendance().filter((a) => a.date === dateFilter);
      const recordMap = new Map<string, any>();
      for (const rec of dateRecords) {
        if (rec.workerId) {
          recordMap.set(String(rec.workerId), rec);
        }
      }

      const activeWorkers = this.isWorkerView && currentWorkerId
        ? allWorkers.filter((w) => String(w.id || w._id) === String(currentWorkerId))
        : allWorkers;

      list = activeWorkers.map((w) => {
        const wid = String(w.id || w._id);
        const existing = recordMap.get(wid);
        if (existing) {
          return existing;
        }

        const name = `${w.first_name || ''} ${w.last_name || ''}`.trim() || w.name || 'Worker';
        const role = w.designation || w.category || w.trade || '-';
        const workerCode = w.worker_code || w.workerCode || `WRK-${wid.slice(-4).toUpperCase()}`;

        return {
          id: null,
          workerId: wid,
          workerCode: workerCode,
          workerName: name,
          role: role,
          projectId: w.project_id || '',
          date: dateFilter,
          checkIn: '',
          checkOut: '',
          status: '',
          remarks: '',
          isTemporary: true,
        };
      });
    } else {
      list = this.attendance();
      if (this.isWorkerView && currentWorkerId) {
        list = list.filter((a) => String(a.workerId) === String(currentWorkerId));
      }
    }

    if (!term) return list;
    return list.filter(
      (a) =>
        String(a.workerCode || '').toLowerCase().includes(term) ||
        String(a.workerName || '').toLowerCase().includes(term) ||
        String(a.role || '').toLowerCase().includes(term),
    );
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredAttendance.length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedAttendance(): any[] {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.filteredAttendance.slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.filteredAttendance.length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.filteredAttendance.length);
  }

  statusClass(status: string, isTemporary?: boolean): string {
    if (isTemporary || !status) {
      return 'badge-gray';
    }
    switch ((status || '').toLowerCase()) {
      case 'present':
        return 'badge-green';
      case 'leave':
        return 'badge-amber';
      case 'absent':
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  }

  statusLabel(status: string, isTemporary?: boolean): string {
    if (isTemporary || !status) {
      return 'Not Marked';
    }
    const found = this.statusOptions.find((s) => s.value === status);
    return found ? found.label : (status === 'present' ? 'Present' : (status === 'absent' ? 'Absent' : status));
  }

  setStatus(record: any, newStatus: BackendAttendanceStatus): void {
    if (this.isWorkerView) return;
    if (this.isFutureDate) {
      alert('Day not start yet. Attendance cannot be recorded for future dates.');
      return;
    }

    const prevStatus = record.status;
    record.status = newStatus;

    if (record.id) {
      this.workforceService.updateAttendance(record.id, { status: newStatus }).subscribe({
        next: (res: any) => {
          this.attendance.update((list) =>
            list.map((item) => (item.id === record.id ? { ...item, status: newStatus } : item))
          );
          if (!this.isWorkerView) {
            this.loadLowAttendance();
          }
        },
        error: (error) => {
          record.status = prevStatus;
          console.error('Failed to update status', error);
          alert(this.formatError(error));
        },
      });
    } else {
      const payload: any = {
        worker_id: record.workerId,
        project_id: record.projectId || undefined,
        date: new Date(`${record.date || this.selectedDate() || this.today()}T00:00:00`).toISOString(),
        status: newStatus,
      };

      this.workforceService.createAttendance(payload).subscribe({
        next: (created: any) => {
          const formatted = this.fromBackend(created);
          record.id = formatted.id;
          record.isTemporary = false;
          this.attendance.update((list) => [...list, formatted]);
          if (!this.isWorkerView) {
            this.loadLowAttendance();
          }
        },
        error: (error) => {
          record.status = prevStatus;
          console.error('Failed to create attendance status', error);
          alert(this.formatError(error));
        },
      });
    }
  }

  toggleStatus(record: any): void {
    const current = (record.status || 'absent').toLowerCase();
    const next: BackendAttendanceStatus = current === 'present' ? 'absent' : 'present';
    this.setStatus(record, next);
  }

  markAll(status: BackendAttendanceStatus): void {
    if (this.isWorkerView || this.isFutureDate) return;
    const items = this.filteredAttendance;
    for (const item of items) {
      if (item.status !== status) {
        this.setStatus(item, status);
      }
    }
  }

  // =========================
  // ADD / EDIT
  // =========================

  openAdd(): void {
    if (this.isFutureDate) {
      alert('Day not start yet. Attendance cannot be recorded for future dates.');
      return;
    }

    if (!this.workers().length) {
      alert('No worker is available here. Add workers in Worker Management first.');
      return;
    }

    this.editingAttendance.set(null);
    const firstWorker = this.workers()[0];

    this.form.reset({
      workerId: firstWorker.id || firstWorker._id,
      projectId: firstWorker.project_id || '',
      date: this.selectedDate() || this.today(),
      checkIn: '',
      checkOut: '',
      status: 'present',
      remarks: '',
    });

    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  openEdit(record: any): void {
    if (this.isFutureDate) {
      alert('Day not start yet. Attendance cannot be recorded for future dates.');
      return;
    }

    this.editingAttendance.set(record.id ? record : null);

    this.form.reset({
      workerId: record.workerId,
      projectId: record.projectId || '',
      date: record.date || this.selectedDate() || this.today(),
      checkIn: record.checkIn || '',
      checkOut: record.checkOut || '',
      status: (record.status && !record.isTemporary ? record.status : 'present') as BackendAttendanceStatus,
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

    const v = this.form.getRawValue();

    if (v.date && v.date > this.today()) {
      this.errorMessage.set('Day not start yet. Attendance cannot be recorded for future dates.');
      return;
    }

    this.saving.set(true);

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
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
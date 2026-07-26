import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { AttendanceRecord, AttendanceStatus } from '../../core/models/models';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './attendance.component.html',
  styleUrl: './attendance.component.scss',
})
export class AttendanceComponent {
  private fb = new FormBuilder();
  searchTerm = signal('');
  showAddModal = signal(false);
  editingAttendance = signal<AttendanceRecord | null>(null);

  form = this.fb.group({
    workerId: ['', Validators.required],
    workerName: ['', Validators.required],
    role: ['Worker', Validators.required],
    date: [this.today(), Validators.required],
    checkIn: [''],
    checkOut: [''],
    status: ['Present' as AttendanceStatus, Validators.required],
  });

  get filteredAttendance() {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.data.attendance;
    if (!term) return list;
    return list.filter(
      (a) => a.workerName.toLowerCase().includes(term) || a.role.toLowerCase().includes(term),
    );
  }

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Present':
        return 'badge-green';
      case 'On Leave':
        return 'badge-amber';
      default:
        return 'badge-red';
    }
  }

  openAdd(): void {
    if (!this.data.workers.length) {
      alert('No worker is available here. Add workers in Worker Management first.');
      return;
    }
    this.editingAttendance.set(null);
    const firstWorker = this.data.workers[0];
    this.form.reset({
      workerId: firstWorker.id,
      workerName: firstWorker.name,
      role: firstWorker.role,
      date: this.today(),
      checkIn: '',
      checkOut: '',
      status: 'Present',
    });
    this.showAddModal.set(true);
  }

  openEdit(record: AttendanceRecord): void {
    this.editingAttendance.set(record);
    const worker = this.data.workers.find(
      (item) => item.id === record.workerId || item.name === record.workerName,
    );
    this.form.reset({
      workerName: worker?.name ?? record.workerName,
      workerId: worker?.id ?? record.workerId,
      role: worker?.role ?? record.role,
      date: this.toInputDate(record.date),
      checkIn: record.checkIn ?? '',
      checkOut: record.checkOut ?? '',
      status: record.status,
    });
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    this.showAddModal.set(false);
  }

  submitAdd(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const payload = {
      workerId: v.workerId!,
      workerName: v.workerName!,
      role: v.role!,
      date: v.date!,
      checkIn: v.checkIn || undefined,
      checkOut: v.checkOut || undefined,
      status: v.status!,
    };
    const editing = this.editingAttendance();
    if (editing) {
      this.data.updateAttendance({ ...editing, ...payload });
    } else {
      this.data.addAttendance(payload);
    }
    this.closeAdd();
  }

  onWorkerChange(workerId: string): void {
    const worker = this.data.workers.find((item) => item.id === workerId);
    if (!worker) return;
    this.form.patchValue({ workerId: worker.id, workerName: worker.name, role: worker.role });
  }

  deleteAttendance(record: AttendanceRecord): void {
    if (confirm(`Delete attendance for ${record.workerName}?`)) {
      this.data.deleteAttendance(record);
    }
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private toInputDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }
}

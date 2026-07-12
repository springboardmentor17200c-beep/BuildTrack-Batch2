import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { Worker } from '../../core/models/models';

@Component({
  selector: 'app-workers',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './workers.component.html',
  styleUrl: './workers.component.scss',
})
export class WorkersComponent {
  private fb = new FormBuilder();

  searchTerm = signal('');
  showAddModal = signal(false);
  editingWorker = signal<Worker | null>(null);

  get filteredWorkers() {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.data.workers;
    if (!term) return list;
    return list.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.role.toLowerCase().includes(term) ||
        w.contact.includes(term),
    );
  }

  form = this.fb.group({
    name: ['', Validators.required],
    role: ['', Validators.required],
    skillType: ['', Validators.required],
    contact: ['', Validators.required],
    status: ['Active' as 'Active' | 'Inactive', Validators.required],
  });

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  openAdd(): void {
    this.editingWorker.set(null);
    this.form.reset({ status: 'Active' });
    this.showAddModal.set(true);
  }

  openEdit(worker: Worker): void {
    this.editingWorker.set(worker);
    this.form.reset({
      name: worker.name,
      role: worker.role,
      skillType: worker.skillType,
      contact: worker.contact,
      status: worker.status,
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
      name: v.name!,
      role: v.role!,
      skillType: v.skillType!,
      contact: v.contact!,
      attendancePct: this.editingWorker()?.attendancePct ?? 0,
      status: v.status!,
      avatarUrl: this.editingWorker()?.avatarUrl ?? `https://i.pravatar.cc/64?img=${20 + this.data.workers.length}`,
    };
    const editing = this.editingWorker();
    if (editing) {
      this.data.updateWorker({ ...editing, ...payload });
    } else {
      this.data.addWorker(payload);
    }
    this.closeAdd();
  }

  deleteWorker(worker: Worker): void {
    if (confirm(`Delete ${worker.name}?`)) {
      this.data.deleteWorker(worker);
    }
  }
}

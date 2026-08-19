import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { WorkforceService } from '../../core/services/workforce.service';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-allocation',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './allocation.component.html',
  styleUrl: './allocation.component.scss',
})
export class AllocationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly workforceService = inject(WorkforceService);
  private readonly mockData = inject(MockDataService);
  private readonly route = inject(ActivatedRoute);

  workers = signal<any[]>([]);
  projects = signal<any[]>([]);
  allocations = signal<any[]>([]);

  selectedProjectId = signal<string>('');
  loading = signal(false);
  saving = signal(false);
  errorMessage = signal('');

  showAddModal = signal(false);
  editingAllocation = signal<any | null>(null);

  form = this.fb.group({
    workerId: ['', Validators.required],
    projectId: ['', Validators.required],
    role: [''],
    startDate: [this.today(), Validators.required],
    endDate: [''],
    status: ['ACTIVE', Validators.required],
  });

  ngOnInit(): void {
    const queryProjectId = this.route.snapshot.queryParamMap.get('projectId');
    this.loadProjects(queryProjectId);
    this.loadWorkers();
  }

  private loadProjects(preselectedProjectId?: string | null): void {
    this.mockData.loadProjects();
    this.projects.set(this.mockData.projects);

    // Prefer a project passed in via ?projectId= (e.g. from "Manage workers ->"
    // on a project's detail page); otherwise fall back to the first project so
    // the page isn't empty on load.
    const projectId =
      preselectedProjectId && this.projects().some((p) => p.id === preselectedProjectId)
        ? preselectedProjectId
        : this.projects()[0]?.id;

    if (projectId) {
      this.selectedProjectId.set(projectId);
    }
  }

  private loadWorkers(): void {
    this.workforceService.getWorkers().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response)
          ? response
          : response?.items || response?.data || [];
        this.workers.set(list);
        // Workers are loaded now, so allocations can safely resolve
        // worker_id -> first_name + last_name.
        if (this.selectedProjectId()) {
          this.loadAllocationsForProject();
        }
      },
      error: (error) => console.error('Failed to load workers', error),
    });
  }

  onProjectFilterChange(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.loadAllocationsForProject();
  }

  loadAllocationsForProject(): void {
    const projectId = this.selectedProjectId();
    if (!projectId) {
      this.allocations.set([]);
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.workforceService.getAllocations(projectId).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response)
          ? response
          : response?.items || response?.data || [];
        this.allocations.set(list.map((a: any) => this.fromBackend(a)));
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load allocations', error);
        this.errorMessage.set('Failed to load allocations for this project.');
        this.loading.set(false);
      },
    });
  }

  private fromBackend(allocation: any): any {
    const worker = this.workers().find(
      (w) => w.id === allocation.worker_id || w._id === allocation.worker_id,
    );

    return {
      ...allocation,
      id: allocation._id || allocation.id,
      workerId: allocation.worker_id,
      workerName: worker
        ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim()
        : allocation.worker_id,
      projectId: allocation.project_id,
      role: allocation.role || '-',
      startDate: allocation.start_date ? String(allocation.start_date).slice(0, 10) : '',
      endDate: allocation.end_date ? String(allocation.end_date).slice(0, 10) : '',
      status: allocation.status || 'ACTIVE',
    };
  }

  projectName(projectId: string): string {
    return this.projects().find((p) => p.id === projectId)?.name || 'Unknown';
  }

  statusClass(status: string): string {
    switch (status) {
      case 'ACTIVE':
        return 'badge-green';
      case 'COMPLETED':
        return 'badge-blue';
      default:
        return 'badge-red';
    }
  }

  readonly pageSize = 10;
  currentPage = signal(1);

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.allocations().length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedAllocations(): any[] {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.allocations().slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.allocations().length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.allocations().length);
  }

  // =========================
  // ADD / EDIT
  // =========================

  openAdd(): void {
    this.editingAllocation.set(null);
    const projId = this.selectedProjectId() || this.projects()[0]?.id || '';
    this.form.reset({
      workerId: this.workers()[0]?.id || this.workers()[0]?._id || '',
      projectId: projId,
      role: '',
      startDate: this.today(),
      endDate: '',
      status: 'ACTIVE',
    });
    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  openEdit(allocation: any): void {
    this.editingAllocation.set(allocation);
    this.form.reset({
      workerId: allocation.workerId,
      projectId: allocation.projectId,
      role: allocation.role || '',
      startDate: allocation.startDate,
      endDate: allocation.endDate || '',
      status: allocation.status,
    });
    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    if (this.saving()) return;
    this.showAddModal.set(false);
    this.editingAllocation.set(null);
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
    const editing = this.editingAllocation();

    if (editing?.id) {
      // Allocation update only accepts role/start_date/end_date/status —
      // worker_id/project_id can't be changed on an existing allocation.
      const payload = {
        role: v.role || undefined,
        start_date: new Date(v.startDate!).toISOString(),
        end_date: v.endDate ? new Date(v.endDate).toISOString() : undefined,
        status: v.status,
      };

      this.workforceService.updateAllocation(editing.id, payload).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeAdd();
          this.loadAllocationsForProject();
        },
        error: (error) => this.handleSaveError(error),
      });
      return;
    }

    const payload = {
      worker_id: v.workerId,
      project_id: v.projectId,
      role: v.role || undefined,
      start_date: new Date(v.startDate!).toISOString(),
      end_date: v.endDate ? new Date(v.endDate).toISOString() : undefined,
      status: v.status,
    };

    this.workforceService.createAllocation(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdd();
        this.loadAllocationsForProject();
      },
      error: (error) => this.handleSaveError(error),
    });
  }

  private handleSaveError(error: any): void {
    console.error('Allocation save error:', error);
    this.errorMessage.set(this.formatError(error));
    this.saving.set(false);
  }

  deleteAllocation(allocation: any): void {
    if (!allocation?.id) return;
    if (!confirm(`Remove ${allocation.workerName} from this project?`)) return;

    this.workforceService.deleteAllocation(allocation.id).subscribe({
      next: () => {
        this.allocations.update((list) => list.filter((a) => a.id !== allocation.id));
      },
      error: (error) => {
        console.error('Delete allocation error:', error);
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
    return 'Failed to save allocation.';
  }

  today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
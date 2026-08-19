import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { AuthService } from '../../../core/services/auth.service';
import { WorkforceService } from '../../../core/services/workforce.service';
import { Project, ProjectStatus, User } from '../../../core/models/models';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent implements OnInit {
  private fb = new FormBuilder();
  private readonly auth = inject(AuthService);
  private readonly workforceService = inject(WorkforceService);

  get isWorkerView(): boolean {
    return this.auth.currentUser()?.role === 'Worker';
  }

  private myProjectIds = signal<string[] | null>(null);
  managers = signal<User[]>([]);

  projectManagers = computed(() =>
    this.managers().filter((m) => m.role === 'Project Manager' || (m.role as string).toLowerCase().includes('manager'))
  );

  administrators = computed(() =>
    this.managers().filter((m) => m.role === 'Administrator' || (m.role as string).toLowerCase().includes('admin'))
  );

  getManagerName(m: User): string {
    return (m.name && m.name !== 'string' && m.name !== 'None') ? m.name : m.email.split('@')[0];
  }

  isManagerInList(name?: string | null): boolean {
    if (!name || name.toLowerCase() === 'unassigned') return true;
    return this.managers().some((m) =>
      this.getManagerName(m).toLowerCase() === name.toLowerCase() ||
      m.email.toLowerCase() === name.toLowerCase() ||
      m.name?.toLowerCase() === name.toLowerCase()
    );
  }

  loadManagers(selectedManager?: string): void {
    this.auth.getManagers().subscribe({
      next: (list) => {
        this.managers.set(list || []);
        if (selectedManager && selectedManager !== 'Unassigned') {
          const match = (list || []).find((m) =>
            this.getManagerName(m).toLowerCase() === selectedManager.toLowerCase() ||
            m.email.toLowerCase() === selectedManager.toLowerCase() ||
            m.name?.toLowerCase() === selectedManager.toLowerCase()
          );
          if (match) {
            this.form.get('manager')?.setValue(this.getManagerName(match), { emitEvent: false });
          }
        }
      },
      error: () => {},
    });
  }

  ngOnInit(): void {
    this.data.loadProjects();
    this.loadManagers();

    if (!this.isWorkerView) return;

    const workerId = this.auth.currentUser()?.workerId;
    if (!workerId) {
      this.myProjectIds.set([]);
      return;
    }

    this.workforceService.getAllocations(undefined, workerId).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.myProjectIds.set(list.map((a: any) => a.project_id));
      },
      error: (error) => {
        console.error('Failed to load your project allocations', error);
        this.myProjectIds.set([]);
      },
    });
  }

  searchTerm = signal('');
  showAddModal = signal(false);
  editingProject = signal<Project | null>(null);

  // Filter signals
  showFilter = signal(false);
  filterStartDate = signal('');
  filterStatus = signal('ALL');
  filterProgressMin = signal(0);

  // Pagination
  readonly pageSize = 10;
  currentPage = signal(1);

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }

  onFilterStartDateChange(event: Event): void {
    this.filterStartDate.set((event.target as HTMLInputElement).value || '');
    this.currentPage.set(1);
  }

  onFilterStatusChange(event: Event): void {
    this.filterStatus.set((event.target as HTMLSelectElement).value || 'ALL');
    this.currentPage.set(1);
  }

  onFilterProgressChange(event: Event): void {
    this.filterProgressMin.set(Number((event.target as HTMLInputElement).value) || 0);
    this.currentPage.set(1);
  }

  setProgressMin(val: number): void {
    this.filterProgressMin.set(val);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.filterStartDate.set('');
    this.filterStatus.set('ALL');
    this.filterProgressMin.set(0);
    this.currentPage.set(1);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProjects.length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedProjects(): Project[] {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.filteredProjects.slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.filteredProjects.length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.filteredProjects.length);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage.set(page);
    }
  }

  prevPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  hasActiveFilters = computed(() => {
    return Boolean(
      this.filterStartDate() ||
      this.filterStatus() !== 'ALL' ||
      this.filterProgressMin() > 0
    );
  });

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterStartDate()) count++;
    if (this.filterStatus() !== 'ALL') count++;
    if (this.filterProgressMin() > 0) count++;
    return count;
  });

  private parseDate(d?: string): Date | null {
    if (!d) return null;
    if (d.includes('/')) {
      const parts = d.split('/');
      if (parts.length === 3) {
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      }
    }
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /** Plain getter (not computed()) so it re-evaluates after addProject() mutates the array. */
  get filteredProjects() {
    const term = this.searchTerm().trim().toLowerCase();
    const status = this.filterStatus();
    const minProgress = this.filterProgressMin();
    const startDateFilter = this.filterStartDate();

    let list = this.data.projects;

    if (this.isWorkerView) {
      const allowed = this.myProjectIds();
      list = allowed ? list.filter((p) => allowed.includes(p.id)) : [];
    }

    // Search filter
    if (term) {
      list = list.filter(
        (p) => p.name.toLowerCase().includes(term) || p.manager.toLowerCase().includes(term),
      );
    }

    // Status filter
    if (status !== 'ALL') {
      list = list.filter((p) => (p.status || '').toLowerCase() === status.toLowerCase());
    }

    // Progress filter
    if (minProgress > 0) {
      list = list.filter((p) => (p.progress ?? 0) >= minProgress);
    }

    // Start Date filter
    if (startDateFilter) {
      const filterDate = new Date(startDateFilter);
      if (!isNaN(filterDate.getTime())) {
        list = list.filter((p) => {
          const projectDate = this.parseDate(p.startDate);
          if (!projectDate) return true;
          const pD = new Date(projectDate.getFullYear(), projectDate.getMonth(), projectDate.getDate());
          const fD = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
          return pD >= fD;
        });
      }
    }

    return list;
  }

  form = this.fb.group({
    name: ['', Validators.required],
    manager: ['', Validators.required],
    category: ['Commercial' as Project['category'], Validators.required],
    status: ['Not Started' as ProjectStatus, Validators.required],
    startDate: ['', Validators.required],
    endDate: [''],
    budget: [0, [Validators.required, Validators.min(0)]],
    client: [''],
    location: [''],
  });

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'In Progress':
        return 'badge-blue';
      case 'On Hold':
        return 'badge-amber';
      case 'Completed':
        return 'badge-green';
      default:
        return 'badge-gray';
    }
  }

  openAdd(): void {
    this.loadManagers();
    this.editingProject.set(null);
    this.form.reset({ manager: '', category: 'Commercial', status: 'Not Started', startDate: this.today(), endDate: '', budget: 0, client: '', location: '' });
    this.showAddModal.set(true);
  }

  openEdit(project: Project): void {
    const mgr = project.manager && project.manager.toLowerCase() === 'unassigned' ? 'Unassigned' : project.manager;
    this.loadManagers(mgr);
    this.editingProject.set(project);
    this.form.reset({
      name: project.name,
      manager: mgr,
      category: project.category,
      status: project.status,
      startDate: this.toInputDate(project.startDate),
      endDate: this.toInputDate(project.endDate ?? ''),
      budget: project.budget ?? 0,
      client: project.client ?? '',
      location: project.location ?? '',
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
      manager: v.manager!,
      managerId: this.editingProject()?.managerId ?? '',
      category: v.category as any,
      status: v.status as ProjectStatus,
      progress: v.status === 'Completed' ? 100 : this.editingProject()?.progress ?? 0,
      startDate: v.startDate!,
      endDate: v.endDate || undefined,
      budget: v.budget ?? 0,
      client: v.client || undefined,
      location: v.location || undefined,
    };
    const editing = this.editingProject();
    if (editing) {
      this.data.updateProject({ ...editing, ...payload });
    } else {
      this.data.addProject(payload);
    }
    this.closeAdd();
  }

  deleteProject(project: Project): void {
    if (confirm(`Delete ${project.name}?`)) {
      this.data.deleteProject(project);
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private toInputDate(value: string): string {
    if (!value) return '';
    const date = this.parseDate(value);
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
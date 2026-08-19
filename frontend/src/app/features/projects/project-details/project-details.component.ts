import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MockDataService } from '../../../core/services/mock-data.service';
import { WorkforceService } from '../../../core/services/workforce.service';
import { TasksService } from '../../../core/services/tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import { InventoryItem, Milestone, Project, ProjectDocument, ProjectStatus, ProjectTask, ResourceItem, User } from '../../../core/models/models';

interface TeamMember {
  id: string;
  name: string;
  designation: string;
  avatarUrl?: string;
  role: string;
}

interface TeamRoleGroup {
  role: string;
  members: TeamMember[];
}

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './project-details.component.html',
  styleUrl: './project-details.component.scss',
})
export class ProjectDetailsComponent {
  private fb = new FormBuilder();

  activeTab = 'Overview';
  tabs = ['Overview', 'Milestones', 'Tasks', 'Resources', 'Documents', 'Reports'];

  get isReadOnly(): boolean {
    return this.auth.currentUser()?.role === 'Worker';
  }
  project: Project = {
    id: '',
    name: 'Untitled Project',
    category: 'Commercial',
    managerId: '',
    manager: 'Unassigned',
    status: 'Not Started',
    progress: 0,
    startDate: '',
    budget: 0,
  };

  showEditModal = signal(false);
  showMilestoneModal = signal(false);
  showTaskModal = signal(false);
  showResourceModal = signal(false);
  showMaterialModal = signal(false);
  showReturnMaterialModal = signal(false);
  showReturnEquipmentModal = signal(false);
  showDocumentModal = signal(false);
  resourceMessage = signal('');
  materialMessage = signal('');
  returnMaterialMessage = signal('');
  returnEquipmentMessage = signal('');
  returningMaterial = signal<ResourceItem | null>(null);
  returningEquipment = signal<ResourceItem | null>(null);
  selectedDocumentName = signal('');
  selectedDocumentType = signal('');

  editingMilestone = signal<Milestone | null>(null);
  editingTask = signal<any | null>(null);

  // =========================
  // TEAM MEMBERS & WORKERS (real data — allocations + workers, grouped by role)
  // =========================
  private teamAllocations = signal<any[]>([]);
  private allWorkers = signal<any[]>([]);
  loadingTeam = signal(false);
  teamError = signal('');

  groupedTeam = computed<TeamRoleGroup[]>(() => {
    const workers = this.allWorkers();
    const activeAllocations = this.teamAllocations().filter(
      (allocation) => (allocation.status || '').toUpperCase() === 'ACTIVE',
    );

    const groups = new Map<string, TeamMember[]>();
    for (const allocation of activeAllocations) {
      const worker = workers.find(
        (w) => (w.id || w._id) === allocation.worker_id,
      );
      const role =
        allocation.role || worker?.designation || worker?.skill_type || 'Unassigned';
      const member: TeamMember = {
        id: allocation.worker_id,
        name: worker
          ? `${worker.first_name || ''} ${worker.last_name || ''}`.trim() || allocation.worker_id
          : allocation.worker_id,
        designation: worker?.designation || worker?.skill_type || '-',
        avatarUrl: worker?.avatar_url,
        role,
      };
      if (!groups.has(role)) groups.set(role, []);
      groups.get(role)!.push(member);
    }

    return Array.from(groups.entries())
      .map(([role, members]) => ({ role, members }))
      .sort((a, b) => a.role.localeCompare(b.role));
  });

  allTeamMembers = computed(() => {
    return this.groupedTeam().flatMap((g) =>
      g.members.map((m) => ({
        ...m,
        category: g.role,
      }))
    );
  });

  get teamMemberCount(): number {
    return this.allTeamMembers().length;
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

  milestoneForm = this.fb.group({
    title: ['', Validators.required],
    dueDate: ['', Validators.required],
    status: ['Not Started' as ProjectStatus, Validators.required],
    progress: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
  });

  taskForm = this.fb.group({
    title: ['', Validators.required],
    assignMode: ['single' as 'single' | 'category', Validators.required],
    assignedWorkerId: [''],
    category: [''],
    groupMode: ['individual' as 'individual' | 'shared'],
    status: ['Pending' as ProjectTask['status'], Validators.required],
  });

  resourceForm = this.fb.group({
    resourceId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  materialForm = this.fb.group({
    inventoryItemId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });

  returnMaterialForm = this.fb.group({
    returnQuantity: [1, [Validators.required, Validators.min(1)]],
  });

  returnEquipmentForm = this.fb.group({
    returnQuantity: [1, [Validators.required, Validators.min(1)]],
  });

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

  constructor(
    private route: ActivatedRoute,
    public data: MockDataService,
    private workforceService: WorkforceService,
    private tasksService: TasksService,
    public auth: AuthService,
  ) {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.project = this.data.getProjectById(id) ?? this.data.projects[0] ?? this.project;
    this.loadTeamMembers();
    this.loadTasks();
    this.loadManagers();
  }

  // =========================
  // TASKS (real data — backed by /tasks, assigned to a real Worker
  // instead of the old free-text "owner")
  // =========================
  private rawTasks = signal<any[]>([]);
  loadingTasks = signal(false);
  tasksError = signal('');

  tasks = computed(() => {
    const workers = this.allWorkers();
    return this.rawTasks().map((task) => {
      const worker = workers.find((w: any) => (w.id || w._id) === task.assigned_worker_id);
      let owner: string;
      if (task.assigned_category) {
        owner = `All ${task.assigned_category.replace(/_/g, ' ')}`;
      } else if (worker) {
        owner = `${worker.first_name || ''} ${worker.last_name || ''}`.trim();
      } else if (task.assigned_worker_id) {
        owner = 'Unknown worker';
      } else {
        owner = 'Unassigned';
      }
      return {
        id: task._id || task.id,
        title: task.title,
        assignedWorkerId: task.assigned_worker_id || '',
        assignedCategory: task.assigned_category || '',
        owner,
        status: task.status === 'completed' ? 'Completed' : 'Pending',
      } as ProjectTask & { assignedWorkerId: string; assignedCategory: string };
    });
  });

  // Flat list for the single-worker assignment dropdown — sourced
  // from the same allocation-derived worker list the Team panel
  // already loads.
  get assignableWorkers(): any[] {
    return this.groupedTeam().flatMap((group) =>
      group.members.map((member) => ({ id: member.id, name: member.name })),
    );
  }

  // Distinct workforce categories (ENGINEER, SKILLED_WORKER, etc.)
  // present among this project's allocated team — for the "whole
  // category" bulk-assign option.
  get assignableCategories(): string[] {
    const workers = this.allWorkers();
    const teamWorkerIds = new Set(this.assignableWorkers.map((w) => w.id));
    const categories = new Set<string>();
    for (const worker of workers) {
      const id = worker.id || worker._id;
      if (teamWorkerIds.has(id) && worker.category) {
        categories.add(worker.category);
      }
    }
    if (categories.size === 0) {
      for (const worker of workers) {
        if (worker.category) categories.add(worker.category);
      }
    }
    if (categories.size === 0) {
      ['SKILLED_WORKER', 'UNSKILLED_WORKER', 'ENGINEER', 'SUPERVISOR', 'MASON', 'LABOUR'].forEach((c) => categories.add(c));
    }
    return Array.from(categories);
  }

  // Worker IDs on this project belonging to a given category.
  private workerIdsInCategory(category: string): string[] {
    const workers = this.allWorkers();
    const teamWorkerIds = new Set(this.assignableWorkers.map((w) => w.id));
    return workers
      .filter((w: any) => (teamWorkerIds.size === 0 || teamWorkerIds.has(w.id || w._id)) && w.category === category)
      .map((w: any) => w.id || w._id);
  }

  private loadTasks(): void {
    if (!this.project.id) return;

    this.loadingTasks.set(true);
    this.tasksError.set('');

    this.tasksService.getTasksForProject(this.project.id).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.rawTasks.set(list);
        this.loadingTasks.set(false);
      },
      error: (error) => {
        console.error('Failed to load project tasks', error);
        this.tasksError.set('Failed to load tasks for this project.');
        this.loadingTasks.set(false);
      },
    });
  }

  private loadTeamMembers(): void {
    if (!this.project.id) return;

    this.loadingTeam.set(true);
    this.teamError.set('');

    this.workforceService.getAllocations(this.project.id).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.teamAllocations.set(list);
        this.loadingTeam.set(false);
      },
      error: (error) => {
        console.error('Failed to load team members', error);
        this.teamError.set('Failed to load team allocations.');
        this.loadingTeam.set(false);
      },
    });

    this.workforceService.getWorkers().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.allWorkers.set(list);
      },
      error: (error) => console.error('Failed to load workers', error),
    });
  }

  get projectMilestones(): Milestone[] {
    return this.data.getMilestonesForProject(this.project.id);
  }

  get projectResources(): ResourceItem[] {
    return this.data.resources.filter((resource) => resource.allocatedProjectId === this.project.id);
  }

  get projectMaterials(): ResourceItem[] {
    return this.data.resources.filter(
      (resource) => resource.allocatedProjectId === this.project.id && resource.type === 'Material'
    );
  }

  get projectEquipment(): ResourceItem[] {
    return this.data.resources.filter(
      (resource) => resource.allocatedProjectId === this.project.id && resource.type !== 'Material'
    );
  }

  get availableInventory(): InventoryItem[] {
    return this.data.inventory.filter((item) => (item.stock ?? 0) > 0);
  }

  get selectedInventoryItem(): InventoryItem | undefined {
    const id = this.materialForm.get('inventoryItemId')?.value;
    return this.data.inventory.find((item) => item.id === id);
  }

  getInventoryStock(name: string): InventoryItem | undefined {
    return this.data.inventory.find((item) => item.itemName.toLowerCase() === (name || '').toLowerCase());
  }

  getEquipmentStock(name: string): ResourceItem | undefined {
    return this.data.resources.find(
      (r) =>
        r.type !== 'Material' &&
        (!r.allocatedProjectId || r.status === 'Available') &&
        r.name.toLowerCase() === (name || '').toLowerCase()
    );
  }

  get documents(): ProjectDocument[] {
    return this.data.getDocumentsForProject(this.project.id);
  }

  get availableResources(): ResourceItem[] {
    return this.data.resources.filter(
      (resource) => !resource.allocatedProjectId || resource.allocatedProjectId === this.project.id
    );
  }

  get availableEquipmentResources(): ResourceItem[] {
    return this.data.resources.filter(
      (resource) =>
        resource.type !== 'Material' &&
        (!resource.allocatedProjectId || resource.status === 'Available') &&
        (resource.quantity ?? 0) > 0
    );
  }

  get selectedEquipmentResource(): ResourceItem | undefined {
    const id = this.resourceForm.get('resourceId')?.value;
    return this.data.resources.find((item) => item.id === id);
  }

  get averageMilestoneProgress(): number {
    if (!this.projectMilestones.length) return 0;
    const total = this.projectMilestones.reduce((sum, milestone) => sum + milestone.progress, 0);
    return Math.round(total / this.projectMilestones.length);
  }

  readonly pageSize = 10;
  milestonePage = signal(1);
  taskPage = signal(1);
  materialPage = signal(1);
  equipmentPage = signal(1);
  documentPage = signal(1);

  // Milestone pagination
  get totalMilestonePages(): number {
    return Math.max(1, Math.ceil(this.projectMilestones.length / this.pageSize));
  }
  get milestonePagesList(): number[] {
    return Array.from({ length: this.totalMilestonePages }, (_, i) => i + 1);
  }
  get paginatedMilestones(): Milestone[] {
    const page = Math.min(this.milestonePage(), this.totalMilestonePages);
    const start = (page - 1) * this.pageSize;
    return this.projectMilestones.slice(start, start + this.pageSize);
  }
  get startMilestoneIndex(): number {
    if (this.projectMilestones.length === 0) return 0;
    const page = Math.min(this.milestonePage(), this.totalMilestonePages);
    return (page - 1) * this.pageSize + 1;
  }
  get endMilestoneIndex(): number {
    const page = Math.min(this.milestonePage(), this.totalMilestonePages);
    return Math.min(page * this.pageSize, this.projectMilestones.length);
  }

  // Tasks pagination
  get totalTaskPages(): number {
    return Math.max(1, Math.ceil(this.tasks().length / this.pageSize));
  }
  get taskPagesList(): number[] {
    return Array.from({ length: this.totalTaskPages }, (_, i) => i + 1);
  }
  get paginatedTasks(): (ProjectTask & { assignedWorkerId: string; assignedCategory: string })[] {
    const list = this.tasks();
    const page = Math.min(this.taskPage(), this.totalTaskPages);
    const start = (page - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }
  get startTaskIndex(): number {
    if (this.tasks().length === 0) return 0;
    const page = Math.min(this.taskPage(), this.totalTaskPages);
    return (page - 1) * this.pageSize + 1;
  }
  get endTaskIndex(): number {
    const page = Math.min(this.taskPage(), this.totalTaskPages);
    return Math.min(page * this.pageSize, this.tasks().length);
  }

  // Materials pagination
  get totalMaterialPages(): number {
    return Math.max(1, Math.ceil(this.projectMaterials.length / this.pageSize));
  }
  get materialPagesList(): number[] {
    return Array.from({ length: this.totalMaterialPages }, (_, i) => i + 1);
  }
  get paginatedMaterials(): ResourceItem[] {
    const page = Math.min(this.materialPage(), this.totalMaterialPages);
    const start = (page - 1) * this.pageSize;
    return this.projectMaterials.slice(start, start + this.pageSize);
  }
  get startMaterialIndex(): number {
    if (this.projectMaterials.length === 0) return 0;
    const page = Math.min(this.materialPage(), this.totalMaterialPages);
    return (page - 1) * this.pageSize + 1;
  }
  get endMaterialIndex(): number {
    const page = Math.min(this.materialPage(), this.totalMaterialPages);
    return Math.min(page * this.pageSize, this.projectMaterials.length);
  }

  // Equipment pagination
  get totalEquipmentPages(): number {
    return Math.max(1, Math.ceil(this.projectEquipment.length / this.pageSize));
  }
  get equipmentPagesList(): number[] {
    return Array.from({ length: this.totalEquipmentPages }, (_, i) => i + 1);
  }
  get paginatedEquipment(): ResourceItem[] {
    const page = Math.min(this.equipmentPage(), this.totalEquipmentPages);
    const start = (page - 1) * this.pageSize;
    return this.projectEquipment.slice(start, start + this.pageSize);
  }
  get startEquipmentIndex(): number {
    if (this.projectEquipment.length === 0) return 0;
    const page = Math.min(this.equipmentPage(), this.totalEquipmentPages);
    return (page - 1) * this.pageSize + 1;
  }
  get endEquipmentIndex(): number {
    const page = Math.min(this.equipmentPage(), this.totalEquipmentPages);
    return Math.min(page * this.pageSize, this.projectEquipment.length);
  }

  // Documents pagination
  get totalDocumentPages(): number {
    return Math.max(1, Math.ceil(this.documents.length / this.pageSize));
  }
  get documentPagesList(): number[] {
    return Array.from({ length: this.totalDocumentPages }, (_, i) => i + 1);
  }
  get paginatedDocuments(): ProjectDocument[] {
    const page = Math.min(this.documentPage(), this.totalDocumentPages);
    const start = (page - 1) * this.pageSize;
    return this.documents.slice(start, start + this.pageSize);
  }
  get startDocumentIndex(): number {
    if (this.documents.length === 0) return 0;
    const page = Math.min(this.documentPage(), this.totalDocumentPages);
    return (page - 1) * this.pageSize + 1;
  }
  get endDocumentIndex(): number {
    const page = Math.min(this.documentPage(), this.totalDocumentPages);
    return Math.min(page * this.pageSize, this.documents.length);
  }

  get reportStats() {
    const expense = this.projectResources.reduce((sum, resource) => sum + resource.quantity * 1000, 0);
    return [
      { label: 'Budget', value: `Rs ${(this.project.budget ?? 0).toLocaleString('en-IN')}` },
      { label: 'Estimated Expense', value: `Rs ${expense.toLocaleString('en-IN')}` },
      { label: 'Workers', value: String(this.teamMemberCount) },
      { label: 'Progress', value: `${this.project.progress}%` },
      { label: 'Status', value: this.project.status },
      { label: 'Milestone Progress', value: `${this.averageMilestoneProgress}%` },
    ];
  }

  openEdit(): void {
    const mgr = this.project.manager && this.project.manager.toLowerCase() === 'unassigned' ? 'Unassigned' : this.project.manager;
    this.loadManagers(mgr);
    this.form.reset({
      name: this.project.name,
      manager: mgr,
      category: this.project.category,
      status: this.project.status,
      startDate: this.toInputDate(this.project.startDate),
      endDate: this.toInputDate(this.project.endDate ?? ''),
      budget: this.project.budget ?? 0,
      client: this.project.client ?? '',
      location: this.project.location ?? '',
    });
    this.showEditModal.set(true);
  }

  closeEdit(): void {
    this.showEditModal.set(false);
  }

  submitEdit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const updated = {
      ...this.project,
      name: v.name!,
      manager: v.manager!,
      category: v.category as Project['category'],
      status: v.status as ProjectStatus,
      startDate: v.startDate!,
      endDate: v.endDate || undefined,
      budget: v.budget ?? 0,
      client: v.client || undefined,
      location: v.location || undefined,
      progress: v.status === 'Completed' ? 100 : this.project.progress,
    };
    Object.assign(this.project, updated);
    this.data.updateProject(updated);
    this.closeEdit();
  }

  openMilestone(milestone?: Milestone): void {
    this.editingMilestone.set(milestone ?? null);
    this.milestoneForm.reset({
      title: milestone?.title ?? '',
      dueDate: this.toInputDate(milestone?.dueDate ?? ''),
      status: milestone?.status ?? 'Not Started',
      progress: milestone?.progress ?? 0,
    });
    this.showMilestoneModal.set(true);
  }

  submitMilestone(): void {
    if (this.milestoneForm.invalid) {
      this.milestoneForm.markAllAsTouched();
      return;
    }
    const v = this.milestoneForm.getRawValue();
    const editing = this.editingMilestone();
    if (editing) {
      this.data.updateMilestone({
        ...editing,
        title: v.title!,
        dueDate: v.dueDate!,
        status: v.status as ProjectStatus,
        progress: Number(v.progress ?? 0),
      });
    } else {
      this.data.addMilestone({
        projectId: this.project.id,
        title: v.title!,
        dueDate: v.dueDate!,
        status: v.status as ProjectStatus,
        progress: Number(v.progress ?? 0),
      });
    }
    this.showMilestoneModal.set(false);
    this.updateProjectProgressFromMilestones();
  }

  deleteMilestone(milestone: Milestone): void {
    if (!confirm(`Delete ${milestone.title}?`)) return;
    this.data.deleteMilestone(milestone);
    this.updateProjectProgressFromMilestones();
  }

  openTask(task?: any): void {
    this.editingTask.set(task ?? null);
    const isCategory = Boolean(task?.assignedCategory);
    this.taskForm.reset({
      title: task?.title ?? '',
      assignMode: isCategory ? 'category' : 'single',
      assignedWorkerId: task?.assignedWorkerId ?? '',
      category: task?.assignedCategory ?? (this.assignableCategories[0] || ''),
      groupMode: 'shared',
      status: task?.status ?? 'Pending',
    });
    this.errorMessageTask = '';
    this.showTaskModal.set(true);
  }

  errorMessageTask = '';

  submitTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }
    const v = this.taskForm.getRawValue();
    const editing = this.editingTask();
    const backendStatus = v.status === 'Completed' ? 'completed' : 'pending';

    // -----------------------------------------------------
    // EDIT — single worker or category
    // -----------------------------------------------------
    if (editing?.id) {
      const payload: any = { title: v.title!, status: backendStatus };
      if (v.assignMode === 'single') {
        payload.assigned_worker_id = v.assignedWorkerId || null;
        payload.assigned_category = null;
      } else {
        const category = v.category || '';
        if (!category) {
          this.errorMessageTask = 'Please select a workforce category.';
          return;
        }
        payload.assigned_category = category;
        payload.assigned_worker_id = null;
      }
      this.tasksService.updateTask(editing.id, payload).subscribe({
        next: () => {
          this.showTaskModal.set(false);
          this.loadTasks();
        },
        error: (error: any) => {
          console.error('Failed to update task', error);
          this.errorMessageTask = 'Failed to update task.';
        },
      });
      return;
    }

    // -----------------------------------------------------
    // CREATE — single worker
    // -----------------------------------------------------
    if (v.assignMode === 'single') {
      const payload = {
        title: v.title!,
        project_id: this.project.id,
        assigned_worker_id: v.assignedWorkerId || undefined,
        status: backendStatus,
      };
      this.tasksService.createTask(payload).subscribe({
        next: () => {
          this.showTaskModal.set(false);
          this.loadTasks();
        },
        error: (error: any) => {
          console.error('Failed to create task', error);
          this.errorMessageTask = 'Failed to create task.';
        },
      });
      return;
    }

    // -----------------------------------------------------
    // CREATE — whole category
    // -----------------------------------------------------
    const category = v.category || '';
    const workerIds = this.workerIdsInCategory(category);

    if (!category || workerIds.length === 0) {
      this.errorMessageTask = 'No workers found in that category on this project.';
      return;
    }

    if (v.groupMode === 'shared') {
      // One task, shared by the whole category.
      const payload = {
        title: v.title!,
        project_id: this.project.id,
        assigned_category: category,
        notify_worker_ids: workerIds,
        status: backendStatus,
      };
      this.tasksService.createTask(payload).subscribe({
        next: () => {
          this.showTaskModal.set(false);
          this.loadTasks();
        },
        error: (error: any) => {
          console.error('Failed to create group task', error);
          this.errorMessageTask = 'Failed to create task.';
        },
      });
    } else {
      // One independent task per worker in the category.
      const creates = workerIds.map((workerId) =>
        this.tasksService.createTask({
          title: v.title!,
          project_id: this.project.id,
          assigned_worker_id: workerId,
          status: backendStatus,
        }),
      );
      forkJoin(creates).subscribe({
        next: () => {
          this.showTaskModal.set(false);
          this.loadTasks();
        },
        error: (error: any) => {
          console.error('Failed to create tasks for category', error);
          this.errorMessageTask = 'Failed to create tasks for one or more workers.';
        },
      });
    }
  }

  deleteTask(task: any): void {
    if (!task?.id) return;
    if (!confirm(`Delete ${task.title}?`)) return;

    this.tasksService.deleteTask(task.id).subscribe({
      next: () => this.loadTasks(),
      error: (error: any) => console.error('Failed to delete task', error),
    });
  }

  openResource(): void {
    const list = this.availableEquipmentResources;
    this.resourceMessage.set(list.length ? '' : 'No equipment is currently available in BuildTrack resources.');
    this.resourceForm.reset({ resourceId: list[0]?.id ?? '', quantity: 1 });
    this.showResourceModal.set(true);
  }

  submitResource(): void {
    if (this.resourceForm.invalid) {
      this.resourceForm.markAllAsTouched();
      return;
    }
    const val = this.resourceForm.getRawValue();
    const resource = this.data.resources.find((item) => item.id === val.resourceId);
    if (!resource) {
      this.resourceMessage.set('Selected equipment is not available.');
      return;
    }
    const qty = Number(val.quantity || 1);
    if (qty <= 0) {
      this.resourceMessage.set('Quantity must be greater than 0.');
      return;
    }
    if (qty > resource.quantity) {
      this.resourceMessage.set(
        `Insufficient resource available. Only ${resource.quantity} ${resource.unit} of ${resource.name} available in BuildTrack resources.`
      );
      return;
    }

    if (resource.quantity === qty) {
      // Allocate the entire item
      resource.allocatedProjectId = this.project.id;
      resource.status = 'In Use';
      this.data.updateResource(resource);
    } else {
      // Partial allocation
      resource.quantity -= qty;
      this.data.updateResource(resource);

      const existing = this.projectEquipment.find(
        (e) => e.name.toLowerCase() === resource.name.toLowerCase()
      );
      if (existing) {
        existing.quantity += qty;
        existing.status = 'In Use';
        this.data.updateResource(existing);
      } else {
        this.data.addResource({
          name: resource.name,
          type: resource.type,
          quantity: qty,
          unit: resource.unit,
          status: 'In Use',
          allocatedProjectId: this.project.id,
        });
      }
    }

    this.showResourceModal.set(false);
  }

  openReturnEquipment(resource: ResourceItem): void {
    this.returningEquipment.set(resource);
    this.returnEquipmentMessage.set('');
    this.returnEquipmentForm.reset({ returnQuantity: resource.quantity });
    this.showReturnEquipmentModal.set(true);
  }

  submitReturnEquipment(): void {
    if (this.returnEquipmentForm.invalid) {
      this.returnEquipmentForm.markAllAsTouched();
      return;
    }
    const resource = this.returningEquipment();
    if (!resource) return;

    const returnQty = Number(this.returnEquipmentForm.get('returnQuantity')?.value || 0);
    if (returnQty <= 0) {
      this.returnEquipmentMessage.set('Return quantity must be greater than 0.');
      return;
    }
    if (returnQty > resource.quantity) {
      this.returnEquipmentMessage.set(
        `Cannot return more than allocated (${resource.quantity} ${resource.unit}).`
      );
      return;
    }

    // Restore to available equipment pool
    const pool = this.data.resources.find(
      (r) => r.type !== 'Material' && (!r.allocatedProjectId || r.status === 'Available') && r.name.toLowerCase() === resource.name.toLowerCase()
    );
    if (pool) {
      pool.quantity += returnQty;
      pool.status = 'Available';
      this.data.updateResource(pool);
    } else {
      this.data.addResource({
        name: resource.name,
        type: resource.type,
        quantity: returnQty,
        unit: resource.unit,
        status: 'Available',
      });
    }

    // Deduct or remove allocated resource
    if (returnQty === resource.quantity) {
      this.data.deleteResource(resource);
    } else {
      resource.quantity -= returnQty;
      this.data.updateResource(resource);
    }

    this.showReturnEquipmentModal.set(false);
  }

  removeResource(resource: ResourceItem): void {
    this.openReturnEquipment(resource);
  }

  openMaterial(): void {
    const list = this.availableInventory;
    this.materialMessage.set(list.length ? '' : 'No inventory materials are currently in stock.');
    this.materialForm.reset({ inventoryItemId: list[0]?.id ?? '', quantity: 1 });
    this.showMaterialModal.set(true);
  }

  submitMaterial(): void {
    if (this.materialForm.invalid) {
      this.materialForm.markAllAsTouched();
      return;
    }
    const val = this.materialForm.getRawValue();
    const item = this.data.inventory.find((i) => i.id === val.inventoryItemId);
    if (!item) {
      this.materialMessage.set('Selected inventory item is not found.');
      return;
    }
    const qty = Number(val.quantity || 1);
    if (qty <= 0) {
      this.materialMessage.set('Quantity must be greater than 0.');
      return;
    }
    if (qty > item.stock) {
      this.materialMessage.set(`Insufficient stock. Only ${item.stock} ${item.unit} available in inventory.`);
      return;
    }

    // Deduct quantity from BuildTrack inventory stock
    item.stock -= qty;
    item.status = item.stock <= 0 ? 'Out of Stock' : (item.stock <= 10 ? 'Low Stock' : 'In Stock');
    this.data.updateInventoryItem(item);

    // Check if material already allocated to this project
    const existing = this.projectMaterials.find(
      (m) => m.name.toLowerCase() === item.itemName.toLowerCase()
    );
    if (existing) {
      existing.quantity += qty;
      existing.status = 'In Use';
      this.data.updateResource(existing);
    } else {
      this.data.addResource({
        name: item.itemName,
        type: 'Material',
        quantity: qty,
        unit: item.unit,
        status: 'In Use',
        allocatedProjectId: this.project.id,
      });
    }

    this.showMaterialModal.set(false);
  }

  openReturnMaterial(material: ResourceItem): void {
    this.returningMaterial.set(material);
    this.returnMaterialMessage.set('');
    this.returnMaterialForm.reset({ returnQuantity: material.quantity });
    this.showReturnMaterialModal.set(true);
  }

  submitReturnMaterial(): void {
    if (this.returnMaterialForm.invalid) {
      this.returnMaterialForm.markAllAsTouched();
      return;
    }
    const material = this.returningMaterial();
    if (!material) return;

    const returnQty = Number(this.returnMaterialForm.get('returnQuantity')?.value || 0);
    if (returnQty <= 0) {
      this.returnMaterialMessage.set('Return quantity must be greater than 0.');
      return;
    }
    if (returnQty > material.quantity) {
      this.returnMaterialMessage.set(
        `Cannot return more than allocated (${material.quantity} ${material.unit}).`
      );
      return;
    }

    // Restore stock back to BuildTrack inventory
    const item = this.getInventoryStock(material.name);
    if (item) {
      item.stock += returnQty;
      item.status = item.stock > 10 ? 'In Stock' : 'Low Stock';
      this.data.updateInventoryItem(item);
    }

    // Deduct or remove allocated material
    if (returnQty === material.quantity) {
      this.data.deleteResource(material);
    } else {
      material.quantity -= returnQty;
      this.data.updateResource(material);
    }

    this.showReturnMaterialModal.set(false);
  }

  removeMaterial(material: ResourceItem): void {
    this.openReturnMaterial(material);
  }

  onDocumentSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.selectedDocumentName.set(file?.name ?? '');
    this.selectedDocumentType.set(file?.type || file?.name.split('.').pop()?.toUpperCase() || 'Document');
  }

  submitDocument(): void {
    if (!this.selectedDocumentName()) return;
    this.data.addProjectDocument({
      projectId: this.project.id,
      name: this.selectedDocumentName(),
      type: this.selectedDocumentType(),
      uploadedAt: new Date().toLocaleDateString(),
    });
    this.selectedDocumentName.set('');
    this.selectedDocumentType.set('');
    this.showDocumentModal.set(false);
  }

  deleteDocument(doc: ProjectDocument): void {
    if (!confirm(`Delete ${doc.name}?`)) return;
    this.data.deleteProjectDocument(doc);
  }

  milestoneStatusClass(status: string): string {
    switch (status) {
      case 'Completed': return 'badge-green';
      case 'In Progress': return 'badge-blue';
      case 'Not Started': return 'badge-gray';
      default: return 'badge-amber';
    }
  }

  taskStatusClass(status: string): string {
    return status === 'Completed' ? 'badge-green' : 'badge-amber';
  }

  private updateProjectProgressFromMilestones(): void {
    this.project.progress = this.averageMilestoneProgress;
    this.data.updateProject(this.project);
  }

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
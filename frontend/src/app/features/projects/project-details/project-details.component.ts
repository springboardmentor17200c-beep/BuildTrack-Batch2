import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MockDataService } from '../../../core/services/mock-data.service';
import { WorkforceService } from '../../../core/services/workforce.service';
import { TasksService } from '../../../core/services/tasks.service';
import { AuthService } from '../../../core/services/auth.service';
import { Milestone, Project, ProjectDocument, ProjectStatus, ProjectTask, ResourceItem } from '../../../core/models/models';

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
  showDocumentModal = signal(false);
  resourceMessage = signal('');
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

  get teamMemberCount(): number {
    return this.groupedTeam().reduce((sum, group) => sum + group.members.length, 0);
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
  });

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
    return Array.from(categories);
  }

  // Worker IDs on this project belonging to a given category.
  private workerIdsInCategory(category: string): string[] {
    const workers = this.allWorkers();
    const teamWorkerIds = new Set(this.assignableWorkers.map((w) => w.id));
    return workers
      .filter((w: any) => teamWorkerIds.has(w.id || w._id) && w.category === category)
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

    // GET /workforce/allocations/project/{id} — the only allocations-by-project
    // endpoint the backend exposes (see WorkforceService.getAllocations).
    this.workforceService.getAllocations(this.project.id).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.teamAllocations.set(list);
        this.loadingTeam.set(false);
      },
      error: (error) => {
        console.error('Failed to load project team', error);
        this.teamError.set('Failed to load team members for this project.');
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

  get documents(): ProjectDocument[] {
    return this.data.getDocumentsForProject(this.project.id);
  }

  get availableResources(): ResourceItem[] {
    return this.data.resources.filter((resource) => !resource.allocatedProjectId || resource.allocatedProjectId === this.project.id);
  }

  get averageMilestoneProgress(): number {
    if (!this.projectMilestones.length) return 0;
    const total = this.projectMilestones.reduce((sum, milestone) => sum + milestone.progress, 0);
    return Math.round(total / this.projectMilestones.length);
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
    this.form.reset({
      name: this.project.name,
      manager: this.project.manager,
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
    this.taskForm.reset({
      title: task?.title ?? '',
      assignMode: task?.assignedCategory ? 'category' : 'single',
      assignedWorkerId: task?.assignedWorkerId ?? '',
      category: task?.assignedCategory ?? '',
      groupMode: 'individual',
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
    // EDIT — single-worker reassignment only (editing a shared
    // category task keeps its original category unless you switch
    // this task to a single worker instead).
    // -----------------------------------------------------
    if (editing?.id) {
      const payload: any = { title: v.title!, status: backendStatus };
      if (v.assignMode === 'single') {
        payload.assigned_worker_id = v.assignedWorkerId || undefined;
        payload.assigned_category = undefined;
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
    this.resourceMessage.set(this.availableResources.length ? '' : 'No resource is available in BuildTrack resources.');
    this.resourceForm.reset({ resourceId: this.availableResources[0]?.id ?? '' });
    this.showResourceModal.set(true);
  }

  submitResource(): void {
    if (this.resourceForm.invalid) {
      this.resourceForm.markAllAsTouched();
      return;
    }
    const resource = this.data.resources.find((item) => item.id === this.resourceForm.value.resourceId);
    if (!resource) {
      this.resourceMessage.set('Selected resource is not available.');
      return;
    }
    resource.allocatedProjectId = this.project.id;
    resource.status = 'In Use';
    this.data.updateResource(resource);
    this.showResourceModal.set(false);
  }

  removeResource(resource: ResourceItem): void {
    resource.allocatedProjectId = undefined;
    resource.status = 'Available';
    this.data.updateResource(resource);
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

  private toInputDate(value: string): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }
}
import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Milestone, Project, ProjectDocument, ProjectStatus, ProjectTask, ResourceItem, Worker } from '../../../core/models/models';

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
  editingTask = signal<ProjectTask | null>(null);

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
    owner: [''],
    status: ['Pending' as ProjectTask['status'], Validators.required],
  });

  resourceForm = this.fb.group({
    resourceId: ['', Validators.required],
  });

  constructor(
    private route: ActivatedRoute,
    public data: MockDataService,
  ) {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.project = this.data.getProjectById(id) ?? this.data.projects[0] ?? this.project;
  }

  get projectMilestones(): Milestone[] {
    return this.data.getMilestonesForProject(this.project.id);
  }

  get projectResources(): ResourceItem[] {
    return this.data.resources.filter((resource) => resource.allocatedProjectId === this.project.id);
  }

  get tasks(): ProjectTask[] {
    return this.data.getTasksForProject(this.project.id);
  }

  get documents(): ProjectDocument[] {
    return this.data.getDocumentsForProject(this.project.id);
  }

  get availableResources(): ResourceItem[] {
    return this.data.resources.filter((resource) => !resource.allocatedProjectId || resource.allocatedProjectId === this.project.id);
  }

  get projectWorkers(): Worker[] {
    return this.data.workers.filter((worker) => worker.assignedProjectId === this.project.id);
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
      { label: 'Workers', value: String(this.projectWorkers.length) },
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

  openTask(task?: ProjectTask): void {
    this.editingTask.set(task ?? null);
    this.taskForm.reset({
      title: task?.title ?? '',
      owner: task?.owner ?? '',
      status: task?.status ?? 'Pending',
    });
    this.showTaskModal.set(true);
  }

  submitTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }
    const v = this.taskForm.getRawValue();
    const editing = this.editingTask();
    if (editing) {
      this.data.updateProjectTask({ ...editing, title: v.title!, owner: v.owner ?? '', status: v.status! });
    } else {
      this.data.addProjectTask({ projectId: this.project.id, title: v.title!, owner: v.owner ?? '', status: v.status! });
    }
    this.showTaskModal.set(false);
  }

  deleteTask(task: ProjectTask): void {
    if (!confirm(`Delete ${task.title}?`)) return;
    this.data.deleteProjectTask(task);
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

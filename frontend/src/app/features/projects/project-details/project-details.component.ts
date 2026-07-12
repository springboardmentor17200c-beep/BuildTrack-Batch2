import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Milestone, Project, ProjectStatus } from '../../../core/models/models';

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
  projectMilestones: Milestone[] = [];
  showEditModal = signal(false);

  form = this.fb.group({
    name: ['', Validators.required],
    manager: ['', Validators.required],
    category: ['Commercial' as Project['category'], Validators.required],
    status: ['Not Started' as ProjectStatus, Validators.required],
    startDate: ['', Validators.required],
    budget: [0, [Validators.required, Validators.min(0)]],
  });

  constructor(
    private route: ActivatedRoute,
    public data: MockDataService,
  ) {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.project = this.data.getProjectById(id) ?? this.data.projects[0] ?? this.project;
    this.projectMilestones = this.data.getMilestonesForProject(this.project.id);
  }

  openEdit(): void {
    this.form.reset({
      name: this.project.name,
      manager: this.project.manager,
      category: this.project.category,
      status: this.project.status,
      startDate: this.toInputDate(this.project.startDate),
      budget: this.project.budget ?? 0,
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
      budget: v.budget ?? 0,
      progress: v.status === 'Completed' ? 100 : this.project.progress,
    };
    Object.assign(this.project, updated);
    this.data.updateProject(updated);
    this.closeEdit();
  }

  milestoneStatusClass(status: string): string {
    switch (status) {
      case 'Completed':
        return 'badge-green';
      case 'In Progress':
        return 'badge-blue';
      case 'Not Started':
        return 'badge-gray';
      default:
        return 'badge-amber';
    }
  }

  private toInputDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }
}

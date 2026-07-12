import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Project, ProjectStatus } from '../../../core/models/models';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './project-list.component.html',
  styleUrl: './project-list.component.scss',
})
export class ProjectListComponent {
  private fb = new FormBuilder();

  searchTerm = signal('');
  showAddModal = signal(false);
  editingProject = signal<Project | null>(null);

  /** Plain getter (not computed()) so it re-evaluates after addProject() mutates the array. */
  get filteredProjects() {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.data.projects;
    if (!term) return list;
    return list.filter(
      (p) => p.name.toLowerCase().includes(term) || p.manager.toLowerCase().includes(term),
    );
  }

  form = this.fb.group({
    name: ['', Validators.required],
    manager: ['', Validators.required],
    category: ['Commercial' as Project['category'], Validators.required],
    status: ['Not Started' as ProjectStatus, Validators.required],
    startDate: ['', Validators.required],
    budget: [0, [Validators.required, Validators.min(0)]],
  });

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
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
    this.editingProject.set(null);
    this.form.reset({ category: 'Commercial', status: 'Not Started', startDate: this.today(), budget: 0 });
    this.showAddModal.set(true);
  }

  openEdit(project: Project): void {
    this.editingProject.set(project);
    this.form.reset({
      name: project.name,
      manager: project.manager,
      category: project.category,
      status: project.status,
      startDate: this.toInputDate(project.startDate),
      budget: project.budget ?? 0,
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
      budget: v.budget ?? 0,
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
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }
}

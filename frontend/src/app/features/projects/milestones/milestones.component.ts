import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { MockDataService } from '../../../core/services/mock-data.service';
import { Project } from '../../../core/models/models';

@Component({
  selector: 'app-milestones',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Projects / Milestones</p>
          <h1>Milestone Tracking</h1>
        </div>
        <a routerLink="/projects/status-dashboard" class="btn btn-outline">
          <i class="fa-solid fa-chart-simple"></i> Status Dashboard
        </a>
      </div>

      <div class="stat-grid">
        <div class="stat-card" *ngFor="let item of summary">
          <div class="stat-card__label">{{ item.label }}</div>
          <div class="stat-card__value">{{ item.value }}</div>
          <div class="stat-card__delta" [ngClass]="item.className">{{ item.note }}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Project Milestone Plan</h3>
          <a routerLink="/projects">Back to projects</a>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Milestone</th>
                <th>Project</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Progress</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let milestone of paginatedMilestones">
                <td>
                  <div class="cell-title">{{ milestone.title }}</div>
                  <div class="cell-sub">{{ milestone.owner }}</div>
                </td>
                <td>{{ milestone.project }}</td>
                <td>{{ milestone.dueDate || 'Not set' }}</td>
                <td><span class="badge" [ngClass]="statusBadgeClass(milestone.status)">{{ milestone.status }}</span></td>
                <td>
                  <div class="progress-row">
                    <div class="progress-mini"><span [style.width.%]="milestone.progress"></span></div>
                    {{ milestone.progress }}%
                  </div>
                </td>
              </tr>
              <tr *ngIf="milestoneRows.length === 0">
                <td colspan="5" class="empty">Create projects to start tracking milestones.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar" *ngIf="milestoneRows.length > 0">
          <span>Showing {{ startItemIndex }}-{{ endItemIndex }} of {{ milestoneRows.length }} milestones</span>
          <div class="pagination" *ngIf="totalPages > 1">
            <button [disabled]="currentPage() === 1" (click)="currentPage.set(currentPage() - 1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button *ngFor="let p of pagesList" [class.active]="currentPage() === p" (click)="currentPage.set(p)">{{ p }}</button>
            <button [disabled]="currentPage() === totalPages" (click)="currentPage.set(currentPage() + 1)"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .empty { text-align: center; color: var(--muted); padding: 28px; }
  `],
})
export class MilestonesComponent {
  private readonly auth = inject(AuthService);
  constructor(public data: MockDataService) {}

  readonly pageSize = 10;
  currentPage = signal(1);

  get visibleProjects(): Project[] {
    const user = this.auth.currentUser();
    if (user?.role === 'Client') {
      const email = (user.email || '').trim().toLowerCase();
      return this.data.projects.filter(
        (p) =>
          (p.clientEmail && p.clientEmail.trim().toLowerCase() === email) ||
          (p.client && p.client.trim().toLowerCase() === email),
      );
    }
    return this.data.projects;
  }

  get milestoneRows() {
    const visibleProjIds = new Set(this.visibleProjects.map((p) => p.id));
    const stored = this.data.milestones
      .filter((milestone) => visibleProjIds.has(milestone.projectId))
      .map((milestone) => {
        const project = this.data.getProjectById(milestone.projectId);
        return {
          title: milestone.title,
          project: project?.name ?? 'Unassigned Project',
          dueDate: milestone.dueDate,
          status: milestone.status,
          progress: milestone.progress,
          owner: project?.manager ?? 'Project team',
        };
      });

    if (stored.length) return stored;

    return this.visibleProjects.flatMap((project) => [
      {
        title: 'Site readiness',
        project: project.name,
        dueDate: project.startDate,
        status: project.progress > 15 ? 'Completed' : project.status,
        progress: Math.min(100, Math.max(project.progress, 25)),
        owner: project.manager,
      },
      {
        title: 'Execution checkpoint',
        project: project.name,
        dueDate: project.endDate ?? project.startDate,
        status: project.status,
        progress: project.progress,
        owner: project.manager,
      },
    ]);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.milestoneRows.length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedMilestones() {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.milestoneRows.slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.milestoneRows.length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.milestoneRows.length);
  }

  get summary() {
    const rows = this.milestoneRows;
    const completed = rows.filter((row) => row.status === 'Completed').length;
    const delayed = rows.filter((row) => row.status === 'On Hold').length;
    return [
      { label: 'Total Milestones', value: String(rows.length), note: 'Across all projects', className: 'up' },
      { label: 'Completed', value: String(completed), note: 'Closed checkpoints', className: 'up' },
      { label: 'In Progress', value: String(rows.filter((row) => row.status === 'In Progress').length), note: 'Active work', className: 'up' },
      { label: 'Delayed', value: String(delayed), note: 'Needs review', className: delayed ? 'down' : 'up' },
    ];
  }

  statusBadgeClass(status: string): string {
    if (status === 'Completed') return 'badge-green';
    if (status === 'In Progress') return 'badge-blue';
    if (status === 'On Hold') return 'badge-amber';
    return 'badge-gray';
  }
}

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

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
              <tr *ngFor="let milestone of milestoneRows">
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
      </div>
    </div>
  `,
  styles: [`
    .empty { text-align: center; color: var(--muted); padding: 28px; }
  `],
})
export class MilestonesComponent {
  constructor(public data: MockDataService) {}

  get milestoneRows() {
    const stored = this.data.milestones.map((milestone) => {
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

    return this.data.projects.flatMap((project) => [
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

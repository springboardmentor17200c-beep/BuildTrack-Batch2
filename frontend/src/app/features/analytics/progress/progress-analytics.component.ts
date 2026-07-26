import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-progress-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Analytics / Progress</p>
          <h1>Project Progress Dashboard</h1>
        </div>
        <a routerLink="/projects/status-dashboard" class="btn btn-outline">
          <i class="fa-solid fa-diagram-project"></i> Status
        </a>
      </div>

      <div class="stat-grid">
        <div class="stat-card" *ngFor="let metric of metrics">
          <div class="stat-card__label">{{ metric.label }}</div>
          <div class="stat-card__value">{{ metric.value }}</div>
          <div class="stat-card__delta" [ngClass]="metric.className">{{ metric.note }}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Progress Ranking</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th><th>Manager</th></tr></thead>
            <tbody>
              <tr *ngFor="let project of rankedProjects">
                <td><a [routerLink]="['/projects', project.id]" class="cell-title">{{ project.name }}</a></td>
                <td><span class="badge" [ngClass]="statusClass(project.status)">{{ project.status }}</span></td>
                <td><div class="progress-row"><div class="progress-mini"><span [style.width.%]="project.progress"></span></div>{{ project.progress }}%</div></td>
                <td>{{ project.manager }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ProgressAnalyticsComponent {
  constructor(public data: MockDataService) {}

  get averageProgress(): number {
    if (!this.data.projects.length) return 0;
    return Math.round(this.data.projects.reduce((sum, project) => sum + project.progress, 0) / this.data.projects.length);
  }

  get metrics() {
    return [
      { label: 'Average Progress', value: `${this.averageProgress}%`, note: 'Across active portfolio', className: 'up' },
      { label: 'Completed', value: String(this.data.projects.filter((project) => project.status === 'Completed').length), note: 'Delivered projects', className: 'up' },
      { label: 'At Risk', value: String(this.data.projects.filter((project) => project.status === 'On Hold').length), note: 'Needs intervention', className: this.data.projects.some((project) => project.status === 'On Hold') ? 'down' : 'up' },
      { label: 'Milestones', value: String(Math.max(this.data.milestones.length, this.data.projects.length * 2)), note: 'Tracked checkpoints', className: 'up' },
    ];
  }

  get rankedProjects() {
    return [...this.data.projects].sort((a, b) => b.progress - a.progress);
  }

  statusClass(status: string): string {
    if (status === 'Completed') return 'badge-green';
    if (status === 'In Progress') return 'badge-blue';
    if (status === 'On Hold') return 'badge-amber';
    return 'badge-gray';
  }
}

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';
import { ProjectStatus } from '../../../core/models/models';

@Component({
  selector: 'app-project-status-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Projects / Status</p>
          <h1>Project Status Dashboard</h1>
        </div>
        <a routerLink="/projects/milestones" class="btn btn-outline">
          <i class="fa-solid fa-list-check"></i> Milestones
        </a>
      </div>

      <div class="status-grid">
        <section class="panel status-card" *ngFor="let group of statusGroups">
          <div class="panel-header">
            <h3>{{ group.status }}</h3>
            <span class="badge" [ngClass]="statusBadgeClass(group.status)">{{ group.projects.length }}</span>
          </div>
          <div class="status-list">
            <a *ngFor="let project of group.projects" [routerLink]="['/projects', project.id]" class="status-item">
              <div>
                <strong>{{ project.name }}</strong>
                <span>{{ project.manager }} · {{ project.startDate }}</span>
              </div>
              <div class="progress-row">
                <div class="progress-mini"><span [style.width.%]="project.progress"></span></div>
                {{ project.progress }}%
              </div>
            </a>
            <p class="empty" *ngIf="group.projects.length === 0">No projects in this status.</p>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
    .status-card { min-height: 230px; }
    .status-list { padding: 10px 16px 18px; display: grid; gap: 10px; }
    .status-item { display: flex; justify-content: space-between; gap: 16px; align-items: center; border: 1px solid var(--border); border-radius: 12px; padding: 12px; color: inherit; }
    .status-item strong { display: block; font-size: 13.5px; }
    .status-item span { display: block; color: var(--muted); font-size: 12px; margin-top: 3px; }
    .empty { color: var(--muted); font-size: 13px; margin: 8px 0; }
    @media (max-width: 900px) { .status-grid { grid-template-columns: 1fr; } }
  `],
})
export class ProjectStatusDashboardComponent {
  statuses: ProjectStatus[] = ['In Progress', 'On Hold', 'Not Started', 'Completed'];

  constructor(public data: MockDataService) {}

  get statusGroups() {
    return this.statuses.map((status) => ({
      status,
      projects: this.data.projects.filter((project) => project.status === status),
    }));
  }

  statusBadgeClass(status: string): string {
    if (status === 'Completed') return 'badge-green';
    if (status === 'In Progress') return 'badge-blue';
    if (status === 'On Hold') return 'badge-amber';
    return 'badge-gray';
  }
}

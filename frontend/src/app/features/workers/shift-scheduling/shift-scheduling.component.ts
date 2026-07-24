import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-shift-scheduling',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Workforce / Shifts</p>
          <h1>Shift Scheduling</h1>
        </div>
        <a routerLink="/attendance" class="btn btn-outline">
          <i class="fa-solid fa-clock"></i> Attendance
        </a>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Weekly Shift Board</h3>
          <a routerLink="/workers">Worker management</a>
        </div>
        <div class="shift-grid">
          <div class="shift-card" *ngFor="let shift of shifts">
            <span class="badge badge-blue">{{ shift.window }}</span>
            <h3>{{ shift.worker }}</h3>
            <p>{{ shift.role }}</p>
            <div class="cell-sub">{{ shift.project }}</div>
          </div>
          <p class="empty" *ngIf="shifts.length === 0">Add workers to prepare shift schedules.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shift-grid { padding: 18px 20px 22px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
    .shift-card { border: 1px solid var(--border); border-radius: 14px; padding: 16px; background: #fff; }
    .shift-card h3 { font-size: 15px; margin: 12px 0 4px; }
    .shift-card p { color: var(--slate); margin: 0 0 10px; font-size: 13px; }
    .empty { color: var(--muted); }
    @media (max-width: 1000px) { .shift-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .shift-grid { grid-template-columns: 1fr; } }
  `],
})
export class ShiftSchedulingComponent {
  windows = ['Morning · 7 AM - 3 PM', 'General · 9 AM - 6 PM', 'Evening · 3 PM - 11 PM'];

  constructor(public data: MockDataService) {}

  get shifts() {
    return this.data.workers.slice(0, 12).map((worker, index) => ({
      worker: worker.name,
      role: worker.skillType || worker.role,
      window: this.windows[index % this.windows.length],
      project: this.data.getProjectById(worker.assignedProjectId ?? '')?.name ?? 'Unassigned project',
    }));
  }
}

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-resource-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Analytics / Resources</p>
          <h1>Resource Analytics Dashboard</h1>
        </div>
        <a routerLink="/resources/utilization" class="btn btn-outline">
          <i class="fa-solid fa-gauge-high"></i> Utilization
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
        <div class="panel-header"><h3>Resource Mix</h3></div>
        <div class="mix-grid">
          <div class="mix-card" *ngFor="let row of mix">
            <i class="fa-solid" [ngClass]="row.icon"></i>
            <strong>{{ row.count }}</strong>
            <span>{{ row.type }}</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mix-grid { padding: 18px 20px 22px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .mix-card { border: 1px solid var(--border); border-radius: 14px; padding: 18px; text-align: center; }
    .mix-card i { color: var(--blue); font-size: 24px; }
    .mix-card strong { display: block; font-size: 28px; margin-top: 12px; }
    .mix-card span { color: var(--muted); font-size: 13px; }
    @media (max-width: 700px) { .mix-grid { grid-template-columns: 1fr; } }
  `],
})
export class ResourceAnalyticsComponent {
  constructor(public data: MockDataService) {}

  get metrics() {
    const total = this.data.resources.length;
    const used = this.data.resources.filter((resource) => resource.status === 'In Use').length;
    const available = this.data.resources.filter((resource) => resource.status === 'Available').length;
    const utilization = total ? Math.round((used / total) * 100) : 0;
    return [
      { label: 'Total Resources', value: String(total), note: 'Assets and materials', className: 'up' },
      { label: 'Utilization', value: `${utilization}%`, note: 'Currently in use', className: 'up' },
      { label: 'Available', value: String(available), note: 'Ready capacity', className: 'up' },
      { label: 'Maintenance', value: String(this.data.resources.filter((resource) => resource.status === 'Under Maintenance').length), note: 'Service queue', className: 'down' },
    ];
  }

  get mix() {
    return [
      { type: 'Equipment', icon: 'fa-screwdriver-wrench', count: this.data.resources.filter((resource) => resource.type === 'Equipment').length },
      { type: 'Vehicles', icon: 'fa-truck', count: this.data.resources.filter((resource) => resource.type === 'Vehicle').length },
      { type: 'Materials', icon: 'fa-boxes-stacked', count: this.data.resources.filter((resource) => resource.type === 'Material').length },
    ];
  }
}

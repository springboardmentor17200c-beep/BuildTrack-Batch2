import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-resource-utilization-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Resources / Utilization</p>
          <h1>Resource Utilization Dashboard</h1>
        </div>
        <a routerLink="/resources/equipment" class="btn btn-outline">
          <i class="fa-solid fa-truck"></i> Equipment
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
        <div class="panel-header">
          <h3>Utilization by Resource Type</h3>
          <a routerLink="/resources">Manage resources</a>
        </div>
        <div class="utilization-list">
          <div class="utilization-row" *ngFor="let row of utilizationByType">
            <div>
              <strong>{{ row.type }}</strong>
              <span>{{ row.used }} in use of {{ row.total }} total</span>
            </div>
            <div class="progress-row">
              <div class="progress-mini wide"><span [style.width.%]="row.percent"></span></div>
              {{ row.percent }}%
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .utilization-list { padding: 16px 20px 22px; display: grid; gap: 14px; }
    .utilization-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid var(--border); border-radius: 12px; }
    .utilization-row strong, .utilization-row span { display: block; }
    .utilization-row span { color: var(--muted); font-size: 12.5px; margin-top: 3px; }
    .wide { width: 180px; }
    @media (max-width: 700px) { .utilization-row { align-items: flex-start; flex-direction: column; } }
  `],
})
export class ResourceUtilizationDashboardComponent {
  constructor(public data: MockDataService) {}

  get inUseCount(): number {
    return this.data.resources.filter((resource) => resource.status === 'In Use').length;
  }

  get metrics() {
    const total = this.data.resources.length;
    const available = this.data.resources.filter((resource) => resource.status === 'Available').length;
    const maintenance = this.data.resources.filter((resource) => resource.status === 'Under Maintenance').length;
    const utilization = total ? Math.round((this.inUseCount / total) * 100) : 0;
    return [
      { label: 'Total Resources', value: String(total), note: 'Tracked assets', className: 'up' },
      { label: 'In Use', value: String(this.inUseCount), note: `${utilization}% utilized`, className: 'up' },
      { label: 'Available', value: String(available), note: 'Ready to allocate', className: 'up' },
      { label: 'Maintenance', value: String(maintenance), note: 'Needs service', className: maintenance ? 'down' : 'up' },
    ];
  }

  get utilizationByType() {
    const types = ['Equipment', 'Vehicle', 'Material'] as const;
    return types.map((type) => {
      const items = this.data.resources.filter((resource) => resource.type === type);
      const used = items.filter((resource) => resource.status === 'In Use').length;
      return {
        type,
        total: items.length,
        used,
        percent: items.length ? Math.round((used / items.length) * 100) : 0,
      };
    });
  }
}

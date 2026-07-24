import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-budget-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Analytics / Budget</p>
          <h1>Budget Analytics Dashboard</h1>
        </div>
        <a routerLink="/reports" class="btn btn-outline"><i class="fa-solid fa-file-lines"></i> Reports</a>
      </div>

      <div class="stat-grid">
        <div class="stat-card" *ngFor="let metric of metrics">
          <div class="stat-card__label">{{ metric.label }}</div>
          <div class="stat-card__value">{{ metric.value }}</div>
          <div class="stat-card__delta" [ngClass]="metric.className">{{ metric.note }}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header"><h3>Budget by Project</h3></div>
        <div class="analytics-bars">
          <div class="bar-row" *ngFor="let project of budgetRows">
            <div>
              <strong>{{ project.name }}</strong>
              <span>Rs {{ project.budget.toLocaleString('en-IN') }}</span>
            </div>
            <div class="bar-track"><span [style.width.%]="project.percent"></span></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-bars { padding: 18px 20px 22px; display: grid; gap: 14px; }
    .bar-row { display: grid; grid-template-columns: 220px 1fr; gap: 18px; align-items: center; }
    .bar-row strong, .bar-row span { display: block; }
    .bar-row span { color: var(--muted); font-size: 12.5px; margin-top: 3px; }
    .bar-track { height: 12px; background: #edf2f8; border-radius: 20px; overflow: hidden; }
    .bar-track span { display: block; height: 100%; background: linear-gradient(90deg, var(--blue), var(--green)); border-radius: 20px; }
    @media (max-width: 700px) { .bar-row { grid-template-columns: 1fr; gap: 8px; } }
  `],
})
export class BudgetAnalyticsComponent {
  constructor(public data: MockDataService) {}

  get totalBudget(): number {
    return this.data.projects.reduce((sum, project) => sum + (project.budget ?? 0), 0);
  }

  get totalProcurement(): number {
    return this.data.purchaseOrders.reduce((sum, order) => sum + order.amount, 0);
  }

  get metrics() {
    const variance = this.totalBudget - this.totalProcurement;
    return [
      { label: 'Project Budget', value: `Rs ${this.totalBudget.toLocaleString('en-IN')}`, note: 'Approved allocation', className: 'up' },
      { label: 'Procurement Spend', value: `Rs ${this.totalProcurement.toLocaleString('en-IN')}`, note: 'Open purchase orders', className: 'up' },
      { label: 'Remaining', value: `Rs ${variance.toLocaleString('en-IN')}`, note: variance >= 0 ? 'Within budget' : 'Over budget', className: variance >= 0 ? 'up' : 'down' },
      { label: 'Projects', value: String(this.data.projects.length), note: 'Budget owners', className: 'up' },
    ];
  }

  get budgetRows() {
    const max = Math.max(...this.data.projects.map((project) => project.budget ?? 0), 1);
    return this.data.projects.map((project) => ({
      name: project.name,
      budget: project.budget ?? 0,
      percent: Math.round(((project.budget ?? 0) / max) * 100),
    }));
  }
}

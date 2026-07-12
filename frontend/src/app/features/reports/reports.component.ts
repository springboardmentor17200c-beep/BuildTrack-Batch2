import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  constructor(
    public data: MockDataService,
    private http: HttpClient,
  ) {}

  get summary() {
    return [
      { label: 'Total Projects', value: String(this.data.projects.length) },
      { label: 'Completed', value: String(this.data.projects.filter((project) => project.status === 'Completed').length) },
      { label: 'In Progress', value: String(this.data.projects.filter((project) => project.status === 'In Progress').length) },
      { label: 'On Hold', value: String(this.data.projects.filter((project) => project.status === 'On Hold').length) },
    ];
  }

  get reportDateRange(): string {
    return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  get averageProgress(): number {
    if (!this.data.projects.length) return 0;
    return Math.round(this.data.projects.reduce((sum, project) => sum + project.progress, 0) / this.data.projects.length);
  }

  get totalBudget(): number {
    return this.data.projects.reduce((sum, project) => sum + (project.budget ?? 0), 0);
  }

  get totalExpense(): number {
    return this.data.purchaseOrders.reduce((sum, order) => sum + order.amount, 0);
  }

  get budgetBarWidth(): number {
    const max = Math.max(this.totalBudget, this.totalExpense, 1);
    return Math.round((this.totalBudget / max) * 100);
  }

  get expenseBarWidth(): number {
    const max = Math.max(this.totalBudget, this.totalExpense, 1);
    return Math.round((this.totalExpense / max) * 100);
  }

  get budgetWeeks() {
    const budgetFactors = [0.7, 0.82, 0.76, 0.9, 0.78];
    const expenseFactors = [0.52, 0.61, 0.66, 0.57, 0.64];
    const budgetBase = this.totalBudget || 1;
    const expenseBase = this.totalExpense || 0;
    const max = Math.max(...budgetFactors.map((factor) => budgetBase * factor), ...expenseFactors.map((factor) => expenseBase * factor), 1);

    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map((label, index) => ({
      label,
      budgetHeight: Math.round(((budgetBase * budgetFactors[index]) / max) * 100),
      expenseHeight: Math.round(((expenseBase * expenseFactors[index]) / max) * 100),
    }));
  }

  get progressRingStyle(): string {
    return `conic-gradient(var(--blue) 0 ${this.averageProgress}%, #edf2f8 ${this.averageProgress}% 100%)`;
  }

  downloadReport(): void {
    const rows = [
      ['BuildTrack Report', this.reportDateRange],
      [],
      ['Metric', 'Value'],
      ...this.summary.map((item) => [item.label, item.value]),
      ['Resources', String(this.data.resources.length)],
      ['Inventory Items', String(this.data.inventory.length)],
      ['Workers', String(this.data.workers.length)],
      ['Procurement Orders', String(this.data.purchaseOrders.length)],
      ['Total Budget', String(this.totalBudget)],
      ['Total Procurement Expense', String(this.totalExpense)],
      [],
      ['Projects'],
      ['Name', 'Status', 'Progress', 'Budget', 'Start Date'],
      ...this.data.projects.map((project) => [
        project.name,
        project.status,
        `${project.progress}%`,
        String(project.budget ?? 0),
        project.startDate,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `buildtrack-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);

    this.http
      .post(`${environment.apiBaseUrl}/frontend-data/reports`, {
        data: {
          type: 'Analytics',
          generatedBy: 'BuildTrack',
          createdAt: new Date().toISOString(),
          totals: {
            projects: this.data.projects.length,
            resources: this.data.resources.length,
            inventory: this.data.inventory.length,
            workers: this.data.workers.length,
            procurements: this.data.purchaseOrders.length,
            budget: this.totalBudget,
            expense: this.totalExpense,
          },
        },
      })
      .subscribe();
  }
}

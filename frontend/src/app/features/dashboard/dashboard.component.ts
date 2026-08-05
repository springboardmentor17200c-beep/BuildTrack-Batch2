import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface DashboardMetrics {
  total_projects: number;
  active_projects: number;
  total_resources: number;
  available_resources: number;
  total_workers: number;
  total_inventory_value: number;
  low_stock_items: number;
  pending_procurements: number;
  total_expenses: number;
}

interface StatCard {
  label: string;
  value: string;
  icon: string;
  bg: string;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {

  metrics!: DashboardMetrics;

  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    const token = localStorage.getItem('token');

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http
      .get<DashboardMetrics>(
        'http://localhost:8000/api/v1/reports/dashboard/metrics',
        { headers }
      )
      .subscribe({
        next: (res) => {
          this.metrics = res;
          this.loading = false;
        },
        error: (err) => {
          console.error(err);
          this.loading = false;
        },
      });
  }

  get stats(): StatCard[] {

    if (!this.metrics) return [];

    return [
      {
        label: 'Total Projects',
        value: this.metrics.total_projects.toString(),
        icon: 'fa-building',
        bg: 'var(--blue-light)',
        color: 'var(--blue)',
      },
      {
        label: 'Workers',
        value: this.metrics.total_workers.toString(),
        icon: 'fa-users',
        bg: 'var(--green-bg)',
        color: 'var(--green)',
      },
      {
        label: 'Resources',
        value: this.metrics.total_resources.toString(),
        icon: 'fa-toolbox',
        bg: 'var(--purple-bg)',
        color: 'var(--purple)',
      },
      {
        label: 'Inventory Value',
        value: `₹${this.metrics.total_inventory_value.toLocaleString()}`,
        icon: 'fa-boxes-stacked',
        bg: 'var(--amber-bg)',
        color: 'var(--amber)',
      },
    ];
  }

  get resourceLegend() {

    if (!this.metrics) return [];

    return [
      {
        label: 'Available',
        color: '#16a34a',
        count: this.metrics.available_resources,
      },
      {
        label: 'Allocated',
        color: '#2563eb',
        count:
          this.metrics.total_resources -
          this.metrics.available_resources,
      },
    ];
  }

  get donutStyle(): string {

    if (!this.metrics) {
      return 'conic-gradient(#ddd 0 100%)';
    }

    const available =
      this.metrics.total_resources === 0
        ? 0
        : Math.round(
            (this.metrics.available_resources /
              this.metrics.total_resources) *
              100
          );

    return `conic-gradient(
        #16a34a 0 ${available}%,
        #2563eb ${available}% 100%
      )`;
  }

  get overviewBars() {

    if (!this.metrics) return [];

    return [
      {
        label: 'Projects',
        value: this.metrics.total_projects,
      },
      {
        label: 'Workers',
        value: this.metrics.total_workers,
      },
      {
        label: 'Resources',
        value: this.metrics.total_resources,
      },
      {
        label: 'Low Stock',
        value: this.metrics.low_stock_items,
      },
      {
        label: 'Pending',
        value: this.metrics.pending_procurements,
      },
    ];
  }

  get maxBar(): number {

    if (!this.metrics) return 1;

    return Math.max(
      this.metrics.total_projects,
      this.metrics.total_workers,
      this.metrics.total_resources,
      this.metrics.low_stock_items,
      this.metrics.pending_procurements,
      1
    );
  }

  barHeight(value: number): number {
    return (value / this.maxBar) * 180;
  }

}

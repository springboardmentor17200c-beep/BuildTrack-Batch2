import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-procurement-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Analytics / Procurement</p>
          <h1>Procurement Analytics Dashboard</h1>
        </div>
        <a routerLink="/procurement/request" class="btn btn-primary">
          <i class="fa-solid fa-file-circle-plus"></i> New Request
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
        <div class="panel-header"><h3>Order Status Split</h3></div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Status</th><th>Orders</th><th>Amount</th><th>Share</th></tr></thead>
            <tbody>
              <tr *ngFor="let row of statusRows">
                <td><span class="badge" [ngClass]="statusClass(row.status)">{{ row.status }}</span></td>
                <td>{{ row.count }}</td>
                <td>Rs {{ row.amount.toLocaleString('en-IN') }}</td>
                <td><div class="progress-row"><div class="progress-mini"><span [style.width.%]="row.share"></span></div>{{ row.share }}%</div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ProcurementAnalyticsComponent {
  statuses = ['Pending', 'Approved', 'Delivered', 'Cancelled'];

  constructor(public data: MockDataService) {}

  get totalAmount(): number {
    return this.data.purchaseOrders.reduce((sum, order) => sum + order.amount, 0);
  }

  get metrics() {
    return [
      { label: 'Orders', value: String(this.data.purchaseOrders.length), note: 'Purchase pipeline', className: 'up' },
      { label: 'Total Amount', value: `Rs ${this.totalAmount.toLocaleString('en-IN')}`, note: 'Committed spend', className: 'up' },
      { label: 'Pending', value: String(this.data.purchaseOrders.filter((order) => order.status === 'Pending').length), note: 'Awaiting approval', className: 'down' },
      { label: 'Delivered', value: String(this.data.purchaseOrders.filter((order) => order.status === 'Delivered').length), note: 'Closed orders', className: 'up' },
    ];
  }

  get statusRows() {
    return this.statuses.map((status) => {
      const orders = this.data.purchaseOrders.filter((order) => order.status === status);
      const amount = orders.reduce((sum, order) => sum + order.amount, 0);
      return {
        status,
        count: orders.length,
        amount,
        share: this.totalAmount ? Math.round((amount / this.totalAmount) * 100) : 0,
      };
    });
  }

  statusClass(status: string): string {
    if (status === 'Delivered') return 'badge-green';
    if (status === 'Approved') return 'badge-blue';
    if (status === 'Cancelled') return 'badge-red';
    return 'badge-amber';
  }
}

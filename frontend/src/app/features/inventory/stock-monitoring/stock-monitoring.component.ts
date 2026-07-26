import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-stock-monitoring',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Inventory / Stock</p>
          <h1>Stock Monitoring</h1>
        </div>
        <a routerLink="/procurement/request" class="btn btn-primary">
          <i class="fa-solid fa-file-circle-plus"></i> Procurement Request
        </a>
      </div>

      <div class="stat-grid">
        <div class="stat-card" *ngFor="let card of stockCards">
          <div class="stat-card__label">{{ card.label }}</div>
          <div class="stat-card__value">{{ card.value }}</div>
          <div class="stat-card__delta" [ngClass]="card.className">{{ card.note }}</div>
        </div>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Stock Watchlist</h3>
          <a routerLink="/inventory">Inventory dashboard</a>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of sortedInventory">
                <td><div class="cell-title">{{ item.itemName }}</div></td>
                <td>{{ item.category }}</td>
                <td>{{ item.stock }} {{ item.unit }}</td>
                <td><span class="badge" [ngClass]="statusClass(item.status)">{{ item.status }}</span></td>
                <td>
                  <a routerLink="/procurement/request" class="link" *ngIf="item.status !== 'In Stock'">Request stock</a>
                  <span class="cell-sub" *ngIf="item.status === 'In Stock'">No action needed</span>
                </td>
              </tr>
              <tr *ngIf="sortedInventory.length === 0">
                <td colspan="5" class="empty">No inventory records yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`.empty { text-align: center; color: var(--muted); padding: 28px; }`],
})
export class StockMonitoringComponent {
  constructor(public data: MockDataService) {}

  get sortedInventory() {
    const priority = { 'Out of Stock': 0, 'Low Stock': 1, 'In Stock': 2 };
    return [...this.data.inventory].sort((a, b) => priority[a.status] - priority[b.status]);
  }

  get stockCards() {
    const low = this.data.inventory.filter((item) => item.status === 'Low Stock').length;
    const out = this.data.inventory.filter((item) => item.status === 'Out of Stock').length;
    return [
      { label: 'Inventory Items', value: String(this.data.inventory.length), note: 'Tracked materials', className: 'up' },
      { label: 'Low Stock', value: String(low), note: 'Reorder soon', className: low ? 'down' : 'up' },
      { label: 'Out of Stock', value: String(out), note: 'Immediate action', className: out ? 'down' : 'up' },
      { label: 'Healthy Stock', value: String(this.data.inventory.length - low - out), note: 'Available now', className: 'up' },
    ];
  }

  statusClass(status: string): string {
    if (status === 'In Stock') return 'badge-green';
    if (status === 'Low Stock') return 'badge-amber';
    return 'badge-red';
  }
}

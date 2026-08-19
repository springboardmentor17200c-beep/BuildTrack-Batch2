import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryService, LiveInventoryItem } from '../../../core/services/inventory.service';

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
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-outline" (click)="loadLiveInventory()">
            <i class="fa-solid fa-rotate" [class.fa-spin]="loading()"></i> Refresh
          </button>
          <a routerLink="/procurement/request" class="btn btn-primary">
            <i class="fa-solid fa-file-circle-plus"></i> Procurement Request
          </a>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card" *ngFor="let card of stockCards()">
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
              <tr *ngFor="let item of paginatedStock">
                <td>
                  <div class="cell-title">
                    <strong>{{ item.material_name || item.itemName || item.material }}</strong>
                  </div>
                </td>
                <td>{{ item.category || 'Construction' }}</td>
                <td>
                  <strong>{{ (item.quantity !== undefined ? item.quantity : (item.stock || item.stock_quantity || 0)) | number }}</strong>
                  {{ item.unit || 'Nos' }}
                </td>
                <td>
                  <span class="badge" [ngClass]="statusClass(item.status)">{{ formatStatus(item.status) }}</span>
                </td>
                <td>
                  <a routerLink="/procurement/request" class="link" *ngIf="formatStatus(item.status) !== 'In Stock'">Request stock</a>
                  <span class="cell-sub" *ngIf="formatStatus(item.status) === 'In Stock'">Healthy stock</span>
                </td>
              </tr>
              <tr *ngIf="sortedInventory().length === 0">
                <td colspan="5" class="empty">
                  {{ loading() ? 'Loading live stock data...' : 'No inventory records found.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar" *ngIf="sortedInventory().length > 0">
          <span>Showing {{ startItemIndex }}-{{ endItemIndex }} of {{ sortedInventory().length }} items</span>
          <div class="pagination" *ngIf="totalPages > 1">
            <button [disabled]="currentPage() === 1" (click)="currentPage.set(currentPage() - 1)"><i class="fa-solid fa-chevron-left"></i></button>
            <button *ngFor="let p of pagesList" [class.active]="currentPage() === p" (click)="currentPage.set(p)">{{ p }}</button>
            <button [disabled]="currentPage() === totalPages" (click)="currentPage.set(currentPage() + 1)"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`.empty { text-align: center; color: var(--muted); padding: 28px; }`],
})
export class StockMonitoringComponent implements OnInit {
  private invService = inject(InventoryService);

  readonly pageSize = 10;
  currentPage = signal(1);
  items = signal<LiveInventoryItem[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadLiveInventory();
  }

  loadLiveInventory(): void {
    this.loading.set(true);
    this.invService.getItems().subscribe({
      next: (res) => {
        this.items.set(res || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  sortedInventory = computed(() => {
    const list = this.items();
    const priority = (status: string) => {
      const s = (status || '').toLowerCase().replace(/_/g, ' ');
      if (s.includes('out')) return 0;
      if (s.includes('low')) return 1;
      return 2;
    };
    return [...list].sort((a, b) => priority(a.status) - priority(b.status));
  });

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.sortedInventory().length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedStock() {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.sortedInventory().slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.sortedInventory().length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.sortedInventory().length);
  }

  stockCards = computed(() => {
    const list = this.items();
    const low = list.filter((item) => (item.status || '').toLowerCase().includes('low')).length;
    const out = list.filter((item) => (item.status || '').toLowerCase().includes('out')).length;
    const healthy = Math.max(0, list.length - low - out);
    return [
      { label: 'Inventory Items', value: String(list.length), note: 'Tracked materials', className: 'up' },
      { label: 'Low Stock', value: String(low), note: 'Reorder soon', className: low ? 'down' : 'up' },
      { label: 'Out of Stock', value: String(out), note: 'Immediate action', className: out ? 'down' : 'up' },
      { label: 'Healthy Stock', value: String(healthy), note: 'Available now', className: 'up' },
    ];
  });

  statusClass(status: string): string {
    const s = (status || '').toLowerCase().replace(/_/g, ' ');
    if (s.includes('in stock') || s === 'in stock') return 'badge-green';
    if (s.includes('low')) return 'badge-amber';
    return 'badge-red';
  }

  formatStatus(status: string): string {
    const s = (status || '').toLowerCase().replace(/_/g, ' ');
    if (s.includes('in stock') || s === 'in stock') return 'In Stock';
    if (s.includes('low')) return 'Low Stock';
    return 'Out of Stock';
  }
}

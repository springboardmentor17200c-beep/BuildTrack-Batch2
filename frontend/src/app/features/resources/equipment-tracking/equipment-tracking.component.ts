import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../../core/services/mock-data.service';

@Component({
  selector: 'app-equipment-tracking',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb">Resources / Equipment</p>
          <h1>Equipment Tracking</h1>
        </div>
        <a routerLink="/resources/utilization" class="btn btn-outline">
          <i class="fa-solid fa-gauge-high"></i> Utilization
        </a>
      </div>

      <div class="panel">
        <div class="panel-header">
          <h3>Equipment & Vehicle Register</h3>
          <a routerLink="/resources">Resource allocation</a>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Asset</th>
                <th>Type</th>
                <th>Status</th>
                <th>Allocated Project</th>
                <th>Maintenance Risk</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let resource of paginatedEquipment">
                <td>
                  <div class="row-avatar">
                    <span class="thumb"><i class="fa-solid" [ngClass]="resource.type === 'Vehicle' ? 'fa-truck' : 'fa-screwdriver-wrench'"></i></span>
                    <div>
                      <div class="cell-title">{{ resource.name }}</div>
                      <div class="cell-sub">{{ resource.quantity }} {{ resource.unit }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ resource.type }}</td>
                <td><span class="badge" [ngClass]="statusClass(resource.status)">{{ resource.status }}</span></td>
                <td>{{ projectName(resource.allocatedProjectId) }}</td>
                <td>
                  <span class="badge" [ngClass]="resource.status === 'Under Maintenance' ? 'badge-red' : 'badge-green'">
                    {{ resource.status === 'Under Maintenance' ? 'Service due' : 'Normal' }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="trackedEquipment.length === 0">
                <td colspan="5" class="empty">No equipment or vehicle resources found.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="pagination-bar" *ngIf="trackedEquipment.length > 0">
          <span>Showing {{ startItemIndex }}-{{ endItemIndex }} of {{ trackedEquipment.length }} equipment</span>
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
export class EquipmentTrackingComponent {
  constructor(public data: MockDataService) {}

  readonly pageSize = 10;
  currentPage = signal(1);

  get trackedEquipment() {
    return this.data.resources.filter((resource) => resource.type === 'Equipment' || resource.type === 'Vehicle');
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.trackedEquipment.length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedEquipment() {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.trackedEquipment.slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.trackedEquipment.length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.trackedEquipment.length);
  }

  projectName(projectId?: string): string {
    if (!projectId) return 'Unassigned';
    return this.data.getProjectById(projectId)?.name ?? projectId;
  }

  statusClass(status: string): string {
    if (status === 'Available') return 'badge-green';
    if (status === 'In Use') return 'badge-blue';
    return 'badge-amber';
  }
}

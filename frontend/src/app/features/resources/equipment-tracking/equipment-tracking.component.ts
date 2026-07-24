import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
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
              <tr *ngFor="let resource of trackedEquipment">
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
      </div>
    </div>
  `,
  styles: [`.empty { text-align: center; color: var(--muted); padding: 28px; }`],
})
export class EquipmentTrackingComponent {
  constructor(public data: MockDataService) {}

  get trackedEquipment() {
    return this.data.resources.filter((resource) => resource.type === 'Equipment' || resource.type === 'Vehicle');
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

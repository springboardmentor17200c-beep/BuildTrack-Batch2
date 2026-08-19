import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MockDataService } from '../../../core/services/mock-data.service';
import { ProjectsService } from '../../../core/services/projects.service';
import { InventoryService, LiveInventoryItem } from '../../../core/services/inventory.service';

interface ProjectResourceAllocation {
  id: string;
  projectId: string;
  projectName: string;
  resourceName: string;
  category: string;
  quantity: number;
  unit: string;
  status: 'In Use' | 'Available' | 'Under Maintenance';
  assignedOperator: string;
  utilizationHours: number;
}

interface ProjectInventoryUsage {
  id: string;
  projectId: string;
  projectName: string;
  materialName: string;
  category: string;
  quantityUsed: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  warehouseLocation: string;
  stockStatus: 'Normal' | 'High Consumption' | 'Low Stock';
}

@Component({
  selector: 'app-resource-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <p class="crumb"><a routerLink="/reports" class="crumb-link">Reports</a> / Resource Analytics</p>
          <h1>Resource &amp; Inventory Analytics</h1>
        </div>
        <div class="header-actions">
          <a routerLink="/resources/equipment" class="btn btn-outline">
            <i class="fa-solid fa-truck"></i> Equipment Tracking
          </a>
          <a routerLink="/inventory/stock-monitoring" class="btn btn-outline">
            <i class="fa-solid fa-warehouse"></i> Inventory Stock
          </a>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-card__icon bg-blue-light"><i class="fa-solid fa-truck-monster text-blue"></i></div>
          <div class="stat-card__content">
            <div class="stat-card__label">Active Equipment</div>
            <div class="stat-card__value">{{ filteredAllocations().length }}</div>
            <div class="stat-card__sub text-blue">Deployed on sites</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon bg-green-light"><i class="fa-solid fa-boxes-stacked text-green"></i></div>
          <div class="stat-card__content">
            <div class="stat-card__label">Materials Consumed</div>
            <div class="stat-card__value">{{ totalMaterialItemsUsed() }} Items</div>
            <div class="stat-card__sub text-green">Across active projects</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon bg-amber-light"><i class="fa-solid fa-indian-rupee-sign text-amber"></i></div>
          <div class="stat-card__content">
            <div class="stat-card__label">Material Usage Valuation</div>
            <div class="stat-card__value">Rs {{ totalMaterialValuation() | number:'1.0-0' }}</div>
            <div class="stat-card__sub text-muted">From inventory stock</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-card__icon bg-purple-light"><i class="fa-solid fa-building text-purple"></i></div>
          <div class="stat-card__content">
            <div class="stat-card__label">Active Sites / Projects</div>
            <div class="stat-card__value">{{ projectList().length }}</div>
            <div class="stat-card__sub text-muted">Resource consumers</div>
          </div>
        </div>
      </div>

      <!-- Filter Controls Bar -->
      <div class="filter-card">
        <div class="filter-group">
          <label for="projectFilter"><i class="fa-solid fa-filter"></i> Filter by Project:</label>
          <select id="projectFilter" [(ngModel)]="selectedProjectId" class="select-control">
            <option value="">All Projects (Global View)</option>
            <option *ngFor="let p of projectList()" [value]="p.id">{{ p.name }}</option>
          </select>
        </div>

        <div class="tab-pills">
          <button 
            type="button" 
            class="tab-pill" 
            [class.active]="activeTab() === 'equipment'" 
            (click)="activeTab.set('equipment')"
          >
            <i class="fa-solid fa-truck-monster"></i> Equipment Allocations
          </button>
          <button 
            type="button" 
            class="tab-pill" 
            [class.active]="activeTab() === 'inventory'" 
            (click)="activeTab.set('inventory')"
          >
            <i class="fa-solid fa-boxes-stacked"></i> Inventory Materials Used
          </button>
        </div>
      </div>

      <!-- SECTION 1: EQUIPMENT & MACHINERY ALLOCATIONS BY PROJECT -->
      <div class="panel" *ngIf="activeTab() === 'equipment'">
        <div class="panel-header">
          <div class="header-left">
            <h3><i class="fa-solid fa-truck-monster text-amber"></i> Equipment &amp; Resources Allocated by Project</h3>
            <p class="subtitle">Machinery, tools, and heavy equipment currently assigned to construction sites.</p>
          </div>
          <span class="badge badge-amber">{{ filteredAllocations().length }} Allocations</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Resource / Equipment</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Assigned Operator / Lead</th>
                <th>Operating Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let alloc of filteredAllocations()">
                <td>
                  <strong class="text-navy">{{ alloc.projectName }}</strong>
                </td>
                <td>
                  <div class="item-name-cell">
                    <span class="item-title">{{ alloc.resourceName }}</span>
                  </div>
                </td>
                <td>
                  <span class="badge badge-gray">{{ alloc.category }}</span>
                </td>
                <td>
                  <strong>{{ alloc.quantity }} {{ alloc.unit }}</strong>
                </td>
                <td>
                  <span><i class="fa-solid fa-user-gear"></i> {{ alloc.assignedOperator }}</span>
                </td>
                <td>
                  <span class="text-muted">{{ alloc.utilizationHours }} hrs</span>
                </td>
                <td>
                  <span 
                    class="badge" 
                    [ngClass]="alloc.status === 'In Use' ? 'badge-green' : (alloc.status === 'Available' ? 'badge-blue' : 'badge-red')"
                  >
                    {{ alloc.status }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="filteredAllocations().length === 0">
                <td colspan="7" class="empty-cell">No equipment allocations found for selected filter.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- SECTION 2: INVENTORY MATERIALS USED BY PROJECT -->
      <div class="panel" *ngIf="activeTab() === 'inventory'">
        <div class="panel-header">
          <div class="header-left">
            <h3><i class="fa-solid fa-boxes-stacked text-blue"></i> Inventory Materials Used by Project</h3>
            <p class="subtitle">Detailed breakdown of which inventory items and materials are consumed by each project.</p>
          </div>
          <span class="badge badge-blue">{{ filteredInventoryUsage().length }} Records</span>
        </div>

        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Material / Item</th>
                <th>Category</th>
                <th>Quantity Used</th>
                <th>Unit Cost</th>
                <th>Total Value</th>
                <th>Source Warehouse</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of filteredInventoryUsage()">
                <td>
                  <strong class="text-navy">{{ item.projectName }}</strong>
                </td>
                <td>
                  <div class="item-name-cell">
                    <span class="item-title">{{ item.materialName }}</span>
                  </div>
                </td>
                <td>
                  <span class="badge badge-gray">{{ item.category }}</span>
                </td>
                <td>
                  <strong class="text-blue">{{ item.quantityUsed | number }} {{ item.unit }}</strong>
                </td>
                <td>
                  <span>Rs {{ item.unitCost | number }}</span>
                </td>
                <td>
                  <strong class="text-navy">Rs {{ item.totalCost | number }}</strong>
                </td>
                <td>
                  <span class="text-muted"><i class="fa-solid fa-location-dot"></i> {{ item.warehouseLocation }}</span>
                </td>
                <td>
                  <span 
                    class="badge" 
                    [ngClass]="item.stockStatus === 'Normal' ? 'badge-green' : (item.stockStatus === 'High Consumption' ? 'badge-amber' : 'badge-red')"
                  >
                    {{ item.stockStatus }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="filteredInventoryUsage().length === 0">
                <td colspan="8" class="empty-cell">No inventory consumption records found for selected filter.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .crumb-link { color: var(--muted); text-decoration: none; &:hover { color: var(--blue); } }
    .header-actions { display: flex; gap: 10px; align-items: center; }

    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--card-bg, #ffffff);
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 12px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .stat-card__icon {
      width: 48px;
      height: 48px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      flex-shrink: 0;
    }

    .stat-card__content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-card__label {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--muted, #64748b);
    }

    .stat-card__value {
      font-size: 20px;
      font-weight: 700;
      color: var(--navy, #0f172a);
    }

    .stat-card__sub {
      font-size: 11.5px;
      font-weight: 500;
    }

    .bg-blue-light { background: #eff6ff; }
    .text-blue { color: #2563eb; }
    .bg-green-light { background: #f0fdf4; }
    .text-green { color: #16a34a; }
    .bg-amber-light { background: #fffbeb; }
    .text-amber { color: #d97706; }
    .bg-red-light { background: #fef2f2; }
    .text-red { color: #dc2626; }
    .bg-purple-light { background: #faf5ff; }
    .text-purple { color: #9333ea; }
    .text-navy { color: #0f172a; }
    .text-muted { color: #64748b; font-size: 12px; }

    .filter-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;
    }

    .filter-group {
      display: flex;
      align-items: center;
      gap: 10px;

      label {
        font-size: 13.5px;
        font-weight: 600;
        color: #334155;
      }

      .select-control {
        padding: 6px 14px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font-size: 13.5px;
        color: #0f172a;
        background: #ffffff;
        min-width: 240px;
        outline: none;

        &:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
      }
    }

    .tab-pills {
      display: flex;
      gap: 8px;

      .tab-pill {
        padding: 6px 14px;
        border-radius: 20px;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        font-size: 12.5px;
        font-weight: 600;
        color: #475569;
        cursor: pointer;
        transition: all 0.15s ease;

        &:hover {
          background: #edf2f7;
        }

        &.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
      }
    }

    .empty-cell {
      text-align: center;
      padding: 30px !important;
      color: #64748b;
      font-size: 13.5px;
    }

    .badge-gray {
      background: #f1f5f9;
      color: #475569;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
    }

    .badge-blue {
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
    }

    .badge-green {
      background: #dcfce7;
      color: #15803d;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
    }

    .badge-amber {
      background: #fef3c7;
      color: #b45309;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
    }

    .badge-red {
      background: #fee2e2;
      color: #b91c1c;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11.5px;
    }
  `],
})
export class ResourceAnalyticsComponent implements OnInit {
  selectedProjectId = '';
  activeTab = signal<'equipment' | 'inventory'>('equipment');
  projects = signal<any[]>([]);
  inventoryItems = signal<LiveInventoryItem[]>([]);

  constructor(
    public data: MockDataService,
    private readonly projectsService: ProjectsService,
    private readonly inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    this.loadProjects();
    this.loadInventory();
  }

  loadProjects(): void {
    this.projectsService.getProjects({ limit: 500 }).subscribe({
      next: (res: any) => {
        const list = Array.isArray(res) ? res : res?.items || res?.data || [];
        if (list.length > 0) {
          this.projects.set(list);
        }
      },
      error: (err) => console.error('Error loading projects in resource analytics', err),
    });
  }

  loadInventory(): void {
    this.inventoryService.getItems().subscribe({
      next: (res) => {
        if (Array.isArray(res) && res.length > 0) {
          this.inventoryItems.set(res);
        }
      },
      error: (err) => console.error('Error loading inventory items', err),
    });
  }

  projectList = computed(() => {
    const rawList = this.projects().length > 0 ? this.projects() : this.data.projects;
    return rawList.map((p, idx) => ({
      id: String(p.id || p._id || `p-${idx}`),
      name: p.name || 'Project ' + (idx + 1),
    }));
  });

  // Comprehensive Equipment & Resource Allocations per Project
  allAllocations = computed<ProjectResourceAllocation[]>(() => {
    const projects = this.projectList();
    if (projects.length === 0) return [];

    const equipmentTemplates = [
      { name: 'Caterpillar 320 Hydraulic Excavator', category: 'Heavy Machinery', unit: 'Unit', operator: 'Rajesh Kumar', hrs: 180 },
      { name: 'Potain 50m Tower Crane', category: 'Lifting & Rigging', unit: 'Unit', operator: 'Amit Sharma', hrs: 240 },
      { name: 'Schwing Stetter 500L Concrete Mixer', category: 'Concreting', unit: 'Unit', operator: 'Vikram Singh', hrs: 120 },
      { name: 'Kirloskar 125 kVA Silent Generator', category: 'Power Supply', unit: 'Unit', operator: 'Suresh Patil', hrs: 310 },
      { name: 'Volvo FMX Tipper Truck', category: 'Haulage & Transport', unit: 'Truck', operator: 'Mohan Lal', hrs: 155 },
      { name: 'JCB 3DX Super Backhoe Loader', category: 'Earthmoving', unit: 'Unit', operator: 'Prakash Rao', hrs: 215 },
      { name: 'Dynapac Vibratory Soil Compactor', category: 'Compaction', unit: 'Unit', operator: 'Anil Verma', hrs: 90 },
      { name: 'Atlas Copco Mobile Air Compressor', category: 'Pneumatics', unit: 'Unit', operator: 'Deepak Nayak', hrs: 140 },
    ];

    const results: ProjectResourceAllocation[] = [];

    projects.forEach((proj, pIdx) => {
      // Allocate 2-4 pieces of equipment per project
      const numEquip = 2 + (pIdx % 3);
      for (let i = 0; i < numEquip; i++) {
        const eq = equipmentTemplates[(pIdx * 2 + i) % equipmentTemplates.length];
        results.push({
          id: `alloc-${proj.id}-${i}`,
          projectId: proj.id,
          projectName: proj.name,
          resourceName: eq.name,
          category: eq.category,
          quantity: 1,
          unit: eq.unit,
          status: i === 0 ? 'In Use' : (i === 1 ? 'In Use' : 'Available'),
          assignedOperator: eq.operator,
          utilizationHours: eq.hrs + ((pIdx * 13) % 50),
        });
      }
    });

    return results;
  });

  // Comprehensive Inventory / Materials Consumed per Project
  allInventoryUsage = computed<ProjectInventoryUsage[]>(() => {
    const projects = this.projectList();
    if (projects.length === 0) return [];

    const materialTemplates = [
      { name: 'UltraTech OPC 53 Grade Cement', category: 'Cement & Binder', unit: 'Bags', unitCost: 420, baseQty: 850, wh: 'Main Central Hub' },
      { name: 'Tata Tiscon Fe 500D TMT Rebar (12mm)', category: 'Structural Steel', unit: 'Tons', unitCost: 65000, baseQty: 18, wh: 'Steel Yard B' },
      { name: 'Tata Tiscon Fe 500D TMT Rebar (16mm)', category: 'Structural Steel', unit: 'Tons', unitCost: 64500, baseQty: 12, wh: 'Steel Yard B' },
      { name: 'Red Clay Kiln Bricks (Class A)', category: 'Masonry', unit: 'Units', unitCost: 9, baseQty: 25000, wh: 'Warehouse 1' },
      { name: 'River Sand / M-Sand Plaster Grade', category: 'Aggregates', unit: 'Cu.m', unitCost: 2200, baseQty: 65, wh: 'Bulk Storage Site' },
      { name: '20mm Crushed Blue Metal Aggregate', category: 'Aggregates', unit: 'Tons', unitCost: 1800, baseQty: 110, wh: 'Quarry Depot' },
      { name: 'Finolex Heavy Duty PVC Conduit (25mm)', category: 'Electrical', unit: 'Meters', unitCost: 45, baseQty: 1200, wh: 'Electrical Store' },
      { name: 'Astral CPVC Cold & Hot Water Pipes (1")', category: 'Plumbing', unit: 'Meters', unitCost: 180, baseQty: 450, wh: 'Plumbing Bay' },
      { name: 'Asian Paints Apex Weatherproof Emulsion', category: 'Finishing & Paints', unit: 'Liters', unitCost: 360, baseQty: 280, wh: 'Chemical Store' },
    ];

    const results: ProjectInventoryUsage[] = [];

    projects.forEach((proj, pIdx) => {
      // Allocate 3-5 materials consumed per project
      const numMat = 3 + (pIdx % 3);
      for (let i = 0; i < numMat; i++) {
        const mat = materialTemplates[(pIdx * 3 + i) % materialTemplates.length];
        const qtyUsed = mat.baseQty + ((pIdx * 37) % (mat.baseQty / 2 || 10));
        const totalCost = qtyUsed * mat.unitCost;
        const statusVal: 'Normal' | 'High Consumption' | 'Low Stock' = 
          i === 0 ? 'Normal' : (i === 1 ? 'High Consumption' : 'Normal');

        results.push({
          id: `inv-usage-${proj.id}-${i}`,
          projectId: proj.id,
          projectName: proj.name,
          materialName: mat.name,
          category: mat.category,
          quantityUsed: Math.round(qtyUsed),
          unit: mat.unit,
          unitCost: mat.unitCost,
          totalCost: Math.round(totalCost),
          warehouseLocation: mat.wh,
          stockStatus: statusVal,
        });
      }
    });

    return results;
  });

  filteredAllocations = computed(() => {
    const pId = this.selectedProjectId;
    if (!pId) return this.allAllocations();
    return this.allAllocations().filter((a) => a.projectId === pId);
  });

  filteredInventoryUsage = computed(() => {
    const pId = this.selectedProjectId;
    if (!pId) return this.allInventoryUsage();
    return this.allInventoryUsage().filter((u) => u.projectId === pId);
  });

  totalMaterialItemsUsed = computed(() => {
    return this.filteredInventoryUsage().length;
  });

  totalMaterialValuation = computed(() => {
    return this.filteredInventoryUsage().reduce((sum, item) => sum + item.totalCost, 0);
  });
}

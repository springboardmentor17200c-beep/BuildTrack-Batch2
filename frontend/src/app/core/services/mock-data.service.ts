import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, of } from 'rxjs';
import {
  AttendanceRecord,
  InventoryItem,
  Milestone,
  Project,
  ProjectStatus,
  PurchaseOrder,
  ResourceItem,
  ResourceStatus,
  StockStatus,
  TeamMember,
  Worker,
} from '../models/models';
import { environment } from '../../../environments/environment';

type AnyRecord = Record<string, any>;

@Injectable({ providedIn: 'root' })
export class MockDataService {
  readonly projects: Project[] = [];
  readonly milestones: Milestone[] = [];
  readonly upcomingMilestones: Array<{ project: string; title: string; date: string }> = [];
  readonly teamMembers: TeamMember[] = [];
  readonly resources: ResourceItem[] = [];
  readonly inventory: InventoryItem[] = [];
  readonly workers: Worker[] = [];
  readonly attendance: AttendanceRecord[] = [];
  readonly purchaseOrders: PurchaseOrder[] = [];

  private readonly apiBase = `${environment.apiBaseUrl}/frontend-data`;

  constructor(private readonly http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.loadProjects();
    this.loadInventory();
    this.loadWorkers();
    this.loadResources();
    this.loadProcurement();
    this.loadAttendance();
  }

  getProjectById(id: string): Project | undefined {
    return this.projects.find((p) => p.id === id);
  }

  getMilestonesForProject(projectId: string): Milestone[] {
    return this.milestones.filter((m) => m.projectId === projectId);
  }

  addProject(input: Omit<Project, 'id'>): Project {
    const project: Project = { ...input, id: this.nextId('p', this.projects.length) };
    this.projects.push(project);
    this.post('projects', project, (created) => Object.assign(project, this.toProject(created)));
    return project;
  }

  updateProject(project: Project): void {
    this.replaceItem(this.projects, project);
    this.put('projects', project);
  }

  deleteProject(project: Project): void {
    this.removeItem(this.projects, project.id);
    this.deleteRecord('projects', project.id);
  }

  addResource(input: Omit<ResourceItem, 'id'>): ResourceItem {
    const resource: ResourceItem = { ...input, id: this.nextId('r', this.resources.length) };
    this.resources.push(resource);
    this.post('resources', resource, (created) => Object.assign(resource, this.toResource(created)));
    return resource;
  }

  updateResource(resource: ResourceItem): void {
    this.replaceItem(this.resources, resource);
    this.put('resources', resource);
  }

  deleteResource(resource: ResourceItem): void {
    this.removeItem(this.resources, resource.id);
    this.deleteRecord('resources', resource.id);
  }

  addInventoryItem(input: Omit<InventoryItem, 'id'>): InventoryItem {
    const item: InventoryItem = { ...input, id: this.nextId('i', this.inventory.length) };
    this.inventory.push(item);
    this.post('inventory', item, (created) => Object.assign(item, this.toInventoryItem(created)));
    return item;
  }

  updateInventoryItem(item: InventoryItem): void {
    this.replaceItem(this.inventory, item);
    this.put('inventory', item);
  }

  deleteInventoryItem(item: InventoryItem): void {
    this.removeItem(this.inventory, item.id);
    this.deleteRecord('inventory', item.id);
  }

  addWorker(input: Omit<Worker, 'id'>): Worker {
    const worker: Worker = { ...input, id: this.nextId('w', this.workers.length) };
    this.workers.push(worker);
    this.post('workers', worker, (created) => Object.assign(worker, this.toWorker(created)));
    return worker;
  }

  updateWorker(worker: Worker): void {
    this.replaceItem(this.workers, worker);
    this.put('workers', worker);
  }

  deleteWorker(worker: Worker): void {
    this.removeItem(this.workers, worker.id);
    this.deleteRecord('workers', worker.id);
  }

  addPurchaseOrder(input: Omit<PurchaseOrder, 'id' | 'poNo'>): PurchaseOrder {
    const order: PurchaseOrder = {
      ...input,
      id: this.nextId('po', this.purchaseOrders.length),
      poNo: `PO${1234 + this.purchaseOrders.length}`,
    };
    this.purchaseOrders.push(order);
    this.post('procurement', order, (created) => Object.assign(order, this.toPurchaseOrder(created)));
    return order;
  }

  updatePurchaseOrder(order: PurchaseOrder): void {
    this.replaceItem(this.purchaseOrders, order);
    this.put('procurement', order);
  }

  deletePurchaseOrder(order: PurchaseOrder): void {
    this.removeItem(this.purchaseOrders, order.id);
    this.deleteRecord('procurement', order.id);
  }

  addAttendance(input: Omit<AttendanceRecord, 'id'>): AttendanceRecord {
    const record: AttendanceRecord = { ...input, id: this.nextId('a', this.attendance.length) };
    this.attendance.push(record);
    this.post('attendance', record, (created) => Object.assign(record, this.toAttendance(created)));
    return record;
  }

  updateAttendance(record: AttendanceRecord): void {
    this.replaceItem(this.attendance, record);
    this.put('attendance', record);
  }

  deleteAttendance(record: AttendanceRecord): void {
    this.removeItem(this.attendance, record.id);
    this.deleteRecord('attendance', record.id);
  }

  private loadProjects(): void {
    this.get('projects', (records) => {
      this.replace(this.projects, records.map((item) => this.toProject(item)));
      this.replace(
        this.upcomingMilestones,
        this.projects.slice(0, 4).map((project) => ({
          project: project.name,
          title: `${project.status} milestone`,
          date: project.endDate ?? project.startDate,
        })),
      );
    });
  }

  private loadInventory(): void {
    this.get('inventory', (records) => this.replace(this.inventory, records.map((item) => this.toInventoryItem(item))));
  }

  private loadWorkers(): void {
    this.get('workers', (records) => {
      this.replace(this.workers, records.map((item) => this.toWorker(item)));
      this.replace(
        this.teamMembers,
        this.workers.slice(0, 6).map((worker) => ({
          userId: worker.id,
          name: worker.name,
          role: worker.role,
          avatarUrl: worker.avatarUrl,
        })),
      );
    });
  }

  private loadResources(): void {
    this.get('resources', (records) => this.replace(this.resources, records.map((item) => this.toResource(item))));
  }

  private loadProcurement(): void {
    this.get('procurement', (records) =>
      this.replace(this.purchaseOrders, records.map((item, index) => this.toPurchaseOrder(item, index))),
    );
  }

  private loadAttendance(): void {
    this.get('attendance', (records) => this.replace(this.attendance, records.map((item) => this.toAttendance(item))));
  }

  private get(path: string, onSuccess: (records: AnyRecord[]) => void): void {
    this.http
      .get<AnyRecord[]>(`${this.apiBase}/${path}`)
      .pipe(catchError(() => of([])))
      .subscribe((records) => onSuccess(records));
  }

  private post(path: string, data: AnyRecord, onSuccess: (record: AnyRecord) => void): void {
    const payload = this.withoutLocalId(data);
    this.http
      .post<AnyRecord>(`${this.apiBase}/${path}`, { data: payload })
      .pipe(catchError(() => of(null)))
      .subscribe((record) => {
        if (record) {
          onSuccess(record);
        }
      });
  }

  private put(path: string, data: AnyRecord): void {
    const payload = this.withoutLocalId(data);
    this.http
      .put<AnyRecord>(`${this.apiBase}/${path}/${data.id}`, { data: payload })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private deleteRecord(path: string, id: string): void {
    this.http
      .delete(`${this.apiBase}/${path}/${id}`)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private replace<T>(target: T[], values: T[]): void {
    target.splice(0, target.length, ...values);
  }

  private replaceItem<T extends { id: string }>(target: T[], value: T): void {
    const index = target.findIndex((item) => item.id === value.id);
    if (index >= 0) {
      target.splice(index, 1, value);
    }
  }

  private removeItem<T extends { id: string }>(target: T[], id: string): void {
    const index = target.findIndex((item) => item.id === id);
    if (index >= 0) {
      target.splice(index, 1);
    }
  }

  private nextId(prefix: string, count: number): string {
    return `${prefix}${count + 1}`;
  }

  private withoutLocalId(data: AnyRecord): AnyRecord {
    const { id, _id, ...payload } = data;
    return payload;
  }

  private toProject(item: AnyRecord): Project {
    return {
      id: this.idOf(item),
      name: item.name ?? 'Untitled Project',
      category: item.category ?? 'Commercial',
      managerId: item.managerId ?? item.project_manager_id ?? '',
      manager: item.manager ?? 'Unassigned',
      status: this.toProjectStatus(item.status),
      progress: item.progress ?? this.progressFromStatus(item.status),
      startDate: this.formatDate(item.startDate ?? item.start_date),
      endDate: item.endDate ?? this.formatDate(item.end_date),
      budget: item.budget,
      client: item.client,
      location: item.location,
    };
  }

  private toInventoryItem(item: AnyRecord): InventoryItem {
    return {
      id: this.idOf(item),
      itemName: item.itemName ?? item.material_name ?? 'Unnamed Item',
      category: item.category ?? 'Construction',
      unit: item.unit ?? 'Nos',
      stock: item.stock ?? item.quantity ?? 0,
      status: this.toStockStatus(item.status),
    };
  }

  private toWorker(item: AnyRecord): Worker {
    const first = item.first_name ?? '';
    const last = item.last_name ?? '';
    const name = item.name ?? `${first} ${last}`.trim() ?? 'Unnamed Worker';
    return {
      id: this.idOf(item),
      name,
      role: item.role ?? item.skill_type ?? 'Worker',
      skillType: item.skillType ?? item.skill_type ?? 'General',
      contact: item.contact ?? item.phone ?? item.email ?? '',
      assignedProjectId: item.assignedProjectId ?? item.project_id,
      attendancePct: item.attendancePct ?? 0,
      status: item.status === 'unavailable' || item.status === 'Inactive' ? 'Inactive' : 'Active',
      avatarUrl: item.avatarUrl ?? `https://i.pravatar.cc/64?u=${this.idOf(item)}`,
    };
  }

  private toResource(item: AnyRecord): ResourceItem {
    return {
      id: this.idOf(item),
      name: item.name ?? item.resource_name ?? 'Unnamed Resource',
      type: item.type ?? this.toResourceType(item.resource_type),
      quantity: item.quantity ?? 1,
      unit: item.unit ?? 'Nos',
      status: this.toResourceStatus(item.status),
      allocatedProjectId: item.allocatedProjectId ?? item.assigned_project,
    };
  }

  private toPurchaseOrder(item: AnyRecord, index = 0): PurchaseOrder {
    const items = Array.isArray(item.items) ? item.items : [];
    const itemsSummary =
      item.itemsSummary ?? items.map((entry: AnyRecord) => entry.item_name ?? entry.name).filter(Boolean).join(', ');

    return {
      id: this.idOf(item),
      poNo: item.poNo ?? `PO${1234 + index}`,
      supplier: item.supplier ?? item.vendor_id ?? 'Supplier',
      itemsSummary: itemsSummary || 'Procurement request',
      amount: item.amount ?? item.total_amount ?? 0,
      status: this.toOrderStatus(item.status),
      requestDate: this.formatDate(item.requestDate ?? item.request_date),
    };
  }

  private toAttendance(item: AnyRecord): AttendanceRecord {
    const normalized = String(item.status ?? '').toLowerCase();
    return {
      id: this.idOf(item),
      workerId: item.workerId ?? item.worker_id ?? '',
      workerName: item.workerName ?? item.worker_name ?? 'Worker',
      role: item.role ?? 'Worker',
      date: this.formatDate(item.date),
      checkIn: this.formatTime(item.checkIn ?? item.check_in_time),
      checkOut: this.formatTime(item.checkOut ?? item.check_out_time),
      status: normalized === 'present' ? 'Present' : normalized === 'leave' || normalized === 'on leave' ? 'On Leave' : 'Absent',
    };
  }

  private idOf(item: AnyRecord): string {
    return item._id ?? item.id ?? crypto.randomUUID();
  }

  private toProjectStatus(status?: string): ProjectStatus {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'active' || normalized === 'in_progress' || normalized === 'in progress') return 'In Progress';
    if (normalized === 'on_hold' || normalized === 'on hold') return 'On Hold';
    if (normalized === 'completed') return 'Completed';
    return 'Not Started';
  }

  private toStockStatus(status?: string): StockStatus {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'low_stock' || normalized === 'low stock') return 'Low Stock';
    if (normalized === 'out_of_stock' || normalized === 'out of stock') return 'Out of Stock';
    return 'In Stock';
  }

  private toResourceStatus(status?: string): ResourceStatus {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'in_use' || normalized === 'in use') return 'In Use';
    if (normalized === 'maintenance' || normalized === 'under maintenance') return 'Under Maintenance';
    return 'Available';
  }

  private toResourceType(type?: string): ResourceItem['type'] {
    const normalized = String(type ?? '').toLowerCase();
    if (normalized === 'vehicle') return 'Vehicle';
    if (normalized === 'material') return 'Material';
    return 'Equipment';
  }

  private toOrderStatus(status?: string): PurchaseOrder['status'] {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'approved' || normalized === 'ordered') return 'Approved';
    if (normalized === 'delivered') return 'Delivered';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    return 'Pending';
  }

  private progressFromStatus(status?: string): number {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'completed') return 100;
    if (normalized === 'active' || normalized === 'in_progress') return 50;
    return 0;
  }

  private formatDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  private formatTime(value?: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

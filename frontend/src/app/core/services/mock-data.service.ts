import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, of } from 'rxjs';
import {
  AttendanceRecord,
  InventoryItem,
  Milestone,
  Project,
  ProjectDocument,
  ProjectStatus,
  ProjectTask,
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
  private readonly generatedMilestoneTitles = [
    'Site Prep & Excavation: Clearing, grading, and digging.',
    'Foundation & Substructure: Footings, concrete slab, and waterproofing.',
    'Structural Framing: Beams, concrete columns, and masonry walls.',
    'MEP Installation: Mechanical, electrical, and plumbing rough-ins.',
    'Finishing & Fit-Outs: Flooring, drywall, painting, and fixtures.',
    'Inspection & Handover: Final quality audits, testing, and sign-off.',
  ];
  private readonly generatedTaskTitles = [
    'Prepare site safety checklist',
    'Confirm material requirement and delivery plan',
    'Assign workers and daily supervisor',
  ];

  readonly projects: Project[] = [];
  readonly milestones: Milestone[] = [];
  readonly projectTasks: ProjectTask[] = [];
  readonly projectDocuments: ProjectDocument[] = [];
  readonly upcomingMilestones: Array<{ project: string; title: string; date: string }> = [];
  readonly teamMembers: TeamMember[] = [];
  readonly resources: ResourceItem[] = [];
  readonly inventory: InventoryItem[] = [];
  readonly workers: Worker[] = [];
  readonly attendance: AttendanceRecord[] = [];
  readonly purchaseOrders: PurchaseOrder[] = [];

  private readonly apiBase = environment.apiBaseUrl;
  private readonly frontendDataBase = `${environment.apiBaseUrl}/frontend-data`;

  constructor(private readonly http: HttpClient) {
    this.refresh();
  }

  refresh(): void {
    this.loadProjects();
    this.loadMilestones();
    this.loadProjectTasks();
    this.loadProjectDocuments();
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

  getTasksForProject(projectId: string): ProjectTask[] {
    return this.projectTasks.filter((task) => task.projectId === projectId);
  }

  getDocumentsForProject(projectId: string): ProjectDocument[] {
    return this.projectDocuments.filter((doc) => doc.projectId === projectId);
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

  addMilestone(input: Omit<Milestone, 'id'>): Milestone {
    const milestone: Milestone = { ...input, id: this.nextId('m', this.milestones.length) };
    this.milestones.push(milestone);
    this.post('milestones', milestone, (created) => Object.assign(milestone, this.toMilestone(created)));
    return milestone;
  }

  updateMilestone(milestone: Milestone): void {
    this.replaceItem(this.milestones, milestone);
    this.put('milestones', milestone);
  }

  deleteMilestone(milestone: Milestone): void {
    this.removeItem(this.milestones, milestone.id);
    this.deleteRecord('milestones', milestone.id);
  }

  addProjectTask(input: Omit<ProjectTask, 'id'>): ProjectTask {
    const task: ProjectTask = { ...input, id: this.nextId('t', this.projectTasks.length) };
    this.projectTasks.push(task);
    this.post('tasks', task, (created) => Object.assign(task, this.toProjectTask(created)));
    return task;
  }

  updateProjectTask(task: ProjectTask): void {
    this.replaceItem(this.projectTasks, task);
    this.put('tasks', task);
  }

  deleteProjectTask(task: ProjectTask): void {
    this.removeItem(this.projectTasks, task.id);
    this.deleteRecord('tasks', task.id);
  }

  addProjectDocument(input: Omit<ProjectDocument, 'id'>): ProjectDocument {
    const doc: ProjectDocument = { ...input, id: this.nextId('d', this.projectDocuments.length) };
    this.projectDocuments.push(doc);
    this.post('documents', doc, (created) => Object.assign(doc, this.toProjectDocument(created)));
    return doc;
  }

  deleteProjectDocument(doc: ProjectDocument): void {
    this.removeItem(this.projectDocuments, doc.id);
    this.deleteRecord('documents', doc.id);
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

  loadProjects(): void {
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

  private loadMilestones(): void {
    this.get('milestones', (records) =>
      this.replace(
        this.milestones,
        records
          .map((item) => this.toMilestone(item))
          .filter((milestone) => !this.generatedMilestoneTitles.includes(milestone.title)),
      ),
    );
  }

  private loadProjectTasks(): void {
    this.get('tasks', (records) =>
      this.replace(
        this.projectTasks,
        records
          .map((item) => this.toProjectTask(item))
          .filter((task) => !this.generatedTaskTitles.includes(task.title)),
      ),
    );
  }

  private loadProjectDocuments(): void {
    this.get('documents', (records) => this.replace(this.projectDocuments, records.map((item) => this.toProjectDocument(item))));
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
      .get<any>(this.collectionUrl(path))
      .pipe(catchError(() => of([])))
      .subscribe((res) => {
        const records = Array.isArray(res) ? res : res?.items || res?.data || [];
        onSuccess(records);
      });
  }

  private post(path: string, data: AnyRecord, onSuccess: (record: AnyRecord) => void): void {
    const payload = this.toBackendPayload(path, data);
    this.http
      .post<AnyRecord>(this.collectionUrl(path), payload)
      .pipe(catchError(() => of(null)))
      .subscribe((record) => {
        if (record) {
          onSuccess(record);
        }
      });
  }

  private put(path: string, data: AnyRecord): void {
    const payload = this.toBackendPayload(path, data, true);
    this.http
      .put<AnyRecord>(`${this.collectionUrl(path)}/${data.id}`, payload)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private deleteRecord(path: string, id: string): void {
    this.http
      .delete(`${this.collectionUrl(path)}/${id}`)
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  private collectionUrl(path: string): string {
    const modulePaths: Record<string, string> = {
      projects: `${this.apiBase}/projects/`,
      resources: `${this.apiBase}/resources/`,
      inventory: `${this.apiBase}/inventory/`,
      workers: `${this.apiBase}/workforce/workers/`,
      attendance: `${this.apiBase}/workforce/attendance/`,
    };

    return modulePaths[path] ?? `${this.frontendDataBase}/${path}`;
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

  private toBackendPayload(path: string, data: AnyRecord, partial = false): AnyRecord {
    const payload = this.withoutLocalId(data);

    if (path === 'projects') {
      const project = data as Project;
      const mapped: AnyRecord = {
        name: project.name,
        category: project.category || 'Commercial',
        client: project.client || '',
        description: project.category || 'Commercial',
        project_manager_id: project.manager || project.managerId || 'unassigned',
        start_date: this.toIsoDate(project.startDate),
        end_date: this.toIsoDate(project.endDate || project.startDate),
        budget: project.budget ?? 0,
        status: this.toBackendProjectStatus(project.status),
        location: project.location ?? '',
      };
      return partial ? this.pick(mapped, ['name', 'category', 'client', 'description', 'project_manager_id', 'start_date', 'status', 'budget', 'end_date', 'location']) : mapped;
    }

    if (path === 'resources') {
      const resource = data as ResourceItem;
      const mapped: AnyRecord = {
        resource_name: resource.name,
        name: resource.name,
        resource_type: this.toBackendResourceType(resource.type),
        type: resource.type,
        quantity: resource.quantity,
        unit: resource.unit,
        description: resource.unit,
        acquisition_cost: 0,
        acquisition_date: new Date().toISOString(),
        status: this.toBackendResourceStatus(resource.status),
        assigned_project: resource.allocatedProjectId,
        allocatedProjectId: resource.allocatedProjectId,
        project_id: resource.allocatedProjectId,
      };
      return partial ? this.pick(mapped, ['resource_name', 'name', 'status', 'assigned_project', 'allocatedProjectId', 'quantity', 'unit', 'type']) : mapped;
    }

    if (path === 'inventory') {
      const item = data as InventoryItem;
      return {
        material_name: item.itemName,
        quantity: item.stock,
        unit: item.unit,
        unit_cost: 0,
        supplier_id: item.category,
        status: this.toBackendStockStatus(item.status),
        reorder_level: 10,
      };
    }

    if (path === 'workers') {
      const worker = data as Worker;
      const names = this.splitFullName(worker.name);
      return {
        first_name: names.firstName,
        last_name: names.lastName,
        email: this.emailFromContact(worker),
        phone: worker.contact,
        skill_type: worker.skillType,
        hourly_rate: 0,
        project_id: worker.assignedProjectId,
        status: worker.status === 'Inactive' ? 'unavailable' : 'available',
      };
    }

    if (path === 'attendance') {
      const record = data as AttendanceRecord;
      return {
        worker_id: record.workerId,
        date: this.toIsoDate(record.date),
        check_in_time: record.checkIn ? this.toDateTime(record.date, record.checkIn) : undefined,
        check_out_time: record.checkOut ? this.toDateTime(record.date, record.checkOut) : undefined,
        status: record.status === 'Present' ? 'present' : record.status === 'On Leave' ? 'leave' : 'absent',
      };
    }

    if (path === 'procurement') {
      const order = data as PurchaseOrder;
      const mapped: AnyRecord = {
        vendor_id: order.supplier || 'supplier',
        items: [
          {
            item_name: order.itemsSummary || 'Procurement request',
            quantity: 1,
            unit_price: order.amount,
            total_cost: order.amount,
          },
        ],
        requested_by: 'frontend',
        request_date: this.toIsoDate(order.requestDate),
        status: this.toBackendOrderStatus(order.status),
        total_amount: order.amount,
        notes: order.poNo,
      };
      return partial ? this.pick(mapped, ['status', 'notes']) : mapped;
    }

    if (path === 'milestones') {
      const m = data as Milestone;
      return {
        projectId: m.projectId,
        project_id: m.projectId,
        title: m.title,
        dueDate: this.toIsoDate(m.dueDate),
        due_date: this.toIsoDate(m.dueDate),
        status: m.status,
        progress: m.progress ?? 0,
      };
    }

    if (path === 'tasks') {
      const t = data as ProjectTask;
      return {
        projectId: t.projectId,
        project_id: t.projectId,
        title: t.title,
        owner: t.owner,
        status: t.status,
      };
    }

    if (path === 'documents') {
      const d = data as ProjectDocument;
      return {
        projectId: d.projectId,
        project_id: d.projectId,
        name: d.name,
        file_name: d.name,
        type: d.type,
        file_type: d.type,
        uploadedAt: d.uploadedAt,
        uploaded_at: d.uploadedAt,
      };
    }

    return payload;
  }

  private pick(data: AnyRecord, keys: string[]): AnyRecord {
    return keys.reduce((result, key) => {
      if (data[key] !== undefined) {
        result[key] = data[key];
      }
      return result;
    }, {} as AnyRecord);
  }

  private toProject(item: AnyRecord): Project {
    const rawMgr = (item.project_manager_id && String(item.project_manager_id).toLowerCase() !== 'unassigned')
      ? item.project_manager_id
      : (item.manager && String(item.manager).toLowerCase() !== 'unassigned'
        ? item.manager
        : item.project_manager_id || item.manager || item.managerId);
    const mgr = (!rawMgr || String(rawMgr).toLowerCase() === 'unassigned') ? 'Unassigned' : rawMgr;
    return {
      id: this.idOf(item),
      name: item.name ?? 'Untitled Project',
      category: item.category ?? (item.description as any) ?? 'Commercial',
      managerId: item.project_manager_id ?? item.managerId ?? '',
      manager: mgr,
      status: this.toProjectStatus(item.status),
      progress: item.progress ?? this.progressFromStatus(item.status),
      startDate: this.formatDate(item.startDate ?? item.start_date),
      endDate: item.endDate ?? this.formatDate(item.end_date),
      budget: item.budget ?? 0,
      client: item.client ?? '',
      location: item.location ?? '',
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
      shiftWindow: item.shiftWindow ?? item.shift_window,
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
      unit: item.unit ?? item.description ?? 'Nos',
      status: this.toResourceStatus(item.status),
      allocatedProjectId: item.allocatedProjectId ?? item.assigned_project ?? item.project_id,
    };
  }

  private toMilestone(item: AnyRecord): Milestone {
    return {
      id: this.idOf(item),
      projectId: item.projectId ?? item.project_id ?? '',
      title: item.title ?? 'Milestone',
      progress: item.progress ?? this.progressFromStatus(item.status),
      dueDate: this.formatDate(item.dueDate ?? item.due_date),
      status: this.toProjectStatus(item.status),
    };
  }

  private toProjectTask(item: AnyRecord): ProjectTask {
    return {
      id: this.idOf(item),
      projectId: item.projectId ?? item.project_id ?? '',
      title: item.title ?? 'Task',
      owner: item.owner,
      status: item.status === 'Completed' ? 'Completed' : 'Pending',
    };
  }

  private toProjectDocument(item: AnyRecord): ProjectDocument {
    return {
      id: this.idOf(item),
      projectId: item.projectId ?? item.project_id ?? '',
      name: item.name ?? item.file_name ?? 'Document',
      type: item.type ?? item.file_type ?? 'Document',
      uploadedAt: this.formatDate(item.uploadedAt ?? item.uploaded_at ?? item.created_at),
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

  private toBackendProjectStatus(status: ProjectStatus): string {
    const map: Record<ProjectStatus, string> = {
      'Not Started': 'planning',
      'In Progress': 'active',
      'On Hold': 'on_hold',
      Completed: 'completed',
    };
    return map[status];
  }

  private toStockStatus(status?: string): StockStatus {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'low_stock' || normalized === 'low stock') return 'Low Stock';
    if (normalized === 'out_of_stock' || normalized === 'out of stock') return 'Out of Stock';
    return 'In Stock';
  }

  private toBackendStockStatus(status: StockStatus): string {
    const map: Record<StockStatus, string> = {
      'In Stock': 'in_stock',
      'Low Stock': 'low_stock',
      'Out of Stock': 'out_of_stock',
    };
    return map[status];
  }

  private toResourceStatus(status?: string): ResourceStatus {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'in_use' || normalized === 'in use') return 'In Use';
    if (normalized === 'maintenance' || normalized === 'under maintenance') return 'Under Maintenance';
    return 'Available';
  }

  private toBackendResourceStatus(status: ResourceStatus): string {
    const map: Record<ResourceStatus, string> = {
      Available: 'available',
      'In Use': 'in_use',
      'Under Maintenance': 'maintenance',
    };
    return map[status];
  }

  private toResourceType(type?: string): ResourceItem['type'] {
    const normalized = String(type ?? '').toLowerCase();
    if (normalized === 'vehicle') return 'Vehicle';
    if (normalized === 'material') return 'Material';
    return 'Equipment';
  }

  private toBackendResourceType(type: ResourceItem['type']): string {
    const map: Record<ResourceItem['type'], string> = {
      Equipment: 'equipment',
      Material: 'material',
      Vehicle: 'vehicle',
    };
    return map[type];
  }

  private toOrderStatus(status?: string): PurchaseOrder['status'] {
    const normalized = String(status ?? '').toLowerCase();
    if (normalized === 'approved' || normalized === 'ordered') return 'Approved';
    if (normalized === 'delivered') return 'Delivered';
    if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
    return 'Pending';
  }

  private toBackendOrderStatus(status: PurchaseOrder['status']): string {
    const map: Record<PurchaseOrder['status'], string> = {
      Pending: 'pending',
      Approved: 'approved',
      Delivered: 'delivered',
      Cancelled: 'cancelled',
    };
    return map[status];
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

  private toIsoDate(value?: string): string {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date(`${value}T00:00:00`).toISOString() : date.toISOString();
  }

  private formatTime(value?: string): string | undefined {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private toDateTime(dateValue: string, timeValue: string): string {
    const parsed = new Date(`${dateValue} ${timeValue}`);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private splitFullName(name: string): { firstName: string; lastName: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
      return { firstName: parts[0] || 'Worker', lastName: '-' };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  private emailFromContact(worker: Worker): string {
    if (worker.contact.includes('@')) {
      return worker.contact;
    }
    return `${worker.id || worker.name.replace(/\W+/g, '.').toLowerCase()}@buildtrack.local`;
  }
}
import {
  AttendanceRecord,
  AttendanceStatus,
  InventoryItem,
  Milestone,
  Project,
  ProjectStatus,
  PurchaseOrder,
  ResourceItem,
  ResourceStatus,
  StockStatus,
  Worker,
} from '../models/models';

type AnyRecord = Record<string, unknown>;

export function idOf(item: AnyRecord): string {
  return String(item['_id'] ?? item['id'] ?? crypto.randomUUID());
}

export function formatDisplayDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

export function toIsoDate(value: string): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(value + 'T00:00:00').toISOString() : parsed.toISOString();
}

export function toProjectStatus(status?: string): ProjectStatus {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'active' || normalized === 'in_progress' || normalized === 'in progress') return 'In Progress';
  if (normalized === 'on_hold' || normalized === 'on hold') return 'On Hold';
  if (normalized === 'completed') return 'Completed';
  return 'Not Started';
}

export function toBackendProjectStatus(status: ProjectStatus): string {
  const map: Record<ProjectStatus, string> = {
    'Not Started': 'planning',
    'In Progress': 'active',
    'On Hold': 'on_hold',
    Completed: 'completed',
  };
  return map[status];
}

export function progressFromStatus(status?: string): number {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'completed') return 100;
  if (normalized === 'active' || normalized === 'in_progress') return 50;
  return 0;
}

export function toMilestoneStatus(status?: string): ProjectStatus {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'in_progress') return 'In Progress';
  return 'Not Started';
}

export function toProject(item: AnyRecord, managerName?: string): Project {
  const status = toProjectStatus(String(item['status'] ?? ''));
  return {
    id: idOf(item),
    name: String(item['name'] ?? 'Untitled Project'),
    category: (item['category'] as Project['category']) ?? 'Commercial',
    managerId: String(item['project_manager_id'] ?? item['managerId'] ?? ''),
    manager: managerName ?? String(item['manager'] ?? item['project_manager_name'] ?? 'Unassigned'),
    status,
    progress: Number(item['progress'] ?? progressFromStatus(String(item['status'] ?? ''))),
    startDate: formatDisplayDate(String(item['start_date'] ?? item['startDate'] ?? '')),
    endDate: formatDisplayDate(String(item['end_date'] ?? item['endDate'] ?? '')),
    budget: Number(item['budget'] ?? 0),
    client: item['client'] as string | undefined,
    location: item['location'] as string | undefined,
  };
}

export function toMilestone(item: AnyRecord, projectId: string): Milestone {
  const status = toMilestoneStatus(String(item['status'] ?? ''));
  return {
    id: idOf(item),
    projectId,
    title: String(item['title'] ?? 'Milestone'),
    progress: status === 'Completed' ? 100 : status === 'In Progress' ? 50 : 0,
    dueDate: formatDisplayDate(String(item['due_date'] ?? item['dueDate'] ?? '')),
    status,
  };
}

export function toInventoryItem(item: AnyRecord): InventoryItem {
  const qty = Number(item['quantity'] ?? item['stock'] ?? 0);
  let status = toStockStatus(String(item['status'] ?? ''));
  const reorder = Number(item['reorder_level'] ?? 10);

  if (qty <= 0) status = 'Out of Stock';
  else if (qty <= reorder) status = 'Low Stock';

  return {
    id: idOf(item),
    itemName: String(item['material_name'] ?? item['itemName'] ?? 'Unnamed Item'),
    category: (item['category'] as InventoryItem['category']) ?? 'Construction',
    unit: String(item['unit'] ?? 'Nos'),
    stock: qty,
    status,
  };
}

export function toStockStatus(status?: string): StockStatus {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'low_stock' || normalized === 'low stock') return 'Low Stock';
  if (normalized === 'out_of_stock' || normalized === 'out of stock') return 'Out of Stock';
  return 'In Stock';
}

export function toBackendStockStatus(status: StockStatus): string {
  const map: Record<StockStatus, string> = {
    'In Stock': 'in_stock',
    'Low Stock': 'low_stock',
    'Out of Stock': 'out_of_stock',
  };
  return map[status];
}

export function toWorker(item: AnyRecord): Worker {
  const first = String(item['first_name'] ?? '');
  const last = String(item['last_name'] ?? '');
  const name = String(item['name'] ?? (`${first} ${last}`.trim() || 'Unnamed Worker'));
  const backendStatus = String(item['status'] ?? 'available').toLowerCase();

  return {
    id: idOf(item),
    name,
    role: String(item['role'] ?? item['skill_type'] ?? 'Worker'),
    skillType: String(item['skillType'] ?? item['skill_type'] ?? 'General'),
    contact: String(item['contact'] ?? item['phone'] ?? item['email'] ?? ''),
    assignedProjectId: (item['assignedProjectId'] ?? item['project_id']) as string | undefined,
    attendancePct: Number(item['attendancePct'] ?? 0),
    status: backendStatus === 'unavailable' ? 'Inactive' : 'Active',
    avatarUrl: String(item['avatarUrl'] ?? `https://i.pravatar.cc/64?u=${idOf(item)}`),
  };
}

export function toResource(item: AnyRecord): ResourceItem {
  return {
    id: idOf(item),
    name: String(item['resource_name'] ?? item['name'] ?? 'Unnamed Resource'),
    type: toResourceType(String(item['resource_type'] ?? item['type'] ?? '')),
    quantity: Number(item['quantity'] ?? 1),
    unit: String(item['unit'] ?? 'Nos'),
    status: toResourceStatus(String(item['status'] ?? '')),
    allocatedProjectId: (item['assigned_project'] ?? item['allocatedProjectId']) as string | undefined,
  };
}

export function toResourceStatus(status?: string): ResourceStatus {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'in_use' || normalized === 'in use') return 'In Use';
  if (normalized === 'maintenance' || normalized === 'under maintenance') return 'Under Maintenance';
  return 'Available';
}

export function toBackendResourceStatus(status: ResourceStatus): string {
  const map: Record<ResourceStatus, string> = {
    Available: 'available',
    'In Use': 'in_use',
    'Under Maintenance': 'maintenance',
  };
  return map[status];
}

export function toResourceType(type?: string): ResourceItem['type'] {
  const normalized = String(type ?? '').toLowerCase();
  if (normalized.includes('vehicle')) return 'Vehicle';
  if (normalized.includes('material')) return 'Material';
  return 'Equipment';
}

export function toBackendResourceType(type: ResourceItem['type']): string {
  const map: Record<ResourceItem['type'], string> = {
    Equipment: 'equipment',
    Material: 'material',
    Vehicle: 'vehicle',
  };
  return map[type];
}

export function toPurchaseOrder(item: AnyRecord, index = 0): PurchaseOrder {
  const items = Array.isArray(item['items']) ? item['items'] : [];
  const itemsSummary =
    String(item['itemsSummary'] ?? '') ||
    items.map((entry: AnyRecord) => entry['item_name'] ?? entry['name']).filter(Boolean).join(', ');

  return {
    id: idOf(item),
    poNo: String(item['poNo'] ?? `PO${1234 + index}`),
    supplier: String(item['supplier'] ?? item['vendor_id'] ?? 'Supplier'),
    itemsSummary: itemsSummary || 'Procurement request',
    amount: Number(item['amount'] ?? item['total_amount'] ?? 0),
    status: toOrderStatus(String(item['status'] ?? '')),
    requestDate: formatDisplayDate(String(item['request_date'] ?? item['requestDate'] ?? '')),
  };
}

export function toOrderStatus(status?: string): PurchaseOrder['status'] {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'approved' || normalized === 'ordered') return 'Approved';
  if (normalized === 'delivered') return 'Delivered';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'Cancelled';
  return 'Pending';
}

export function toBackendOrderStatus(status: PurchaseOrder['status']): string {
  const map: Record<PurchaseOrder['status'], string> = {
    Pending: 'pending',
    Approved: 'approved',
    Delivered: 'delivered',
    Cancelled: 'cancelled',
  };
  return map[status];
}

export function toAttendance(item: AnyRecord, workerName?: string): AttendanceRecord {
  const normalized = String(item['status'] ?? '').toLowerCase();
  let status: AttendanceStatus = 'Absent';
  if (normalized === 'present') status = 'Present';
  else if (normalized === 'leave' || normalized === 'on leave') status = 'On Leave';

  return {
    id: idOf(item),
    workerId: String(item['worker_id'] ?? item['workerId'] ?? ''),
    workerName: workerName ?? String(item['workerName'] ?? item['worker_name'] ?? 'Worker'),
    role: String(item['role'] ?? 'Worker'),
    date: formatDisplayDate(String(item['date'] ?? '')),
    checkIn: formatTime(String(item['check_in_time'] ?? item['checkIn'] ?? '')),
    checkOut: formatTime(String(item['check_out_time'] ?? item['checkOut'] ?? '')),
    status,
  };
}

function formatTime(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.length <= 5 ? value : undefined;
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function toBackendWorkerStatus(status: Worker['status']): string {
  return status === 'Inactive' ? 'unavailable' : 'available';
}

export function splitFullName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '-' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(count: number, pageSize: number): number {
  return Math.max(1, Math.ceil(count / pageSize));
}

export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as { error?: { detail?: string | { msg?: string }[] }; message?: string };
    const detail = err.error?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
    if (err.message) return err.message;
  }
  return 'Something went wrong. Please try again.';
}
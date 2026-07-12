/**
 * These interfaces mirror the MongoDB collections listed in
 * MILESTONE_1_CHECKPOINT.md (users, projects, project_milestones, resources,
 * inventory, workers, attendance, procurements, notifications, reports).
 * Mongo documents use string _id values, so `id` is typed as string
 * throughout — swap MockDataService for real HttpClient calls against the
 * FastAPI + MongoDB backend without touching these shapes.
 */

export type UserRole =
  | 'Administrator'
  | 'Project Manager'
  | 'Site Engineer'
  | 'Contractor'
  | 'Worker'
  | 'Client';

export type UserStatus = 'Active' | 'Pending' | 'Suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  avatarUrl?: string;
}

export type ProjectStatus = 'In Progress' | 'On Hold' | 'Not Started' | 'Completed';

/** Maps to the `projects` collection. */
export interface Project {
  id: string;
  name: string;
  category: 'Residential' | 'Commercial' | 'Industrial' | 'Infrastructure' | 'Government';
  managerId: string;
  manager: string;
  status: ProjectStatus;
  progress: number;
  startDate: string;
  endDate?: string;
  budget?: number;
  client?: string;
  location?: string;
}

/** Maps to the `project_milestones` collection. */
export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  progress: number;
  dueDate: string;
  status: ProjectStatus;
}

export interface TeamMember {
  userId: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

export type ResourceStatus = 'Available' | 'In Use' | 'Under Maintenance';

/** Maps to the `resources` collection. */
export interface ResourceItem {
  id: string;
  name: string;
  type: 'Equipment' | 'Material' | 'Vehicle';
  quantity: number;
  unit: string;
  status: ResourceStatus;
  allocatedProjectId?: string;
}

export type StockStatus = 'In Stock' | 'Low Stock' | 'Out of Stock';

/** Maps to the `inventory` collection. */
export interface InventoryItem {
  id: string;
  itemName: string;
  category: 'Construction' | 'Finishing' | 'Electrical' | 'Plumbing';
  unit: string;
  stock: number;
  status: StockStatus;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'On Leave';

/** Maps to the `workers` collection. */
export interface Worker {
  id: string;
  name: string;
  role: string;
  skillType: string;
  contact: string;
  assignedProjectId?: string;
  attendancePct: number;
  status: 'Active' | 'Inactive';
  avatarUrl?: string;
}

/** Maps to the `attendance` collection. */
export interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  role: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
}

export type OrderStatus = 'Approved' | 'Pending' | 'Delivered' | 'Cancelled';

/** Maps to the `procurements` collection. */
export interface PurchaseOrder {
  id: string;
  poNo: string;
  supplier: string;
  itemsSummary: string;
  amount: number;
  status: OrderStatus;
  requestDate: string;
}

/** Maps to the `notifications` collection (not yet surfaced in the UI). */
export interface AppNotification {
  id: string;
  receiverId: string;
  message: string;
  type: 'Info' | 'Warning' | 'Alert';
  read: boolean;
  createdAt: string;
}

/** Maps to the `reports` collection. */
export interface Report {
  id: string;
  type: 'Budget' | 'Progress' | 'Resource' | 'Procurement';
  generatedBy: string;
  projectId?: string;
  createdAt: string;
}

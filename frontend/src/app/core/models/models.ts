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
  | 'Store Manager'
  | 'Finance'
  | 'Contractor'
  | 'Worker'
  | 'Client'
  | 'Vendor';

export type UserStatus = 'Active' | 'Pending' | 'Suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status?: UserStatus;
  avatarUrl?: string;
  vendorId?: string;
  workerId?: string;
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

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  owner?: string;
  status: 'Pending' | 'Completed';
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  type: string;
  uploadedAt: string;
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
  shiftWindow?: string;
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

export type Priority = 'low' | 'medium' | 'high';
export type MaterialRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'vendor_assigned'
  | 'sent_to_vendor'
  | 'vendor_accepted'
  | 'vendor_rejected'
  | 'po_generated'
  | 'po_sent'
  | 'po_accepted'
  | 'partially_delivered'
  | 'delivered'
  | 'invoice_pending'
  | 'invoice_verified'
  | 'payment_pending'
  | 'paid'
  | 'completed';
export type VendorStatus = 'active' | 'inactive';
export type POStatus = 'created' | 'sent' | 'accepted' | 'delivered';
export type QualityStatus = 'pending' | 'passed' | 'failed';
export type DeliveryStatus = 'pending' | 'partial' | 'accepted' | 'rejected';
export type InvoiceStatus = 'pending' | 'verified' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'approved' | 'paid';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export interface MaterialRequest {
  _id?: string;
  id?: string;
  request_id?: string;
  project: string;
  project_id?: string;
  material_name: string;
  material_id?: string;
  unit?: string;
  quantity: number;
  required_date: string;
  priority: Priority;
  status: MaterialRequestStatus;
  vendor_id?: string;
  assigned_vendor_id?: string;
  vendor_name?: string;
  vendor_assigned_by?: string;
  vendor_assigned_at?: string;
  vendor_response?: 'accept' | 'reject' | null;
  vendor_response_date?: string;
  vendor_comment?: string;
  rejection_reason?: string;
  purchase_order_id?: string;
  po_number?: string;
  remarks?: string;
  requested_by?: string;
  approval_comments?: string;
  approved_by?: string;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
}
export interface MaterialItem {
  _id?: string;
  id?: string;
  material: string;
  material_name?: string;
  available_stock: number;
  unit?: string;
  status?: string;
}



export interface Vendor {
  _id?: string;
  id?: string;
  vendor_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  gst_number?: string;
  pan_number?: string;
  materials_supplied: string[];
  rating: number;
  status: VendorStatus;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrderRecord {
  _id?: string;
  id?: string;
  po_number?: string;
  request_id: string;
  vendor_id: string;
  project: string;
  materials: string;
  quantity: number;
  unit_price: number;
  subtotal?: number;
  gst?: number;
  total_cost?: number;
  expected_delivery_date: string;
  status: POStatus | string;
  rejection_reason?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialDelivery {
  _id?: string;
  id?: string;
  purchase_order_id: string;
  po_number?: string;
  vendor_id?: string;
  material: string;
  quantity_received: number;
  quality_status: QualityStatus | string;
  delivery_date: string;
  dispatch_date?: string;
  vehicle_number?: string;
  tracking_number?: string;
  remarks?: string;
  status: DeliveryStatus | string;
  created_at?: string;
  updated_at?: string;
}

export interface ProcurementInventoryItem {
  _id?: string;
  id?: string;
  material: string;
  stock_quantity: number;
  transactions?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  _id?: string;
  id?: string;
  invoice_number: string;
  vendor_id: string;
  purchase_order_id: string;
  amount: number;
  gst: number;
  invoice_date: string;
  payment_status: PaymentStatus;
  attachment_url?: string;
  status: InvoiceStatus;
  verification_comments?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  _id?: string;
  id?: string;
  invoice_id: string;
  vendor_id: string;
  purchase_order_id: string;
  amount: number;
  status: PaymentStatus;
  paid_at?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface VendorDashboardStats {
  vendor?: Vendor | null;
  total_assigned: number;
  pending_responses: number;
  accepted_requests: number;
  rejected_requests: number;
  total_purchase_orders: number;
  pending_orders: number;
  accepted_orders: number;
  delivered_orders: number;
  pending_deliveries: number;
  pending_invoices: number;
  pending_payments: number;
  requests: MaterialRequest[];
  purchase_orders: PurchaseOrderRecord[];
  deliveries?: MaterialDelivery[];
  invoices?: Invoice[];
  recent_notifications?: any[];
}

export interface ProcurementActivityItem {
  id?: string;
  _id?: string;
  type?: string;
  title: string;
  description: string;
  timestamp?: string;
  created_at?: string;
  user_name?: string;
  action?: string;
  entity?: string;
  icon?: string;
  color?: string;
}

export interface ProcurementDashboardStats {
  pending_requests: number;
  active_purchase_orders: number;
  pending_deliveries: number;
  pending_payments: number;
  recent_activity: ProcurementActivityItem[];
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

export type NotificationCategory =
  | 'project_update'
  | 'task_assignment'
  | 'procurement_alert'
  | 'attendance_alert'
  | 'deadline'
  | 'system';

/** Maps to the `notifications` collection. */
export interface NotificationItem {
  _id?: string;
  id?: string;
  user_id?: string;
  receiver_id?: string;
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'alert' | 'success';
  category: NotificationCategory | string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
  updated_at?: string;
  read_at?: string;
}

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
import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Invoice,
  MaterialDelivery,
  MaterialRequest,
  Payment,
  ProcurementDashboardStats,
  ProcurementInventoryItem,
  PurchaseOrderRecord,
  Vendor,
} from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationService } from '../../core/services/notification.service';
import { ProcurementService } from '../../core/services/procurement.service';

export type ProcurementTab =
  | 'dashboard'
  | 'requests'
  | 'approvals'
  | 'vendors'
  | 'purchase-orders'
  | 'deliveries'
  | 'inventory'
  | 'invoices'
  | 'payments';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './procurement.component.html',
  styleUrl: './procurement.component.scss',
})
export class ProcurementComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  activeTab = signal<ProcurementTab>('dashboard');
  loading = signal(false);
  error = signal('');
  success = signal('');

  // Search, Filter, Pagination, Sorting
  searchTerm = signal('');
  statusFilter = signal('');
  priorityFilter = signal('');
  pageIndex = signal(1);
  pageSize = signal(10);
  totalItems = signal(0);
  sortBy = signal('created_at');
  sortDir = signal<'asc' | 'desc'>('desc');

  // Modals & Selections
  modal = signal<ProcurementTab | 'approval' | 'invoice_action' | null>(null);
  selectedItem = signal<any | null>(null);

  // Data signals
  dashboardStats = signal<ProcurementDashboardStats | null>(null);
  requests = signal<MaterialRequest[]>([]);
  approvedRequests = signal<MaterialRequest[]>([]);
  vendors = signal<Vendor[]>([]);
  purchaseOrders = signal<PurchaseOrderRecord[]>([]);
  deliveries = signal<MaterialDelivery[]>([]);
  inventoryItems = signal<ProcurementInventoryItem[]>([]);
  invoices = signal<Invoice[]>([]);
  payments = signal<Payment[]>([]);

  // File Upload
  uploadedAttachmentUrl = signal<string>('');
  uploadingFile = signal<boolean>(false);

  // User Role checks
  currentUser = computed(() => this.authService.currentUser());
  userRole = computed(() => this.currentUser()?.role || 'Administrator');

  isAdmin = computed(() => ['Administrator', 'Admin', 'admin'].includes(this.userRole()));
  isProjectManager = computed(() => ['Project Manager', 'manager'].includes(this.userRole()) || this.isAdmin());
  isSiteEngineer = computed(() => ['Site Engineer', 'engineer'].includes(this.userRole()) || this.isAdmin() || this.isProjectManager());
  isStoreManager = computed(() => ['Store Manager', 'store_manager', 'store manager'].includes(this.userRole()) || this.isAdmin());
  isFinance = computed(() => ['Finance', 'finance'].includes(this.userRole()) || this.isAdmin());

  // Forms
  requestForm = this.fb.group({
    project: ['', [Validators.required, Validators.minLength(2)]],
    material_name: ['', [Validators.required, Validators.minLength(2)]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    required_date: ['', Validators.required],
    priority: ['medium' as 'low' | 'medium' | 'high', Validators.required],
    remarks: [''],
  });

  approvalForm = this.fb.group({
    status: ['approved' as 'approved' | 'rejected', Validators.required],
    comments: [''],
  });

  vendorForm = this.fb.group({
    vendor_name: ['', [Validators.required, Validators.minLength(2)]],
    contact_person: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.minLength(7)]],
    email: ['', [Validators.required, Validators.email]],
    address: ['', [Validators.required, Validators.minLength(2)]],
    materials_supplied: ['', Validators.required], // Comma-separated string in form
    rating: [4.0, [Validators.min(0), Validators.max(5)]],
    status: ['active' as 'active' | 'inactive', Validators.required],
  });

  purchaseForm = this.fb.group({
    request_id: ['', Validators.required],
    vendor_id: ['', Validators.required],
    project: ['', Validators.required],
    materials: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit_price: [0, [Validators.required, Validators.min(0)]],
    expected_delivery_date: ['', Validators.required],
    status: ['created' as 'created' | 'sent' | 'accepted' | 'delivered', Validators.required],
  });

  deliveryForm = this.fb.group({
    purchase_order_id: ['', Validators.required],
    material: ['', Validators.required],
    quantity_received: [1, [Validators.required, Validators.min(0.01)]],
    quality_status: ['passed' as 'pending' | 'passed' | 'failed', Validators.required],
    delivery_date: [new Date().toISOString().slice(0, 10), Validators.required],
    status: ['accepted' as 'pending' | 'partial' | 'accepted' | 'rejected', Validators.required],
    remarks: [''],
  });

  invoiceForm = this.fb.group({
    invoice_number: ['', [Validators.required, Validators.minLength(2)]],
    vendor_id: ['', Validators.required],
    purchase_order_id: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    gst: [0, [Validators.min(0)]],
    invoice_date: [new Date().toISOString().slice(0, 10), Validators.required],
    payment_status: ['pending' as 'pending' | 'approved' | 'paid', Validators.required],
    attachment_url: [''],
    status: ['pending' as 'pending' | 'verified' | 'approved' | 'rejected', Validators.required],
  });

  invoiceActionForm = this.fb.group({
    action: ['verify' as 'verify' | 'approve' | 'reject', Validators.required],
    comments: [''],
  });

  paymentForm = this.fb.group({
    invoice_id: ['', Validators.required],
    vendor_id: ['', Validators.required],
    purchase_order_id: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0)]],
    status: ['pending' as 'pending' | 'approved' | 'paid', Validators.required],
    remarks: [''],
  });

  constructor(
    private readonly procurementService: ProcurementService,
    private readonly authService: AuthService,
    private readonly notificationService: NotificationService,
    private readonly confirmService: ConfirmService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const url = this.router.url;
    if (url.includes('/dashboard')) this.activeTab.set('dashboard');
    else if (url.includes('/material-requests') || url.includes('/request')) this.activeTab.set('requests');
    else if (url.includes('/vendors')) this.activeTab.set('vendors');
    else if (url.includes('/purchase-orders')) this.activeTab.set('purchase-orders');
    else if (url.includes('/deliveries')) this.activeTab.set('deliveries');
    else if (url.includes('/inventory')) this.activeTab.set('inventory');
    else if (url.includes('/invoices')) this.activeTab.set('invoices');
    else if (url.includes('/payments')) this.activeTab.set('payments');
    else this.activeTab.set('dashboard');

    this.loadData();
  }

  setTab(tab: ProcurementTab): void {
    this.activeTab.set(tab);
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.priorityFilter.set('');
    this.pageIndex.set(1);
    this.loadData();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.pageIndex.set(1);
    this.loadData();
  }

  onFilterStatus(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(val);
    this.pageIndex.set(1);
    this.loadData();
  }

  onFilterPriority(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.priorityFilter.set(val);
    this.pageIndex.set(1);
    this.loadData();
  }

  toggleSort(field: string): void {
    if (this.sortBy() === field) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDir.set('desc');
    }
    this.loadData();
  }

  prevPage(): void {
    if (this.pageIndex() > 1) {
      this.pageIndex.update((p) => p - 1);
      this.loadData();
    }
  }

  nextPage(): void {
    if (this.pageIndex() * this.pageSize() < this.totalItems()) {
      this.pageIndex.update((p) => p + 1);
      this.loadData();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems() / this.pageSize()) || 1;
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');

    const skip = (this.pageIndex() - 1) * this.pageSize();
    const limit = this.pageSize();
    const query = {
      skip,
      limit,
      search: this.searchTerm() || undefined,
      status_filter: this.statusFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      sort_by: this.sortBy(),
      sort_dir: this.sortDir(),
    };

    switch (this.activeTab()) {
      case 'dashboard':
        this.procurementService.getDashboardStats().subscribe({
          next: (stats) => {
            this.dashboardStats.set(stats);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load dashboard statistics', err),
        });
        break;

      case 'requests':
      case 'approvals':
        this.procurementService.getMaterialRequests(query).subscribe({
          next: (res) => {
            this.requests.set(res.items);
            this.totalItems.set(res.total);
            this.approvedRequests.set(res.items.filter((r) => r.status === 'approved'));
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load material requests', err),
        });
        break;

      case 'vendors':
        this.procurementService.getVendors(query).subscribe({
          next: (res) => {
            this.vendors.set(res.items);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load vendors', err),
        });
        break;

      case 'purchase-orders':
        this.procurementService.getPurchaseOrders(query).subscribe({
          next: (res) => {
            this.purchaseOrders.set(res.items);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load purchase orders', err),
        });
        // Also fetch vendors & approved material requests for dropdown options
        this.procurementService.getVendors({ limit: 100 }).subscribe((v) => this.vendors.set(v.items));
        this.procurementService
          .getMaterialRequests({ limit: 100, status_filter: 'approved' })
          .subscribe((r) => this.approvedRequests.set(r.items));
        break;

      case 'deliveries':
        this.procurementService.getDeliveries(query).subscribe({
          next: (res) => {
            this.deliveries.set(res.items);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load material deliveries', err),
        });
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe((p) => this.purchaseOrders.set(p.items));
        break;

      case 'inventory':
        this.procurementService.getInventory(query).subscribe({
          next: (res) => {
            this.inventoryItems.set(res.items);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load inventory', err),
        });
        break;

      case 'invoices':
        this.procurementService.getInvoices(query).subscribe({
          next: (res) => {
            this.invoices.set(res.items);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load invoices', err),
        });
        this.procurementService.getVendors({ limit: 100 }).subscribe((v) => this.vendors.set(v.items));
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe((p) => this.purchaseOrders.set(p.items));
        break;

      case 'payments':
        this.procurementService.getPayments(query).subscribe({
          next: (res) => {
            this.payments.set(res.items);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load payments', err),
        });
        this.procurementService.getInvoices({ limit: 100 }).subscribe((i) => this.invoices.set(i.items));
        break;

      default:
        this.loading.set(false);
    }
  }

  // --- Modal Helpers ---
  openAddModal(tab: ProcurementTab): void {
    this.selectedItem.set(null);
    this.resetForm(tab);
    this.modal.set(tab);
  }

  openEditModal(tab: ProcurementTab, item: any): void {
    this.selectedItem.set(item);
    this.patchForm(tab, item);
    this.modal.set(tab);
  }

  openApprovalModal(request: MaterialRequest): void {
    this.selectedItem.set(request);
    this.approvalForm.reset({ status: 'approved', comments: '' });
    this.modal.set('approval');
  }

  openInvoiceActionModal(invoice: Invoice, action: 'verify' | 'approve' | 'reject'): void {
    this.selectedItem.set(invoice);
    this.invoiceActionForm.reset({ action, comments: '' });
    this.modal.set('invoice_action');
  }

  openDetailsModal(item: any): void {
    this.selectedItem.set(item);
  }

  closeModal(): void {
    this.modal.set(null);
    this.uploadedAttachmentUrl.set('');
  }

  closeDetailsModal(): void {
    this.selectedItem.set(null);
  }

  // --- Actions ---

  saveMaterialRequest(): void {
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    const val = this.requestForm.getRawValue();
    const payload: Partial<MaterialRequest> = {
      project: val.project!,
      material_name: val.material_name!,
      quantity: Number(val.quantity),
      required_date: new Date(val.required_date!).toISOString(),
      priority: val.priority!,
      remarks: val.remarks || undefined,
    };

    const current = this.selectedItem();
    if (current && current._id) {
      this.procurementService.updateMaterialRequest(current._id, payload).subscribe({
        next: () => this.handleSuccess('Material request updated successfully'),
        error: (err) => this.handleError('Failed to update material request', err),
      });
    } else {
      this.procurementService.createMaterialRequest(payload).subscribe({
        next: () => this.handleSuccess('Material request created successfully'),
        error: (err) => this.handleError('Failed to create material request', err),
      });
    }
  }

  submitApproval(): void {
    if (this.approvalForm.invalid) return;
    const current = this.selectedItem();
    if (!current || !current._id) return;

    const val = this.approvalForm.getRawValue();
    this.procurementService
      .approveMaterialRequest(current._id, {
        status: val.status!,
        comments: val.comments || undefined,
      })
      .subscribe({
        next: () => this.handleSuccess(`Material request ${val.status} successfully`),
        error: (err) => this.handleError('Failed to update request approval', err),
      });
  }

  saveVendor(): void {
    if (this.vendorForm.invalid) {
      this.vendorForm.markAllAsTouched();
      return;
    }
    const val = this.vendorForm.getRawValue();
    const materialsArray = val
      .materials_supplied!.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload: Partial<Vendor> = {
      vendor_name: val.vendor_name!,
      contact_person: val.contact_person!,
      phone: val.phone!,
      email: val.email!,
      address: val.address!,
      materials_supplied: materialsArray,
      rating: Number(val.rating ?? 4.0),
      status: val.status!,
    };

    const current = this.selectedItem();
    if (current && current._id) {
      this.procurementService.updateVendor(current._id, payload).subscribe({
        next: () => this.handleSuccess('Vendor updated successfully'),
        error: (err) => this.handleError('Failed to update vendor', err),
      });
    } else {
      this.procurementService.createVendor(payload).subscribe({
        next: () => this.handleSuccess('Vendor added successfully'),
        error: (err) => this.handleError('Failed to add vendor', err),
      });
    }
  }

  onMaterialRequestSelectForPO(event: Event): void {
    const reqId = (event.target as HTMLSelectElement).value;
    const selectedReq = this.approvedRequests().find((r) => r._id === reqId || r.request_id === reqId);
    if (selectedReq) {
      this.purchaseForm.patchValue({
        project: selectedReq.project,
        materials: selectedReq.material_name,
        quantity: selectedReq.quantity,
      });
    }
  }

  savePurchaseOrder(): void {
    if (this.purchaseForm.invalid) {
      this.purchaseForm.markAllAsTouched();
      return;
    }
    const val = this.purchaseForm.getRawValue();
    const payload: Partial<PurchaseOrderRecord> = {
      request_id: val.request_id!,
      vendor_id: val.vendor_id!,
      project: val.project!,
      materials: val.materials!,
      quantity: Number(val.quantity),
      unit_price: Number(val.unit_price),
      expected_delivery_date: new Date(val.expected_delivery_date!).toISOString(),
      status: val.status!,
    };

    const current = this.selectedItem();
    if (current && current._id) {
      this.procurementService.updatePurchaseOrder(current._id, payload).subscribe({
        next: () => this.handleSuccess('Purchase order updated successfully'),
        error: (err) => this.handleError('Failed to update purchase order', err),
      });
    } else {
      this.procurementService.createPurchaseOrder(payload).subscribe({
        next: () => this.handleSuccess('Purchase order created successfully'),
        error: (err) => this.handleError('Failed to create purchase order', err),
      });
    }
  }

  downloadPDF(po: PurchaseOrderRecord): void {
    if (!po._id) return;
    this.procurementService.downloadPOPDF(po._id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${po.po_number || 'PO'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.notificationService.success('PDF downloaded successfully');
      },
      error: (err) => this.handleError('Failed to download PO PDF', err),
    });
  }

  saveDelivery(): void {
    if (this.deliveryForm.invalid) {
      this.deliveryForm.markAllAsTouched();
      return;
    }
    const val = this.deliveryForm.getRawValue();
    const payload: Partial<MaterialDelivery> = {
      purchase_order_id: val.purchase_order_id!,
      material: val.material!,
      quantity_received: Number(val.quantity_received),
      quality_status: val.quality_status!,
      delivery_date: new Date(val.delivery_date!).toISOString(),
      status: val.status!,
      remarks: val.remarks || undefined,
    };

    const current = this.selectedItem();
    if (current && current._id) {
      this.procurementService.updateDelivery(current._id, payload).subscribe({
        next: () => this.handleSuccess('Delivery record updated'),
        error: (err) => this.handleError('Failed to update delivery', err),
      });
    } else {
      this.procurementService.createDelivery(payload).subscribe({
        next: () => this.handleSuccess('Delivery recorded & inventory updated'),
        error: (err) => this.handleError('Failed to record delivery', err),
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    this.uploadingFile.set(true);
    this.procurementService.uploadInvoiceAttachment(file).subscribe({
      next: (res) => {
        this.uploadingFile.set(false);
        this.uploadedAttachmentUrl.set(res.attachment_url);
        this.invoiceForm.patchValue({ attachment_url: res.attachment_url });
        this.notificationService.success('Attachment uploaded successfully');
      },
      error: (err) => {
        this.uploadingFile.set(false);
        this.handleError('Failed to upload file attachment', err);
      },
    });
  }

  saveInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      return;
    }
    const val = this.invoiceForm.getRawValue();
    const payload: Partial<Invoice> = {
      invoice_number: val.invoice_number!,
      vendor_id: val.vendor_id!,
      purchase_order_id: val.purchase_order_id!,
      amount: Number(val.amount),
      gst: Number(val.gst ?? 0),
      invoice_date: new Date(val.invoice_date!).toISOString(),
      payment_status: val.payment_status!,
      attachment_url: this.uploadedAttachmentUrl() || val.attachment_url || undefined,
      status: val.status!,
    };

    const current = this.selectedItem();
    if (current && current._id) {
      this.procurementService.updateInvoice(current._id, payload).subscribe({
        next: () => this.handleSuccess('Invoice updated successfully'),
        error: (err) => this.handleError('Failed to update invoice', err),
      });
    } else {
      this.procurementService.createInvoice(payload).subscribe({
        next: () => this.handleSuccess('Invoice created successfully'),
        error: (err) => this.handleError('Failed to create invoice', err),
      });
    }
  }

  submitInvoiceAction(): void {
    if (this.invoiceActionForm.invalid) return;
    const current = this.selectedItem();
    if (!current || !current._id) return;

    const val = this.invoiceActionForm.getRawValue();
    this.procurementService
      .invoiceAction(current._id, val.action!, { comments: val.comments || undefined })
      .subscribe({
        next: () => this.handleSuccess(`Invoice status set to ${val.action}`),
        error: (err) => this.handleError('Failed to process invoice action', err),
      });
  }

  savePayment(): void {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      return;
    }
    const val = this.paymentForm.getRawValue();
    const payload: Partial<Payment> = {
      invoice_id: val.invoice_id!,
      vendor_id: val.vendor_id!,
      purchase_order_id: val.purchase_order_id!,
      amount: Number(val.amount),
      status: val.status!,
      remarks: val.remarks || undefined,
    };

    const current = this.selectedItem();
    if (current && current._id) {
      this.procurementService.updatePayment(current._id, payload).subscribe({
        next: () => this.handleSuccess('Payment record updated'),
        error: (err) => this.handleError('Failed to update payment', err),
      });
    } else {
      this.procurementService.createPayment(payload).subscribe({
        next: () => this.handleSuccess('Payment recorded successfully'),
        error: (err) => this.handleError('Failed to record payment', err),
      });
    }
  }

  deleteItem(tab: ProcurementTab, id: string, label: string): void {
    this.confirmService
      .confirm(
        'Are you sure you want to delete this record? This action cannot be undone.',
        `Delete ${label}?`,
        'Delete',
        'Cancel'
      )
      .then((confirmed) => {
        if (!confirmed) return;

        let deleteObs: any;
        if (tab === 'requests') deleteObs = this.procurementService.deleteMaterialRequest(id);
        else if (tab === 'vendors') deleteObs = this.procurementService.deleteVendor(id);
        else if (tab === 'purchase-orders') deleteObs = this.procurementService.deletePurchaseOrder(id);

        if (deleteObs) {
          deleteObs.subscribe({
            next: () => this.handleSuccess(`${label} deleted successfully`),
            error: (err: any) => this.handleError(`Failed to delete ${label}`, err),
          });
        }
      });
  }

  // --- Display & Helper Functions ---
  vendorName(vendorId?: string): string {
    if (!vendorId) return '-';
    const v = this.vendors().find((item) => item._id === vendorId || item.id === vendorId);
    return v ? v.vendor_name : vendorId;
  }

  poNumber(poId?: string): string {
    if (!poId) return '-';
    const p = this.purchaseOrders().find((item) => item._id === poId || item.id === poId);
    return p ? p.po_number || poId : poId;
  }

  statusBadgeClass(status?: string): string {
    if (!status) return 'badge-secondary';
    const lower = status.toLowerCase();
    if (['approved', 'passed', 'accepted', 'completed', 'paid', 'verified'].includes(lower)) return 'badge-green';
    if (['created', 'sent', 'partial', 'medium'].includes(lower)) return 'badge-blue';
    if (['pending', 'low'].includes(lower)) return 'badge-amber';
    if (['rejected', 'failed', 'cancelled', 'high'].includes(lower)) return 'badge-red';
    return 'badge-secondary';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString();
  }

  private handleSuccess(message: string): void {
    this.notificationService.success(message);
    this.success.set(message);
    this.closeModal();
    this.closeDetailsModal();
    this.loadData();
    setTimeout(() => this.success.set(''), 3000);
  }

  private handleError(context: string, err: any): void {
    this.loading.set(false);
    const detail = err?.error?.detail || err?.message || 'An unexpected error occurred';
    const message = `${context}: ${detail}`;
    this.error.set(message);
    this.notificationService.error(message);
  }

  private resetForm(tab: ProcurementTab): void {
    if (tab === 'requests') this.requestForm.reset({ priority: 'medium', quantity: 1 });
    if (tab === 'vendors') this.vendorForm.reset({ rating: 4.0, status: 'active' });
    if (tab === 'purchase-orders') this.purchaseForm.reset({ status: 'created', quantity: 1, unit_price: 0 });
    if (tab === 'deliveries') this.deliveryForm.reset({ quality_status: 'passed', status: 'accepted', quantity_received: 1, delivery_date: new Date().toISOString().slice(0, 10) });
    if (tab === 'invoices') this.invoiceForm.reset({ status: 'pending', payment_status: 'pending', amount: 0, gst: 0, invoice_date: new Date().toISOString().slice(0, 10) });
    if (tab === 'payments') this.paymentForm.reset({ status: 'pending', amount: 0 });
  }

  private patchForm(tab: ProcurementTab, item: any): void {
    if (tab === 'requests') {
      this.requestForm.reset({
        project: item.project,
        material_name: item.material_name,
        quantity: item.quantity,
        required_date: this.toInputDate(item.required_date),
        priority: item.priority || 'medium',
        remarks: item.remarks || '',
      });
    } else if (tab === 'vendors') {
      this.vendorForm.reset({
        vendor_name: item.vendor_name,
        contact_person: item.contact_person,
        phone: item.phone,
        email: item.email,
        address: item.address,
        materials_supplied: Array.isArray(item.materials_supplied) ? item.materials_supplied.join(', ') : item.materials_supplied || '',
        rating: item.rating ?? 4.0,
        status: item.status || 'active',
      });
    } else if (tab === 'purchase-orders') {
      this.purchaseForm.reset({
        request_id: item.request_id,
        vendor_id: item.vendor_id,
        project: item.project,
        materials: item.materials,
        quantity: item.quantity,
        unit_price: item.unit_price,
        expected_delivery_date: this.toInputDate(item.expected_delivery_date),
        status: item.status || 'created',
      });
    } else if (tab === 'deliveries') {
      this.deliveryForm.reset({
        purchase_order_id: item.purchase_order_id,
        material: item.material,
        quantity_received: item.quantity_received,
        quality_status: item.quality_status || 'passed',
        delivery_date: this.toInputDate(item.delivery_date),
        status: item.status || 'accepted',
        remarks: item.remarks || '',
      });
    } else if (tab === 'invoices') {
      this.uploadedAttachmentUrl.set(item.attachment_url || '');
      this.invoiceForm.reset({
        invoice_number: item.invoice_number,
        vendor_id: item.vendor_id,
        purchase_order_id: item.purchase_order_id,
        amount: item.amount,
        gst: item.gst || 0,
        invoice_date: this.toInputDate(item.invoice_date),
        payment_status: item.payment_status || 'pending',
        attachment_url: item.attachment_url || '',
        status: item.status || 'pending',
      });
    } else if (tab === 'payments') {
      this.paymentForm.reset({
        invoice_id: item.invoice_id,
        vendor_id: item.vendor_id,
        purchase_order_id: item.purchase_order_id,
        amount: item.amount,
        status: item.status || 'pending',
        remarks: item.remarks || '',
      });
    }
  }

  private toInputDate(value?: string): string {
    if (!value) return '';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toISOString().slice(0, 10);
  }
}

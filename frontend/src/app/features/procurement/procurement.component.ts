import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
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
  private readonly http = inject(HttpClient);

  availableProjects = signal<string[]>([]);
  availableMaterials = signal<string[]>([]);

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
  modal = signal<ProcurementTab | 'approval' | 'assign_vendor' | 'invoice_action' | 'quality_inspection' | null>(null);
  selectedItem = signal<any | null>(null);

  // ASSUMPTION (needs backend confirmation): the material-request status
  // literal used for "submitted, awaiting approval" is 'pending' — inferred
  // from statusBadgeClass() already treating 'pending' as an amber
  // (awaiting-action) status elsewhere in this file. If the backend uses a
  // different literal (e.g. 'submitted', 'pending_approval'), update this
  // single constant.
  private readonly PENDING_APPROVAL_STATUS = 'pending';

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
  submitting = signal<boolean>(false);

  // Vendor login account creation toggle
  createLoginAccount = signal(false);

  // QR Payment State
  paymentMode = signal<'qr' | 'manual'>('qr');
  paymentConfirmed = signal<boolean>(false);
  quickPaying = signal<boolean>(false);
  pollingInterval: any = null;

  // User Role checks
  // SECURITY: missing/unknown user info must NOT be granted elevated
  // privileges. Previously this defaulted to 'Administrator', which meant
  // an unauthenticated or not-yet-loaded user state silently rendered
  // admin-only UI. An unknown role now resolves to '' and matches none of
  // the role checks below.
  // NOTE: these checks are for UI visibility only. The backend must enforce
  // authorization independently — never trust these signals as a security
  // boundary.
  currentUser = computed(() => this.authService.currentUser());
  userRole = computed(() => this.currentUser()?.role ?? '');

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

  vendorAssignmentForm = this.fb.group({
    vendor_id: ['', Validators.required],
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
    password: [''],
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

  inspectionForm = this.fb.group({
    quality_status: ['passed' as 'passed' | 'failed' | 'pending', Validators.required],
    status: ['accepted' as 'accepted' | 'rejected' | 'partial', Validators.required],
    quantity_received: [1, [Validators.required, Validators.min(0.01)]],
    remarks: ['Quality verified on site. Material meets project specifications.'],
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
    this.loadProjectsAndMaterials();
    this.loadData();
  }

  loadProjectsAndMaterials(): void {
    const projectsSet = new Set<string>();
    const materialsSet = new Set<string>();

    // 1. Live projects from MongoDB database (/api/v1/projects)
    this.procurementService.getProjects().subscribe({
      next: (projects) => {
        if (Array.isArray(projects)) {
          projects.forEach((p) => {
            const name = p.name || p.title || p.project_name;
            if (name && typeof name === 'string' && name.trim()) {
              projectsSet.add(name.trim());
            }
          });
          this.availableProjects.set(Array.from(projectsSet));
        }
      },
      error: () => {},
    });

    // 2. Live inventory materials from MongoDB database (/api/v1/procurement/inventory)
    this.procurementService.getInventory({ limit: 500 }).subscribe({
      next: (res) => {
        const items = res?.items || res;
        if (Array.isArray(items)) {
          items.forEach((i: any) => {
            const mat = i.material || i.material_name || i.itemName;
            if (mat && typeof mat === 'string' && mat.trim()) {
              materialsSet.add(mat.trim());
            }
          });
          this.availableMaterials.set(Array.from(materialsSet));
        }
      },
      error: () => {},
    });

    // 3. Also load registered vendor materials from MongoDB database (/api/v1/procurement/vendors)
    this.procurementService.getVendors({ limit: 100 }).subscribe({
      next: (res) => {
        const vendorList = res?.items || res;
        if (Array.isArray(vendorList)) {
          vendorList.forEach((v: any) => {
            if (Array.isArray(v.materials_supplied)) {
              v.materials_supplied.forEach((m: string) => {
                if (m && typeof m === 'string' && m.trim()) {
                  materialsSet.add(m.trim());
                }
              });
            }
          });
          this.availableMaterials.set(Array.from(materialsSet));
        }
      },
      error: () => {},
    });
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

      case 'requests': {
        this.procurementService.getMaterialRequests(query).subscribe({
          next: (res) => {
            this.requests.set(res.items);
            this.totalItems.set(res.total);
            this.approvedRequests.set(res.items.filter((r) => this.canGeneratePOFromRequest(r)));
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load material requests', err),
        });
        this.procurementService.getActiveVendors({ limit: 100 }).subscribe({
          next: (v) => this.vendors.set(v.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        break;
      }

      case 'approvals': {
        // The Approvals tab must only ever show requests awaiting a
        // decision — never already-approved/rejected ones. status_filter is
        // forced server-side (overriding whatever the generic status
        // dropdown happens to hold) and the result is filtered again
        // client-side as a safety net in case the backend doesn't honor the
        // filter. ASSUMPTION (needs backend confirmation): the pending
        // status literal is 'pending' — see PENDING_APPROVAL_STATUS below.
        const approvalsQuery = { ...query, status_filter: this.PENDING_APPROVAL_STATUS };
        this.procurementService.getMaterialRequests(approvalsQuery).subscribe({
          next: (res) => {
            const pendingOnly = res.items.filter((r) => r.status === this.PENDING_APPROVAL_STATUS);
            this.requests.set(pendingOnly);
            this.totalItems.set(res.total);
            this.loading.set(false);
          },
          error: (err) => this.handleError('Failed to load pending approvals', err),
        });
        this.procurementService.getActiveVendors({ limit: 100 }).subscribe({
          next: (v) => this.vendors.set(v.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        break;
      }

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
        this.procurementService.getActiveVendors({ limit: 100 }).subscribe({
          next: (v) => this.vendors.set(v.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        this.procurementService.getMaterialRequests({ limit: 100 }).subscribe({
          next: (r) => this.approvedRequests.set(r.items.filter((request) => this.canGeneratePOFromRequest(request))),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
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
        this.procurementService.getVendors({ limit: 100 }).subscribe({
          next: (v) => this.vendors.set(v.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe({
          next: (p) => this.purchaseOrders.set(p.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
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
        this.procurementService.getVendors({ limit: 100 }).subscribe({
          next: (v) => this.vendors.set(v.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe({
          next: (p) => this.purchaseOrders.set(p.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
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
        // Payments reference an invoice, a vendor, and a purchase order —
        // all three must be available for vendorName()/poNumber() to
        // resolve real names instead of raw IDs on this tab.
        this.procurementService.getInvoices({ limit: 100 }).subscribe({
          next: (i) => this.invoices.set(i.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        this.procurementService.getVendors({ limit: 100 }).subscribe({
          next: (v) => this.vendors.set(v.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe({
          next: (p) => this.purchaseOrders.set(p.items),
          error: () => {
            /* non-critical secondary dropdown load; ignore to avoid breaking primary loading state */
          },
        });
        break;

      default:
        this.loading.set(false);
    }
  }

  // --- Modal Helpers ---
  openAddModal(tab: ProcurementTab): void {
    this.selectedItem.set(null);
    this.resetForm(tab);
    if (tab === 'purchase-orders') {
      this.procurementService.getActiveVendors({ limit: 100 }).subscribe((v) => this.vendors.set(v.items));
      this.procurementService.getMaterialRequests({ limit: 100 }).subscribe((r) => {
        this.approvedRequests.set(r.items.filter((request) => this.canGeneratePOFromRequest(request)));
      });
    }
    if (tab === 'invoices') {
      if (this.vendors().length === 0) {
        this.procurementService.getVendors({ limit: 100 }).subscribe((v) => this.vendors.set(v.items));
      }
      if (this.purchaseOrders().length === 0) {
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe((p) => this.purchaseOrders.set(p.items));
      }
    }
    this.modal.set(tab);
  }

  onPOSelectForInvoice(event: Event): void {
    const poId = (event.target as HTMLSelectElement).value;
    const po = this.purchaseOrders().find((p) => this.getId(p) === poId);
    if (po) {
      // NOT VERIFIED AGAINST BACKEND: this assumes `subtotal = total_cost`
      // is GST-EXCLUSIVE and applies a flat 18% on top. If
      // PurchaseOrderRecord.total_cost is already GST-inclusive, this
      // double-counts GST on the resulting invoice. Confirm against the
      // PurchaseOrderRecord model / FastAPI schema and the project's actual
      // GST rate before relying on this in production — left unchanged
      // here rather than guessing a different, equally unverified formula.
      const subtotal = po.total_cost || po.quantity * po.unit_price || 0;
      const amount = subtotal;
      const gst = Math.round(subtotal * 0.18 * 100) / 100;
      const currentInv = this.invoiceForm.get('invoice_number')?.value;
      const invoiceNum = currentInv && currentInv.trim().length >= 2 ? currentInv : `INV-${po.po_number || Date.now().toString().slice(-5)}`;
      this.invoiceForm.patchValue({
        purchase_order_id: this.getId(po),
        vendor_id: po.vendor_id || '',
        amount: amount,
        gst: gst,
        invoice_number: invoiceNum,
      });
    }
  }

  openEditModal(tab: ProcurementTab, item: any): void {
    this.selectedItem.set(item);
    this.patchForm(tab, item);
    if (tab === 'invoices') {
      if (this.vendors().length === 0) {
        this.procurementService.getVendors({ limit: 100 }).subscribe((v) => this.vendors.set(v.items));
      }
      if (this.purchaseOrders().length === 0) {
        this.procurementService.getPurchaseOrders({ limit: 100 }).subscribe((p) => this.purchaseOrders.set(p.items));
      }
    }
    this.modal.set(tab);
  }

  openPayInvoiceModal(invoice: Invoice): void {
    const invId = this.getId(invoice);
    const totalAmount = (invoice.amount || 0) + (invoice.gst || 0);
    this.selectedItem.set(invoice);
    this.paymentConfirmed.set(false);
    this.paymentMode.set('qr');
    this.paymentForm.reset({
      invoice_id: invId,
      vendor_id: invoice.vendor_id || '',
      purchase_order_id: invoice.purchase_order_id || '',
      amount: totalAmount,
      status: 'paid',
      remarks: `Payment for Invoice ${invoice.invoice_number}`,
    });
    this.modal.set('payments');
    this.startPaymentStatusPolling(invId);
  }

  startPaymentStatusPolling(invoiceId: string): void {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(() => {
      if (this.modal() !== 'payments' || this.paymentConfirmed()) {
        clearInterval(this.pollingInterval);
        return;
      }
      this.procurementService.getInvoicePaymentStatus(invoiceId).subscribe({
        next: (res) => {
          if (res.payment_status === 'paid') {
            this.paymentConfirmed.set(true);
            clearInterval(this.pollingInterval);
            this.notificationService.success(`Payment verified! Invoice ${res.invoice_number} is PAID.`);
            this.loadData();
          }
        },
        error: () => {},
      });
    }, 2500);
  }

  simulateQRPayment(): void {
    const item = this.selectedItem();
    const invId = this.getId(item) || this.paymentForm.get('invoice_id')?.value;
    if (!invId) return;

    this.quickPaying.set(true);
    this.procurementService.quickPayInvoice(invId).subscribe({
      next: () => {
        this.quickPaying.set(false);
        this.paymentConfirmed.set(true);
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.notificationService.success('Payment completed successfully via QR scan!');
        this.loadData();
      },
      error: (err) => {
        this.quickPaying.set(false);
        this.handleError('Payment failed', err);
      },
    });
  }

  getQRImageUrl(): string {
    const item = this.selectedItem();
    const invId = this.getId(item) || this.paymentForm.get('invoice_id')?.value;
    return `http://127.0.0.1:8000/api/v1/procurement/invoices/${invId}/qr`;
  }

  getMobileCheckoutUrl(): string {
    const item = this.selectedItem();
    const invId = this.getId(item) || this.paymentForm.get('invoice_id')?.value;
    return `http://127.0.0.1:8000/api/v1/procurement/pay-scan/${invId}`;
  }

  openApprovalModal(request: MaterialRequest): void {
    this.selectedItem.set(request);
    this.approvalForm.reset({ status: 'approved', comments: '' });
    this.modal.set('approval');
  }

  openAssignVendorModal(request: MaterialRequest): void {
    this.selectedItem.set(request);
    this.vendorAssignmentForm.reset({ vendor_id: request.vendor_id || '' });
    this.procurementService.getActiveVendors({ limit: 100 }).subscribe({
      next: (res) => this.vendors.set(res.items),
      error: (err) => this.handleError('Failed to load active vendors', err),
    });
    this.modal.set('assign_vendor');
  }

  openPOFromRequest(request: MaterialRequest): void {
    this.selectedItem.set(null);
    this.procurementService.getActiveVendors({ limit: 100 }).subscribe({
      next: (res) => this.vendors.set(res.items),
      error: (err) => this.handleError('Failed to load active vendors', err),
    });
    this.purchaseForm.reset({
      request_id: this.getId(request) || (request as any).request_id || '',
      vendor_id: request.vendor_id || '',
      project: request.project,
      materials: request.material_name,
      quantity: request.quantity,
      unit_price: 0,
      expected_delivery_date: this.toInputDate(request.required_date),
      status: 'created',
    });
    this.modal.set('purchase-orders');
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
    if (this.pollingInterval) clearInterval(this.pollingInterval);
    this.modal.set(null);
    this.uploadedAttachmentUrl.set('');
    this.paymentConfirmed.set(false);
  }

  openQualityInspectionModal(delivery: MaterialDelivery): void {
    this.selectedItem.set(delivery);
    const initialStatus = delivery.quality_status === 'failed' ? 'failed' : 'passed';
    this.inspectionForm.reset({
      quality_status: initialStatus,
      status: initialStatus === 'passed' ? 'accepted' : 'rejected',
      quantity_received: delivery.quantity_received || 1,
      remarks: delivery.remarks || 'Quality verified on site. Material meets specifications.',
    });
    this.modal.set('quality_inspection');
  }

  saveQualityInspection(): void {
    const item = this.selectedItem();
    const deliveryId = this.getId(item);
    if (!deliveryId) return;

    if (this.inspectionForm.invalid) {
      this.inspectionForm.markAllAsTouched();
      return;
    }

    const val = this.inspectionForm.getRawValue();
    const isPassed = val.quality_status === 'passed';
    const isFailed = val.quality_status === 'failed';
    const payload: Partial<MaterialDelivery> = {
      quality_status: val.quality_status!,
      status: isPassed ? 'accepted' : isFailed ? 'rejected' : (val.status || 'partial'),
      quantity_received: Number(val.quantity_received),
      remarks: val.remarks || undefined,
    };

    this.procurementService.updateDelivery(deliveryId, payload).subscribe({
      next: () => {
        this.closeModal();
        if (isPassed) {
          this.notificationService.success(`Quality Inspection PASSED for ${item.material || 'Material'}! Stock automatically added to inventory.`);
        } else {
          this.notificationService.warning(`Quality Inspection marked as ${payload.quality_status?.toUpperCase()}.`);
        }
        this.loadData();
      },
      error: (err) => this.handleError('Failed to record quality inspection', err),
    });
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
    if (this.submitting()) return;
    this.submitting.set(true);

    const val = this.requestForm.getRawValue();
    const payload: Partial<MaterialRequest> = {
      project: val.project!,
      material_name: val.material_name!,
      quantity: Number(val.quantity),
      required_date: this.toISOStringSafe(val.required_date!),
      priority: val.priority!,
      remarks: val.remarks || undefined,
    };

    const current = this.selectedItem();
    const targetId = this.getId(current);
    if (targetId) {
      this.procurementService.updateMaterialRequest(targetId, payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.handleSuccess('Material request updated successfully');
        },
        error: (err) => {
          this.submitting.set(false);
          this.handleError('Failed to update material request', err);
        },
      });
    } else {
      this.procurementService.createMaterialRequest(payload).subscribe({
        next: () => {
          this.submitting.set(false);
          this.handleSuccess('Material request created successfully');
        },
        error: (err) => {
          this.submitting.set(false);
          this.handleError('Failed to create material request', err);
        },
      });
    }
  }

  submitApproval(): void {
    if (this.approvalForm.invalid) return;
    if (this.submitting()) return;
    const current = this.selectedItem();
    const targetId = this.getId(current);
    if (!targetId) return;

    this.submitting.set(true);
    const val = this.approvalForm.getRawValue();
    this.procurementService
      .approveMaterialRequest(targetId, {
        status: val.status!,
        comments: val.comments || undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.handleSuccess(`Material request ${val.status} successfully`);
        },
        error: (err) => {
          this.submitting.set(false);
          this.handleError('Failed to update request approval', err);
        },
      });
  }

  submitVendorAssignment(): void {
    if (this.vendorAssignmentForm.invalid) {
      this.vendorAssignmentForm.markAllAsTouched();
      return;
    }
    if (this.submitting()) return;
    const current = this.selectedItem();
    const targetId = this.getId(current);
    const vendorId = this.vendorAssignmentForm.getRawValue().vendor_id;
    if (!targetId || !vendorId) return;

    this.submitting.set(true);
    this.procurementService.assignVendorToMaterialRequest(targetId, vendorId).subscribe({
      next: () => {
        this.submitting.set(false);
        this.handleSuccess('Vendor assigned successfully');
      },
      error: (err) => {
        this.submitting.set(false);
        this.handleError('Failed to assign vendor', err);
      },
    });
  }

  toggleCreateLoginAccount(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.createLoginAccount.set(checked);
  }

  saveVendor(): void {
    if (this.vendorForm.invalid) {
      this.vendorForm.markAllAsTouched();
      // BUG FIX: previously this returned silently with zero feedback, so
      // clicking "Save Vendor & Create Account" on an incomplete form
      // looked like it "wasn't submitting" — nothing happened and no error
      // ever appeared. Surface exactly which field(s) are invalid instead.
      const fieldLabels: Record<string, string> = {
        vendor_name: 'Vendor Name',
        contact_person: 'Contact Person',
        phone: 'Phone (min 7 characters)',
        email: 'Email',
        address: 'Address',
        materials_supplied: 'Materials Supplied',
        rating: 'Rating (0-5)',
        status: 'Status',
      };
      const invalidFields = Object.keys(this.vendorForm.controls)
        .filter((key) => this.vendorForm.get(key)?.invalid)
        .map((key) => fieldLabels[key] || key);
      this.notificationService.error(
        invalidFields.length
          ? `Please check the following field(s): ${invalidFields.join(', ')}`
          : 'Please fill in all required vendor fields.'
      );
      return;
    }

    // Validate password when creating a login account
    if (this.createLoginAccount() && !this.selectedItem()) {
      const pwd = this.vendorForm.getRawValue().password;
      if (!pwd || pwd.trim().length < 6) {
        this.notificationService.error('Password is required (min 6 characters) to create a login account.');
        return;
      }
    }

    const val = this.vendorForm.getRawValue();
    const materialsArray = val
      .materials_supplied!.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const vendorPayload: Partial<Vendor> = {
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
    const targetId = this.getId(current);

    if (targetId) {
      // Editing existing vendor — no login account creation
      this.procurementService.updateVendor(targetId, vendorPayload).subscribe({
        next: () => this.handleSuccess('Vendor updated successfully'),
        error: (err) => this.handleError('Failed to update vendor', err),
      });
    } else if (this.createLoginAccount() && this.isAdmin()) {
      // New vendor + login account (admin only, combined endpoint)
      this.procurementService
        .createVendorWithAccount({
          vendor: vendorPayload,
          create_login_account: true,
          password: val.password || undefined,
        })
        .subscribe({
          next: (res) => {
            this.createLoginAccount.set(false);
            this.handleSuccess(res.message || 'Vendor and login account created successfully.');
          },
          error: (err) => this.handleError('Failed to create vendor with account', err),
        });
    } else {
      // New vendor only (no login account)
      this.procurementService.createVendor(vendorPayload).subscribe({
        next: () => this.handleSuccess('Vendor added successfully'),
        error: (err) => this.handleError('Failed to add vendor', err),
      });
    }
  }

  onMaterialRequestSelectForPO(event: Event): void {
    const reqId = (event.target as HTMLSelectElement).value;
    const selectedReq = this.approvedRequests().find(
      (r) => this.getId(r) === reqId || (r as any).request_id === reqId || (r as any)._id === reqId
    );
    if (selectedReq) {
      const vendorVal = selectedReq.vendor_id || (selectedReq as any).assigned_vendor_id || '';
      this.purchaseForm.patchValue({
        request_id: this.getId(selectedReq) || (selectedReq as any).request_id || reqId,
        project: selectedReq.project,
        materials: selectedReq.material_name,
        quantity: selectedReq.quantity,
        vendor_id: vendorVal || this.purchaseForm.getRawValue().vendor_id || '',
        expected_delivery_date: this.toInputDate(selectedReq.required_date),
        status: 'created',
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
      expected_delivery_date: this.toISOStringSafe(val.expected_delivery_date!),
      status: val.status!,
    };

    const current = this.selectedItem();
    const targetId = this.getId(current);

    if (targetId) {
      // Update existing Purchase Order
      this.procurementService.updatePurchaseOrder(targetId, payload).subscribe({
        next: () => {
          this.activeTab.set('purchase-orders');
          this.handleSuccess('Purchase order updated successfully');
        },
        error: (err) => this.handleError('Failed to update purchase order', err),
      });
    } else {
      // Create new Purchase Order
      this.procurementService.createPurchaseOrder(payload).subscribe({
        next: () => {
          this.activeTab.set('purchase-orders');
          this.pageIndex.set(1);
          this.handleSuccess('Purchase order created successfully');
        },
        error: (err) => this.handleError('Failed to create purchase order', err),
      });
    }
  }

  downloadPDF(po: PurchaseOrderRecord): void {
    const poId = this.getId(po);
    if (!poId) return;
    this.procurementService.downloadPOPDF(poId).subscribe({
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

  downloadInvoicePDF(invoice: Invoice): void {
    const invoiceId = this.getId(invoice);
    if (!invoiceId) return;
    this.procurementService.downloadInvoicePDF(invoiceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${invoice.invoice_number || 'Invoice'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.notificationService.success('Invoice PDF downloaded successfully');
      },
      error: (err) => this.handleError('Failed to download invoice PDF', err),
    });
  }

  sendPO(po: PurchaseOrderRecord): void {
    const poId = this.getId(po);
    if (!poId) return;
    this.procurementService.sendPurchaseOrder(poId).subscribe({
      next: () => this.handleSuccess('Purchase order sent to vendor'),
      error: (err) => this.handleError('Failed to send purchase order', err),
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
      delivery_date: this.toISOStringSafe(val.delivery_date!),
      status: val.status!,
      remarks: val.remarks || undefined,
    };

    const current = this.selectedItem();
    const targetId = this.getId(current);
    if (targetId) {
      this.procurementService.updateDelivery(targetId, payload).subscribe({
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

  acceptDelivery(delivery: MaterialDelivery): void {
    const deliveryId = this.getId(delivery);
    if (!deliveryId) return;

    const payload: Partial<MaterialDelivery> = {
      status: 'accepted',
      quality_status: 'passed',
      quantity_received: delivery.quantity_received || 1,
    };

    this.procurementService.updateDelivery(deliveryId, payload).subscribe({
      next: () => this.handleSuccess(`Delivery for ${delivery.material} accepted! Stock automatically added to inventory.`),
      error: (err) => this.handleError('Failed to accept delivery', err),
    });
  }

  deliveryStatusBadge(status?: string): string {
    if (!status) return 'badge-secondary';
    const s = status.toLowerCase();
    if (s === 'accepted' || s === 'completed' || s === 'passed') return 'badge-green';
    if (s === 'shipped' || s === 'in_transit' || s === 'dispatched') return 'badge-blue';
    if (s === 'out_for_delivery' || s === 'delivered' || s === 'pending') return 'badge-amber';
    if (s === 'rejected' || s === 'failed') return 'badge-red';
    return 'badge-secondary';
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
      this.notificationService.error('Please fill in all required invoice fields correctly.');
      return;
    }
    const val = this.invoiceForm.getRawValue();
    const payload: Partial<Invoice> = {
      invoice_number: val.invoice_number!,
      vendor_id: val.vendor_id!,
      purchase_order_id: val.purchase_order_id!,
      amount: Number(val.amount),
      gst: Number(val.gst ?? 0),
      invoice_date: this.toISOStringSafe(val.invoice_date!),
      payment_status: val.payment_status!,
      attachment_url: this.uploadedAttachmentUrl() || val.attachment_url || undefined,
      status: val.status!,
    };

    const current = this.selectedItem();
    const targetId = this.getId(current);
    if (targetId) {
      this.procurementService.updateInvoice(targetId, payload).subscribe({
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
    const targetId = this.getId(current);
    if (!targetId) return;

    const val = this.invoiceActionForm.getRawValue();
    this.procurementService
      .invoiceAction(targetId, val.action!, { comments: val.comments || undefined })
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
    const targetId = this.getId(current);
    if (targetId) {
      this.procurementService.updatePayment(targetId, payload).subscribe({
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

        let deleteObs: ReturnType<typeof this.procurementService.deleteMaterialRequest> | undefined;
        if (tab === 'requests') deleteObs = this.procurementService.deleteMaterialRequest(id);
        else if (tab === 'vendors') deleteObs = this.procurementService.deleteVendor(id);
        else if (tab === 'purchase-orders') deleteObs = this.procurementService.deletePurchaseOrder(id);
        else if (tab === 'invoices') deleteObs = this.procurementService.deleteInvoice(id);

        if (deleteObs) {
          deleteObs.subscribe({
            next: () => this.handleSuccess(`${label} deleted successfully`),
            error: (err: any) => this.handleError(`Failed to delete ${label}`, err),
          });
        }
      });
  }

  // --- Display & Helper Functions ---
  vendorName(vendorId?: string | null, item?: any): string {
    if (item && item.vendor_name) return item.vendor_name;
    if (!vendorId) {
      if (item && item.purchase_order_id) {
        const po = this.purchaseOrders().find((p) => this.getId(p) === item.purchase_order_id);
        if (po) {
          if ((po as any).vendor_name) return (po as any).vendor_name;
          if (po.vendor_id) return this.vendorName(po.vendor_id);
        }
      }
      return '-';
    }
    const v = this.vendors().find((elem) => this.getId(elem) === vendorId || (elem as any).id === vendorId || (elem as any).user_id === vendorId);
    if (v && v.vendor_name) return v.vendor_name;
    
    // Check if linked PO has vendor info
    if (item && item.purchase_order_id) {
      const po = this.purchaseOrders().find((p) => this.getId(p) === item.purchase_order_id);
      if (po) {
        if ((po as any).vendor_name) return (po as any).vendor_name;
        if (po.vendor_id && po.vendor_id !== vendorId) return this.vendorName(po.vendor_id);
      }
    }
    return vendorId;
  }

  poNumber(poId?: string): string {
    if (!poId) return '-';
    const p = this.purchaseOrders().find((item) => this.getId(item) === poId);
    return p ? p.po_number || poId : poId;
  }

  private canGeneratePOFromRequest(request: MaterialRequest): boolean {
    const validStatuses = ['approved', 'vendor_assigned', 'sent_to_vendor', 'vendor_accepted', 'po_sent'];
    return validStatuses.includes(request.status) && !request.purchase_order_id;
  }

  statusBadgeClass(status?: string): string {
    if (!status) return 'badge-secondary';
    const lower = status.toLowerCase();
    if (['approved', 'passed', 'accepted', 'completed', 'paid', 'verified'].includes(lower)) return 'badge-green';
    if (['created', 'sent', 'partial', 'medium', 'vendor_assigned', 'po_generated', 'po_sent'].includes(lower)) return 'badge-blue';
    if (['pending', 'low'].includes(lower)) return 'badge-amber';
    if (['rejected', 'failed', 'cancelled', 'high'].includes(lower)) return 'badge-red';
    return 'badge-secondary';
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? dateStr : date.toLocaleDateString();
  }

  /**
   * Returns the identifier of a record regardless of whether the backend
   * returned it as `_id` (MongoDB) or `id`.
   */
  private getId(obj: any): string {
    if (!obj) return '';
    return obj._id || obj.id || '';
  }

  /**
   * Safely converts a date-like input (string or Date) to an ISO string.
   * Never throws `RangeError: Invalid time value` — falls back to the
   * current time if the input cannot be parsed, so a bad/empty date never
   * crashes a save operation.
   */
  private toISOStringSafe(value?: string | Date): string {
    if (!value) return new Date().toISOString();
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
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

    // Detect network-level failures (backend unreachable) which Angular reports
    // as status 0 with "Unknown Error". Give a clear, actionable message.
    if (err?.status === 0) {
      const message = `${context}: Cannot reach the backend server at http://127.0.0.1:8000. Make sure the backend is running (cd backend && .venv\\Scripts\\Activate && uvicorn app.main:app --reload).`;
      this.error.set(message);
      this.notificationService.error(message);
      return;
    }

    const detail = err?.error?.detail || err?.message || 'An unexpected error occurred';
    const message = `${context}: ${detail}`;
    this.error.set(message);
    this.notificationService.error(message);
  }

  private resetForm(tab: ProcurementTab): void {
    if (tab === 'requests') {
      this.requestForm.reset({
        project: '',
        material_name: '',
        quantity: 1,
        required_date: '',
        priority: 'medium',
        remarks: '',
      });
    }
    if (tab === 'vendors') {
      this.createLoginAccount.set(false);
      this.vendorForm.reset({
        vendor_name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        materials_supplied: '',
        rating: 4.0,
        status: 'active',
        password: '',
      });
    }
    if (tab === 'purchase-orders') {
      this.purchaseForm.reset({
        request_id: '',
        vendor_id: '',
        project: '',
        materials: '',
        quantity: 1,
        unit_price: 0,
        expected_delivery_date: '',
        status: 'created',
      });
    }
    if (tab === 'deliveries') {
      this.deliveryForm.reset({
        purchase_order_id: '',
        material: '',
        quantity_received: 1,
        quality_status: 'passed',
        delivery_date: new Date().toISOString().slice(0, 10),
        status: 'accepted',
        remarks: '',
      });
    }
    if (tab === 'invoices') {
      this.uploadedAttachmentUrl.set('');
      this.invoiceForm.reset({
        invoice_number: '',
        vendor_id: '',
        purchase_order_id: '',
        amount: 0,
        gst: 0,
        invoice_date: new Date().toISOString().slice(0, 10),
        payment_status: 'pending',
        attachment_url: '',
        status: 'pending',
      });
    }
    if (tab === 'payments') {
      this.paymentForm.reset({
        invoice_id: '',
        vendor_id: '',
        purchase_order_id: '',
        amount: 0,
        status: 'pending',
        remarks: '',
      });
    }
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
      this.createLoginAccount.set(false);
      this.vendorForm.reset({
        vendor_name: item.vendor_name,
        contact_person: item.contact_person,
        phone: item.phone,
        email: item.email,
        address: item.address,
        materials_supplied: Array.isArray(item.materials_supplied) ? item.materials_supplied.join(', ') : item.materials_supplied || '',
        rating: item.rating ?? 4.0,
        status: item.status || 'active',
        password: '',
      });
    } else if (tab === 'purchase-orders') {
      this.purchaseForm.reset({
        request_id: item.request_id || this.getId(item) || '',
        vendor_id: item.vendor_id || '',
        project: item.project || '',
        materials: item.materials || '',
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? 0,
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
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
}
import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ProcurementService } from '../../../core/services/procurement.service';
import {
  Invoice,
  MaterialDelivery,
  MaterialRequest,
  NotificationItem,
  PurchaseOrderRecord,
  Vendor,
  VendorDashboardStats,
} from '../../../core/models/models';

export type VendorTab = 'dashboard' | 'requests' | 'orders' | 'deliveries' | 'invoices' | 'notifications' | 'profile';

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './vendor-dashboard.component.html',
  styleUrls: ['./vendor-dashboard.component.scss'],
})
export class VendorDashboardComponent implements OnInit {
  private proc = inject(ProcurementService);
  private notify = inject(NotificationService);
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  activeTab = signal<VendorTab>('dashboard');
  loading = signal(false);
  stats = signal<VendorDashboardStats | null>(null);

  // Assigned material requests state
  requestList = signal<MaterialRequest[]>([]);
  requestFilter = signal<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  requestSearch = signal('');
  selectedRequest = signal<MaterialRequest | null>(null);
  showRequestDetailsModal = signal(false);
  showRejectRequestModal = signal(false);
  requestRejectionReason = signal('');
  isRejectingRequest = signal(false);

  // Purchase orders state
  poList = signal<PurchaseOrderRecord[]>([]);
  poFilter = signal<'all' | 'pending' | 'accepted' | 'completed' | 'rejected'>('all');
  poSearch = signal('');
  selectedPO = signal<PurchaseOrderRecord | null>(null);
  showPODetailsModal = signal(false);
  showRejectModal = signal(false);
  rejectionReason = signal('');
  isRejecting = signal(false);

  // Deliveries state
  deliveryList = signal<MaterialDelivery[]>([]);
  showCreateDeliveryModal = signal(false);
  showUpdateDeliveryModal = signal(false);
  selectedDelivery = signal<MaterialDelivery | null>(null);
  deliveryForm!: FormGroup;
  updateDeliveryForm!: FormGroup;

  // Invoices state
  invoiceList = signal<Invoice[]>([]);
  showSubmitInvoiceModal = signal(false);
  invoiceForm!: FormGroup;
  invoiceFile: File | null = null;
  uploadingAttachment = signal(false);
  submittingInvoice = signal(false);

  // Notifications state
  notificationList = signal<NotificationItem[]>([]);
  notificationFilter = signal<'all' | 'unread'>('all');

  // Profile & Password forms
  profileForm!: FormGroup;
  passwordForm!: FormGroup;
  isSavingProfile = signal(false);
  isChangingPassword = signal(false);
  showCurrentPassword = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);

  ngOnInit(): void {
    this.initForms();
    this.loadAll();
    this.route.queryParams.subscribe((params) => {
      const tab = params['tab'] as VendorTab;
      if (tab && ['dashboard', 'requests', 'orders', 'deliveries', 'invoices', 'notifications', 'profile'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });
  }

  initForms(): void {
    this.deliveryForm = this.fb.group({
      purchase_order_id: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      dispatch_date: [new Date().toISOString().substring(0, 10), Validators.required],
      vehicle_number: [''],
      tracking_number: [''],
      remarks: [''],
      status: ['shipped', Validators.required],
    });

    this.updateDeliveryForm = this.fb.group({
      status: ['shipped', Validators.required],
      vehicle_number: [''],
      tracking_number: [''],
      remarks: [''],
    });

    this.invoiceForm = this.fb.group({
      purchase_order_id: ['', Validators.required],
      invoice_number: ['', [Validators.required, Validators.minLength(2)]],
      invoice_date: [new Date().toISOString().substring(0, 10), Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      gst: [0, [Validators.min(0)]],
    });

    this.profileForm = this.fb.group({
      vendor_name: ['', [Validators.required, Validators.minLength(2)]],
      contact_person: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.minLength(7)]],
      email: [{ value: '', disabled: true }],
      address: ['', [Validators.required, Validators.minLength(3)]],
      gst_number: [''],
      pan_number: [''],
      materials_supplied: [''],
    });

    this.passwordForm = this.fb.group({
      current_password: ['', [Validators.required, Validators.minLength(6)]],
      new_password: ['', [Validators.required, Validators.minLength(6)]],
      confirm_password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  setTab(tab: VendorTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  vendorName(): string {
    return this.stats()?.vendor?.vendor_name || this.auth.currentUser()?.name || 'Vendor Partner';
  }

  loadAll(): void {
    this.loading.set(true);
    this.proc.getVendorDashboard().subscribe({
      next: (res: VendorDashboardStats) => {
        this.stats.set(res);
        this.requestList.set(res.requests || []);
        this.poList.set(res.purchase_orders || []);
        this.deliveryList.set(res.deliveries || []);
        this.invoiceList.set(res.invoices || []);
        this.notificationList.set(res.recent_notifications || []);

        if (res.vendor) {
          this.populateProfileForm(res.vendor);
        }
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Unable to fetch vendor data. Please check your connection.');
        this.loading.set(false);
      },
    });
  }

  loadRequests(): void {
    this.proc.getVendorMaterialRequests().subscribe({
      next: (res) => {
        this.requestList.set(res.items || []);
      },
      error: () => {},
    });
  }

  populateProfileForm(v: Vendor): void {
    this.profileForm.patchValue({
      vendor_name: v.vendor_name || '',
      contact_person: v.contact_person || '',
      phone: v.phone || '',
      email: v.email || this.auth.currentUser()?.email || '',
      address: v.address || '',
      gst_number: v.gst_number || '',
      pan_number: v.pan_number || '',
      materials_supplied: Array.isArray(v.materials_supplied) ? v.materials_supplied.join(', ') : '',
    });
  }

  // ==========================================
  // ASSIGNED MATERIAL REQUESTS
  // ==========================================
  filteredRequests = computed(() => {
    let list = this.requestList();
    const filter = this.requestFilter();
    const search = this.requestSearch().toLowerCase().trim();

    if (filter === 'pending') {
      list = list.filter((r) => (r.status === 'vendor_assigned' || r.status === 'sent_to_vendor' || r.status === 'pending') && !r.vendor_response);
    } else if (filter === 'accepted') {
      list = list.filter((r) => r.status === 'vendor_accepted' || r.status === 'po_generated' || r.status === 'po_sent' || r.vendor_response === 'accept');
    } else if (filter === 'rejected') {
      list = list.filter((r) => r.status === 'vendor_rejected' || r.vendor_response === 'reject');
    }

    if (search) {
      list = list.filter(
        (r) =>
          (r.request_id || '').toLowerCase().includes(search) ||
          (r.project || '').toLowerCase().includes(search) ||
          (r.material_name || '').toLowerCase().includes(search) ||
          (r.priority || '').toLowerCase().includes(search)
      );
    }

    return list;
  });

  pendingRequests = computed(() => {
    return this.requestList().filter(
      (r) => (r.status === 'vendor_assigned' || r.status === 'sent_to_vendor' || r.status === 'pending') && !r.vendor_response
    );
  });

  openRequestDetails(req: MaterialRequest): void {
    this.selectedRequest.set(req);
    this.showRequestDetailsModal.set(true);
  }

  closeRequestDetails(): void {
    this.showRequestDetailsModal.set(false);
    this.selectedRequest.set(null);
  }

  acceptMaterialRequest(req: MaterialRequest): void {
    const id = req._id || (req as any).id || req.request_id;
    if (!id) return;

    this.proc.vendorAcceptMaterialRequest(id).subscribe({
      next: () => {
        this.notify.success(`Material request ${req.request_id || ''} accepted successfully!`);
        this.closeRequestDetails();
        this.loadAll();
        this.loadRequests();
      },
      error: (err: any) => this.notify.error(err?.error?.detail || 'Failed to accept material request'),
    });
  }

  openRejectRequestModal(req: MaterialRequest): void {
    this.selectedRequest.set(req);
    this.requestRejectionReason.set('');
    this.showRejectRequestModal.set(true);
  }

  closeRejectRequestModal(): void {
    this.showRejectRequestModal.set(false);
    this.requestRejectionReason.set('');
  }

  submitRequestRejection(): void {
    const reason = this.requestRejectionReason().trim();
    if (!reason) {
      this.notify.error('A rejection reason is required.');
      return;
    }

    const req = this.selectedRequest();
    if (!req) return;
    const id = req._id || (req as any).id || req.request_id;
    if (!id) return;

    this.isRejectingRequest.set(true);
    this.proc.vendorRejectMaterialRequest(id, reason).subscribe({
      next: () => {
        this.notify.success(`Material request ${req.request_id || id} rejected.`);
        this.isRejectingRequest.set(false);
        this.closeRejectRequestModal();
        this.closeRequestDetails();
        this.loadAll();
        this.loadRequests();
      },
      error: (err: any) => {
        this.isRejectingRequest.set(false);
        this.notify.error(err?.error?.detail || 'Failed to reject material request');
      },
    });
  }

  // ==========================================
  // PURCHASE ORDERS
  // ==========================================
  isPODelivered(po: PurchaseOrderRecord): boolean {
    const s = (po.status || '').toLowerCase();
    if (s === 'delivered' || s === 'received' || s === 'completed') return true;
    const poId = String(po._id || po.id || '');
    return this.deliveryList().some(
      (d) => (String(d.purchase_order_id || '') === poId || (d as any).po_number === po.po_number) &&
             (d.status === 'accepted' || d.status === 'delivered' || d.quality_status === 'passed')
    );
  }

  isPOAccepted(po: PurchaseOrderRecord): boolean {
    if (this.isPODelivered(po)) return false;
    const s = (po.status || '').toLowerCase();
    return s === 'accepted' || s === 'processing' || s === 'shipped';
  }

  isPOPending(po: PurchaseOrderRecord): boolean {
    const s = (po.status || '').toLowerCase();
    return s === 'created' || s === 'sent' || s === 'pending';
  }

  isPORejected(po: PurchaseOrderRecord): boolean {
    const s = (po.status || '').toLowerCase();
    return s === 'rejected' || s === 'cancelled';
  }

  pendingPOCount = computed(() => this.poList().filter((p) => this.isPOPending(p)).length);
  acceptedPOCount = computed(() => this.poList().filter((p) => this.isPOAccepted(p)).length);
  deliveredPOCount = computed(() => this.poList().filter((p) => this.isPODelivered(p)).length);
  rejectedPOCount = computed(() => this.poList().filter((p) => this.isPORejected(p)).length);

  filteredPOs = computed(() => {
    let list = this.poList();
    const filter = this.poFilter();
    const search = this.poSearch().toLowerCase().trim();

    if (filter === 'pending') {
      list = list.filter((p) => this.isPOPending(p));
    } else if (filter === 'accepted') {
      list = list.filter((p) => this.isPOAccepted(p));
    } else if (filter === 'completed') {
      list = list.filter((p) => this.isPODelivered(p));
    } else if (filter === 'rejected') {
      list = list.filter((p) => this.isPORejected(p));
    }

    if (search) {
      list = list.filter(
        (p) =>
          (p.po_number || '').toLowerCase().includes(search) ||
          (p.project || '').toLowerCase().includes(search) ||
          (p.materials || '').toLowerCase().includes(search)
      );
    }

    return list;
  });

  acceptedPOs = computed(() => {
    return this.poList().filter(
      (p) => p.status === 'accepted' || p.status === 'processing' || p.status === 'shipped' || p.status === 'delivered'
    );
  });

  openPODetails(po: PurchaseOrderRecord): void {
    this.selectedPO.set(po);
    this.showPODetailsModal.set(true);
  }

  closePODetails(): void {
    this.showPODetailsModal.set(false);
    this.selectedPO.set(null);
  }

  acceptPO(po: PurchaseOrderRecord): void {
    const id = po._id || po.id;
    if (!id) return;

    this.proc.vendorAcceptPO(id).subscribe({
      next: () => {
        this.notify.success(`Purchase Order ${po.po_number || id} accepted successfully.`);
        this.closePODetails();
        this.loadAll();
      },
      error: (err: any) => this.notify.error(err?.error?.detail || 'Failed to accept purchase order'),
    });
  }

  openRejectModal(po: PurchaseOrderRecord): void {
    this.selectedPO.set(po);
    this.rejectionReason.set('');
    this.showRejectModal.set(true);
  }

  closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.rejectionReason.set('');
  }

  submitPORejection(): void {
    const reason = this.rejectionReason().trim();
    if (!reason) {
      this.notify.error('A rejection reason is required.');
      return;
    }

    const po = this.selectedPO();
    if (!po) return;
    const id = po._id || po.id;
    if (!id) return;

    this.isRejecting.set(true);
    this.proc.vendorRejectPO(id, reason).subscribe({
      next: () => {
        this.notify.success(`Purchase Order ${po.po_number || id} rejected.`);
        this.isRejecting.set(false);
        this.closeRejectModal();
        this.closePODetails();
        this.loadAll();
      },
      error: (err: any) => {
        this.isRejecting.set(false);
        this.notify.error(err?.error?.detail || 'Failed to reject purchase order');
      },
    });
  }

  downloadPOPDF(po: PurchaseOrderRecord): void {
    const id = po._id || po.id;
    if (!id) return;

    this.proc.downloadPOPDF(id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${po.po_number || 'purchase_order'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('Failed to download Purchase Order PDF'),
    });
  }

  prepareDeliveryForPO(po: PurchaseOrderRecord): void {
    this.deliveryForm.patchValue({
      purchase_order_id: po._id || po.id,
      quantity: po.quantity || 1,
      dispatch_date: new Date().toISOString().substring(0, 10),
      remarks: `Delivery for ${po.materials}`,
      status: 'shipped',
    });
    this.closePODetails();
    this.activeTab.set('deliveries');
    this.showCreateDeliveryModal.set(true);
  }

  // ==========================================
  // DELIVERIES
  // ==========================================
  openCreateDelivery(): void {
    this.deliveryForm.reset({
      purchase_order_id: '',
      quantity: 1,
      dispatch_date: new Date().toISOString().substring(0, 10),
      vehicle_number: '',
      tracking_number: '',
      remarks: '',
      status: 'shipped',
    });
    this.showCreateDeliveryModal.set(true);
  }

  closeCreateDelivery(): void {
    this.showCreateDeliveryModal.set(false);
  }

  onDeliveryPOChange(): void {
    const pId = this.deliveryForm.get('purchase_order_id')?.value;
    const po = this.poList().find((p) => (p._id || p.id) === pId);
    if (po) {
      this.deliveryForm.patchValue({
        quantity: po.quantity || 1,
        remarks: `Dispatched materials for ${po.materials}`,
      });
    }
  }

  submitCreateDelivery(): void {
    if (this.deliveryForm.invalid) {
      this.deliveryForm.markAllAsTouched();
      return;
    }

    const val = this.deliveryForm.getRawValue();
    this.proc
      .createVendorDelivery({
        purchase_order_id: val.purchase_order_id,
        quantity: parseFloat(val.quantity),
        dispatch_date: val.dispatch_date,
        vehicle_number: val.vehicle_number,
        tracking_number: val.tracking_number,
        remarks: val.remarks,
        status: val.status,
      })
      .subscribe({
        next: () => {
          this.notify.success('Delivery dispatched and recorded successfully.');
          this.closeCreateDelivery();
          this.loadAll();
        },
        error: (err: any) => this.notify.error(err?.error?.detail || 'Failed to create delivery record'),
      });
  }

  openUpdateDeliveryModal(d: MaterialDelivery): void {
    this.selectedDelivery.set(d);
    this.updateDeliveryForm.patchValue({
      status: d.status || 'shipped',
      vehicle_number: d.vehicle_number || '',
      tracking_number: d.tracking_number || '',
      remarks: d.remarks || '',
    });
    this.showUpdateDeliveryModal.set(true);
  }

  closeUpdateDeliveryModal(): void {
    this.showUpdateDeliveryModal.set(false);
    this.selectedDelivery.set(null);
  }

  submitUpdateDelivery(): void {
    if (this.updateDeliveryForm.invalid) {
      return;
    }
    const d = this.selectedDelivery();
    if (!d) return;
    const id = d._id || d.id;
    if (!id) return;

    this.proc.updateVendorDelivery(id, this.updateDeliveryForm.getRawValue()).subscribe({
      next: () => {
        this.notify.success('Delivery status updated.');
        this.closeUpdateDeliveryModal();
        this.loadAll();
      },
      error: (err: any) => this.notify.error(err?.error?.detail || 'Failed to update delivery'),
    });
  }

  // ==========================================
  // INVOICES
  // ==========================================
  openSubmitInvoiceModal(po?: PurchaseOrderRecord): void {
    const defaultPO = po || this.acceptedPOs()[0];
    const defaultPOId = defaultPO ? defaultPO._id || defaultPO.id : '';
    const initialAmount = defaultPO ? (defaultPO.subtotal || (defaultPO.quantity || 1) * (defaultPO.unit_price || 0)) : 0;
    const initialGST = defaultPO ? (defaultPO.gst || 0) : 0;
    const randomInvNum = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    this.invoiceForm.patchValue({
      purchase_order_id: defaultPOId,
      invoice_number: randomInvNum,
      invoice_date: new Date().toISOString().substring(0, 10),
      amount: initialAmount,
      gst: initialGST,
    });
    this.invoiceFile = null;
    this.showSubmitInvoiceModal.set(true);
  }

  closeSubmitInvoiceModal(): void {
    this.showSubmitInvoiceModal.set(false);
    this.invoiceFile = null;
  }

  onInvoicePOChange(): void {
    const pId = this.invoiceForm.get('purchase_order_id')?.value;
    const po = this.poList().find((p) => (p._id || p.id) === pId);
    if (po) {
      const subtotal = po.subtotal || (po.quantity || 1) * (po.unit_price || 0);
      this.invoiceForm.patchValue({
        amount: subtotal,
        gst: po.gst || 0,
      });
    }
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.invoiceFile = file;
    }
  }

  calculatedInvoiceTotal(): number {
    const amt = parseFloat(this.invoiceForm.get('amount')?.value || 0);
    const gst = parseFloat(this.invoiceForm.get('gst')?.value || 0);
    return amt + gst;
  }

  submitInvoice(): void {
    if (this.invoiceForm.invalid) {
      this.invoiceForm.markAllAsTouched();
      const invalidControls: string[] = [];
      if (this.invoiceForm.get('purchase_order_id')?.invalid) invalidControls.push('Purchase Order');
      if (this.invoiceForm.get('invoice_number')?.invalid) invalidControls.push('Invoice Number');
      if (this.invoiceForm.get('invoice_date')?.invalid) invalidControls.push('Invoice Date');
      if (this.invoiceForm.get('amount')?.invalid) invalidControls.push('Amount');
      this.notify.error(`Please check the following required field(s): ${invalidControls.join(', ')}`);
      return;
    }

    const formVal = this.invoiceForm.getRawValue();
    this.submittingInvoice.set(true);

    if (this.invoiceFile) {
      this.uploadingAttachment.set(true);
      this.proc.uploadInvoiceAttachment(this.invoiceFile).subscribe({
        next: (uploadRes: { attachment_url: string }) => {
          this.uploadingAttachment.set(false);
          this.createInvoiceDoc(formVal, uploadRes.attachment_url);
        },
        error: () => {
          this.uploadingAttachment.set(false);
          this.notify.warning('Attachment upload failed, submitting invoice with auto-generated PDF.');
          this.createInvoiceDoc(formVal, undefined);
        },
      });
    } else {
      this.createInvoiceDoc(formVal, undefined);
    }
  }

  private createInvoiceDoc(formVal: any, attachmentUrl?: string): void {
    this.proc
      .createVendorInvoice({
        purchase_order_id: formVal.purchase_order_id,
        invoice_number: formVal.invoice_number,
        invoice_date: formVal.invoice_date,
        amount: parseFloat(formVal.amount),
        gst: parseFloat(formVal.gst || 0),
        attachment_url: attachmentUrl,
      })
      .subscribe({
        next: () => {
          this.submittingInvoice.set(false);
          this.notify.success(`Invoice ${formVal.invoice_number} compiled into PDF and sent to Procurement!`);
          this.closeSubmitInvoiceModal();
          this.loadAll();
        },
        error: (err: any) => {
          this.submittingInvoice.set(false);
          this.notify.error(err?.error?.detail || 'Failed to submit invoice');
        },
      });
  }

  downloadInvoicePDF(inv: Invoice): void {
    const id = inv._id || inv.id;
    if (!id) return;

    this.proc.downloadInvoicePDF(id).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${inv.invoice_number || 'invoice'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('Failed to download invoice PDF'),
    });
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  filteredNotifications = computed(() => {
    const list = this.notificationList();
    const filter = this.notificationFilter();
    if (filter === 'unread') {
      return list.filter((n) => !n.is_read);
    }
    return list;
  });

  unreadNotificationsCount = computed(() => {
    return this.notificationList().filter((n) => !n.is_read).length;
  });

  markAllNotificationsRead(): void {
    this.notificationList.update((items) => items.map((i) => ({ ...i, is_read: true })));
    this.notify.success('All notifications marked as read');
  }

  // ==========================================
  // PROFILE & PASSWORD
  // ==========================================
  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isSavingProfile.set(true);
    const formVal = this.profileForm.getRawValue();

    const materialsArray = formVal.materials_supplied
      ? formVal.materials_supplied
          .split(',')
          .map((m: string) => m.trim())
          .filter((m: string) => m.length > 0)
      : [];

    this.proc
      .updateVendorProfile({
        vendor_name: formVal.vendor_name,
        contact_person: formVal.contact_person,
        phone: formVal.phone,
        address: formVal.address,
        gst_number: formVal.gst_number,
        pan_number: formVal.pan_number,
        materials_supplied: materialsArray,
      })
      .subscribe({
        next: (updated: Vendor) => {
          this.isSavingProfile.set(false);
          this.notify.success('Company profile updated successfully.');
          this.populateProfileForm(updated);
          this.loadAll();
        },
        error: (err: any) => {
          this.isSavingProfile.set(false);
          this.notify.error(err?.error?.detail || 'Failed to update profile');
        },
      });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { current_password, new_password, confirm_password } = this.passwordForm.getRawValue();

    if (new_password !== confirm_password) {
      this.notify.error('New password and confirm password do not match.');
      return;
    }

    this.isChangingPassword.set(true);
    this.auth.changePassword(current_password, new_password).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.notify.success('Password changed successfully.');
        this.passwordForm.reset();
      },
      error: (err: any) => {
        this.isChangingPassword.set(false);
        this.notify.error(err?.error?.detail || 'Failed to change password. Please check your current password.');
      },
    });
  }

  // ==========================================
  // HELPERS
  // ==========================================
  formatDate(val?: string | Date): string {
    if (!val) return '-';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  priorityBadgeClass(priority?: string): string {
    const p = (priority || '').toLowerCase();
    if (p === 'high' || p === 'urgent') return 'badge-red';
    if (p === 'medium') return 'badge-amber';
    return 'badge-blue';
  }

  requestStatusBadge(status?: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'vendor_accepted' || s === 'po_generated' || s === 'po_sent' || s === 'approved') return 'badge-green';
    if (s === 'vendor_rejected' || s === 'rejected') return 'badge-red';
    if (s === 'vendor_assigned' || s === 'sent_to_vendor' || s === 'pending') return 'badge-amber';
    return 'badge-blue';
  }

  poStatusBadge(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'accepted') return 'badge-green';
    if (s === 'delivered' || s === 'received') return 'badge-blue';
    if (s === 'processing' || s === 'shipped') return 'badge-teal';
    if (s === 'rejected' || s === 'cancelled') return 'badge-red';
    return 'badge-amber';
  }

  deliveryStatusBadge(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'delivered' || s === 'received' || s === 'accepted') return 'badge-green';
    if (s === 'shipped') return 'badge-blue';
    if (s === 'processing') return 'badge-teal';
    if (s === 'cancelled' || s === 'rejected') return 'badge-red';
    return 'badge-amber';
  }

  invoiceStatusBadge(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'approved' || s === 'verified') return 'badge-green';
    if (s === 'rejected') return 'badge-red';
    return 'badge-amber';
  }

  paymentStatusBadge(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'paid') return 'badge-green';
    if (s === 'approved') return 'badge-blue';
    return 'badge-amber';
  }
}

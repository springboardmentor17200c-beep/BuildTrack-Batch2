import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

type TabKey = 'requests' | 'purchase-orders' | 'vendors' | 'invoices';
type RequestStatus = 'pending' | 'approved' | 'ordered' | 'delivered' | 'cancelled';
type PurchaseStatus = 'draft' | 'issued' | 'partially_received' | 'completed' | 'cancelled';
type InvoiceStatus = 'pending' | 'approved' | 'paid' | 'overdue' | 'rejected';

interface ProcurementItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_cost: number;
}

interface ProcurementRequest {
  _id: string;
  vendor_id: string;
  project_id?: string;
  items: ProcurementItem[];
  requested_by: string;
  request_date: string;
  expected_delivery?: string;
  status: RequestStatus;
  total_amount: number;
  notes?: string;
}

interface Vendor {
  _id: string;
  vendor_name: string;
  contact_person: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  rating: number;
  payment_terms?: string;
}

interface PurchaseOrderRecord {
  _id: string;
  procurement_id: string;
  vendor_id: string;
  po_number: string;
  issue_date: string;
  expected_delivery?: string;
  status: PurchaseStatus;
  total_amount: number;
  notes?: string;
}

interface InvoiceRecord {
  _id: string;
  purchase_order_id: string;
  invoice_number: string;
  vendor_id: string;
  invoice_date: string;
  due_date?: string;
  amount: number;
  status: InvoiceStatus;
  notes?: string;
}

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './procurement.component.html',
  styleUrl: './procurement.component.scss',
})
export class ProcurementComponent {
  private readonly fb = new FormBuilder();
  private readonly baseUrl = `${environment.apiBaseUrl}/procurement`;

  activeTab = signal<TabKey>('requests');
  searchTerm = signal('');
  loading = signal(false);
  error = signal('');
  success = signal('');
  modal = signal<TabKey | null>(null);
  selected = signal<any | null>(null);

  requests = signal<ProcurementRequest[]>([]);
  vendors = signal<Vendor[]>([]);
  purchaseOrders = signal<PurchaseOrderRecord[]>([]);
  invoices = signal<InvoiceRecord[]>([]);

  requestForm = this.fb.group({
    vendor_id: ['', Validators.required],
    project_id: [''],
    item_name: ['', Validators.required],
    quantity: [null as number | null, [Validators.required, Validators.min(1)]],
    unit_price: [null as number | null, [Validators.required, Validators.min(0)]],
    requested_by: ['', Validators.required],
    request_date: ['', Validators.required],
    expected_delivery: [''],
    status: ['pending' as RequestStatus, Validators.required],
    notes: [''],
  });

  vendorForm = this.fb.group({
    vendor_name: ['', Validators.required],
    contact_person: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.required],
    address: [''],
    city: [''],
    rating: [null as number | null, [Validators.min(0), Validators.max(5)]],
    payment_terms: [''],
  });

  purchaseForm = this.fb.group({
    procurement_id: ['', Validators.required],
    vendor_id: ['', Validators.required],
    po_number: ['', Validators.required],
    issue_date: ['', Validators.required],
    expected_delivery: [''],
    status: ['draft' as PurchaseStatus, Validators.required],
    total_amount: [null as number | null, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  invoiceForm = this.fb.group({
    purchase_order_id: ['', Validators.required],
    invoice_number: ['', Validators.required],
    vendor_id: ['', Validators.required],
    invoice_date: ['', Validators.required],
    due_date: [''],
    amount: [null as number | null, [Validators.required, Validators.min(0)]],
    status: ['pending' as InvoiceStatus, Validators.required],
    notes: [''],
  });

  filteredRequests = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return this.requests().filter((item) => this.match(term, [this.vendorName(item.vendor_id), this.itemSummary(item), item.status]));
  });

  filteredVendors = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return this.vendors().filter((item) => this.match(term, [item.vendor_name, item.contact_person, item.email, item.phone, item.city]));
  });

  filteredPurchaseOrders = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return this.purchaseOrders().filter((item) => this.match(term, [item.po_number, this.vendorName(item.vendor_id), item.status]));
  });

  filteredInvoices = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return this.invoices().filter((item) => this.match(term, [item.invoice_number, this.vendorName(item.vendor_id), item.status]));
  });

  pageTitle = computed(() => {
    switch (this.activeTab()) {
      case 'purchase-orders':
        return 'Purchase Orders';
      case 'vendors':
        return 'Vendor / Supplier Management';
      case 'invoices':
        return 'Invoice Tracking';
      default:
        return 'Procurement Management';
    }
  });

  constructor(private readonly http: HttpClient) {
    this.activeTab.set(this.tabFromPath(window.location.pathname));
    this.loadAll();
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    this.searchTerm.set('');
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  loadAll(): void {
    this.loading.set(true);
    this.error.set('');
    this.get<ProcurementRequest[]>('', (data) => this.requests.set(data));
    this.get<Vendor[]>('vendors', (data) => this.vendors.set(data));
    this.get<PurchaseOrderRecord[]>('purchase-orders', (data) => this.purchaseOrders.set(data));
    this.get<InvoiceRecord[]>('invoices', (data) => {
      this.invoices.set(data);
      this.loading.set(false);
    });
  }

  openAdd(tab: TabKey): void {
    this.selected.set(null);
    this.resetForm(tab);
    this.modal.set(tab);
  }

  openEdit(tab: TabKey, item: any): void {
    this.selected.set(item);
    this.patchForm(tab, item);
    this.modal.set(tab);
  }

  openDetails(item: any): void {
    this.selected.set(item);
  }

  closeModal(): void {
    this.modal.set(null);
  }

  closeDetails(): void {
    this.selected.set(null);
  }

  saveRequest(): void {
    if (this.requestForm.invalid) return this.touch(this.requestForm);
    const value = this.requestForm.getRawValue();
    const quantity = Number(value.quantity ?? 0);
    const unitPrice = Number(value.unit_price ?? 0);
    const payload = {
      vendor_id: value.vendor_id!,
      project_id: value.project_id || undefined,
      items: [{ item_name: value.item_name!, quantity, unit_price: unitPrice, total_cost: quantity * unitPrice }],
      requested_by: value.requested_by!,
      request_date: this.toIso(value.request_date!),
      expected_delivery: value.expected_delivery ? this.toIso(value.expected_delivery) : undefined,
      status: value.status!,
      total_amount: quantity * unitPrice,
      notes: value.notes || undefined,
    };
    const current = this.selected() as ProcurementRequest | null;
    current ? this.put('', current._id, { status: payload.status, expected_delivery: payload.expected_delivery, notes: payload.notes }) : this.post('', payload);
  }

  saveVendor(): void {
    if (this.vendorForm.invalid) return this.touch(this.vendorForm);
    const value = this.vendorForm.getRawValue();
    const payload = { ...value, rating: value.rating === null || value.rating === undefined ? undefined : Number(value.rating) };
    const current = this.selected() as Vendor | null;
    current ? this.put('vendors', current._id, payload) : this.post('vendors', payload);
  }

  savePurchaseOrder(): void {
    if (this.purchaseForm.invalid) return this.touch(this.purchaseForm);
    const value = this.purchaseForm.getRawValue();
    const payload = {
      procurement_id: value.procurement_id!,
      vendor_id: value.vendor_id!,
      po_number: value.po_number!,
      issue_date: this.toIso(value.issue_date!),
      expected_delivery: value.expected_delivery ? this.toIso(value.expected_delivery) : undefined,
      status: value.status!,
      total_amount: Number(value.total_amount ?? 0),
      notes: value.notes || undefined,
    };
    const current = this.selected() as PurchaseOrderRecord | null;
    current ? this.put('purchase-orders', current._id, payload) : this.post('purchase-orders', payload);
  }

  saveInvoice(): void {
    if (this.invoiceForm.invalid) return this.touch(this.invoiceForm);
    const value = this.invoiceForm.getRawValue();
    const payload = {
      purchase_order_id: value.purchase_order_id!,
      invoice_number: value.invoice_number!,
      vendor_id: value.vendor_id!,
      invoice_date: this.toIso(value.invoice_date!),
      due_date: value.due_date ? this.toIso(value.due_date) : undefined,
      amount: Number(value.amount ?? 0),
      status: value.status!,
      notes: value.notes || undefined,
    };
    const current = this.selected() as InvoiceRecord | null;
    current ? this.put('invoices', current._id, payload) : this.post('invoices', payload);
  }

  remove(tab: TabKey, id: string, label: string): void {
    if (!confirm(`Delete ${label}?`)) return;
    const path = tab === 'requests' ? '' : tab;
    this.http.delete(`${this.url(path)}/${id}`).subscribe({
      next: () => this.afterSave('Deleted successfully.'),
      error: () => this.error.set('Delete failed. Please check login role and backend.'),
    });
  }

  vendorName(id?: string): string {
    return this.vendors().find((vendor) => vendor._id === id)?.vendor_name ?? id ?? 'Supplier';
  }

  itemSummary(request: ProcurementRequest): string {
    return request.items?.map((item) => item.item_name).join(', ') || 'Procurement item';
  }

  statusClass(status: string): string {
    if (['delivered', 'completed', 'paid', 'approved'].includes(status)) return 'badge-green';
    if (['ordered', 'issued', 'partially_received'].includes(status)) return 'badge-blue';
    if (['pending', 'draft', 'overdue'].includes(status)) return 'badge-amber';
    return 'badge-red';
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
  }

  private get<T>(path: string, next: (data: T) => void): void {
    this.http.get<T>(this.url(path)).subscribe({
      next,
      error: () => {
        this.error.set('Procurement data load nahi hua. Backend/login check karo.');
        this.loading.set(false);
      },
    });
  }

  private post(path: string, payload: any): void {
    this.http.post(this.url(path), payload).subscribe({
      next: () => this.afterSave('Saved successfully.'),
      error: () => this.error.set('Save failed. Required fields, login role, or backend API check karo.'),
    });
  }

  private put(path: string, id: string, payload: any): void {
    this.http.put(`${this.url(path)}/${id}`, payload).subscribe({
      next: () => this.afterSave('Updated successfully.'),
      error: () => this.error.set('Update failed. Backend role or API payload check karo.'),
    });
  }

  private afterSave(message: string): void {
    this.success.set(message);
    this.closeModal();
    this.closeDetails();
    this.loadAll();
    setTimeout(() => this.success.set(''), 2500);
  }

  private url(path: string): string {
    return path ? `${this.baseUrl}/${path}` : `${this.baseUrl}/`;
  }

  private resetForm(tab: TabKey): void {
    if (tab === 'requests') this.requestForm.reset({ status: 'pending' });
    if (tab === 'vendors') this.vendorForm.reset();
    if (tab === 'purchase-orders') this.purchaseForm.reset({ status: 'draft' });
    if (tab === 'invoices') this.invoiceForm.reset({ status: 'pending' });
  }

  private patchForm(tab: TabKey, item: any): void {
    if (tab === 'requests') {
      const first = item.items?.[0];
      this.requestForm.reset({
        vendor_id: item.vendor_id,
        project_id: item.project_id,
        item_name: first?.item_name ?? '',
        quantity: first?.quantity ?? 1,
        unit_price: first?.unit_price ?? 0,
        requested_by: item.requested_by,
        request_date: this.toInputDate(item.request_date),
        expected_delivery: this.toInputDate(item.expected_delivery),
        status: item.status,
        notes: item.notes,
      });
    }
    if (tab === 'vendors') this.vendorForm.reset(item);
    if (tab === 'purchase-orders') this.purchaseForm.reset({ ...item, issue_date: this.toInputDate(item.issue_date), expected_delivery: this.toInputDate(item.expected_delivery) });
    if (tab === 'invoices') this.invoiceForm.reset({ ...item, invoice_date: this.toInputDate(item.invoice_date), due_date: this.toInputDate(item.due_date) });
  }

  private match(term: string, values: Array<string | undefined>): boolean {
    return !term || values.some((value) => String(value ?? '').toLowerCase().includes(term));
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private tabFromPath(path: string): TabKey {
    if (path.includes('/purchase-orders')) return 'purchase-orders';
    if (path.includes('/vendors') || path.includes('/suppliers')) return 'vendors';
    if (path.includes('/invoices')) return 'invoices';
    return 'requests';
  }

  private toIso(value: string): string {
    return new Date(`${value}T00:00:00`).toISOString();
  }

  private toInputDate(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }

  private touch(form: { markAllAsTouched: () => void }): void {
    form.markAllAsTouched();
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Invoice,
  MaterialDelivery,
  MaterialItem,
  MaterialRequest,
  PaginatedResponse,
  Payment,
  ProcurementDashboardStats,
  ProcurementInventoryItem,
  PurchaseOrderRecord,
  Vendor,
  VendorDashboardStats,
} from '../models/models';

export interface QueryParams {
  skip?: number;
  limit?: number;
  search?: string;
  status_filter?: string;
  priority?: string;
  sort_by?: string;
  sort_dir?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ProcurementService {
  private readonly baseUrl = `${environment.apiBaseUrl}/procurement`;

  constructor(private readonly http: HttpClient) {}

  private buildParams(params?: QueryParams): HttpParams {
    let httpParams = new HttpParams();
    if (!params) return httpParams;

    if (params.skip !== undefined && params.skip !== null) {
      httpParams = httpParams.set('skip', params.skip.toString());
    }
    if (params.limit !== undefined && params.limit !== null) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.status_filter) {
      httpParams = httpParams.set('status_filter', params.status_filter);
    }
    if (params.priority) {
      httpParams = httpParams.set('priority', params.priority);
    }
    if (params.sort_by) {
      httpParams = httpParams.set('sort_by', params.sort_by);
    }
    if (params.sort_dir) {
      httpParams = httpParams.set('sort_dir', params.sort_dir);
    }

    return httpParams;
  }

  private normalizePage<T>(response: PaginatedResponse<T> | T[]): PaginatedResponse<T> {
    if (Array.isArray(response)) {
      return { items: response, total: response.length };
    }
    return response;
  }

  // Dashboard
  getDashboardStats(): Observable<ProcurementDashboardStats> {
    return this.http.get<ProcurementDashboardStats>(`${this.baseUrl}/dashboard`);
  }

  // Vendors
  getVendors(params?: QueryParams): Observable<PaginatedResponse<Vendor>> {
    return this.http.get<PaginatedResponse<Vendor> | Vendor[]>(`${this.baseUrl}/vendors`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  getActiveVendors(params?: QueryParams): Observable<PaginatedResponse<Vendor>> {
    return this.http.get<PaginatedResponse<Vendor> | Vendor[]>(`${this.baseUrl}/vendors/active`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  getVendor(id: string): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.baseUrl}/vendors/${id}`);
  }

  createVendor(vendor: Partial<Vendor>): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.baseUrl}/vendors`, vendor);
  }

  /** Create vendor record + optional login account in one atomic call. */
  createVendorWithAccount(payload: {
    vendor: Partial<Vendor>;
    create_login_account: boolean;
    password?: string;
  }): Observable<{
    vendor: Vendor;
    user_created: boolean;
    message: string;
    user?: { _id: string; email: string; full_name: string; role: string; vendor_id: string };
  }> {
    const body = {
      ...payload.vendor,
      create_login_account: payload.create_login_account,
      password: payload.password,
    };
    return this.http.post<{
      vendor: Vendor;
      user_created: boolean;
      message: string;
      user?: { _id: string; email: string; full_name: string; role: string; vendor_id: string };
    }>(`${this.baseUrl}/vendors/create-account`, body);
  }

  updateVendor(id: string, vendor: Partial<Vendor>): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.baseUrl}/vendors/${id}`, vendor);
  }

  deleteVendor(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/vendors/${id}`);
  }

  // Material Requests
  getMaterialRequests(params?: QueryParams): Observable<PaginatedResponse<MaterialRequest>> {
    return this.http.get<PaginatedResponse<MaterialRequest> | MaterialRequest[]>(`${this.baseUrl}/material-requests`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  getMaterialRequest(id: string): Observable<MaterialRequest> {
    return this.http.get<MaterialRequest>(`${this.baseUrl}/material-requests/${id}`);
  }

  createMaterialRequest(request: Partial<MaterialRequest>): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.baseUrl}/material-requests`, request);
  }

  updateMaterialRequest(id: string, request: Partial<MaterialRequest>): Observable<MaterialRequest> {
    return this.http.put<MaterialRequest>(`${this.baseUrl}/material-requests/${id}`, request);
  }

  approveMaterialRequest(
    id: string,
    action: { status: 'approved' | 'rejected'; comments?: string }
  ): Observable<MaterialRequest> {
    return this.http.patch<MaterialRequest>(`${this.baseUrl}/material-requests/${id}/approval`, action);
  }

  assignVendorToMaterialRequest(id: string, vendorId: string): Observable<MaterialRequest> {
    return this.http.put<MaterialRequest>(`${this.baseUrl}/material-requests/${id}/assign-vendor`, {
      vendor_id: vendorId,
    });
  }

  deleteMaterialRequest(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/material-requests/${id}`);
  }

  // Purchase Orders
  getPurchaseOrders(params?: QueryParams): Observable<PaginatedResponse<PurchaseOrderRecord>> {
    return this.http.get<PaginatedResponse<PurchaseOrderRecord> | PurchaseOrderRecord[]>(`${this.baseUrl}/purchase-orders`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  getPurchaseOrder(id: string): Observable<PurchaseOrderRecord> {
    return this.http.get<PurchaseOrderRecord>(`${this.baseUrl}/purchase-orders/${id}`);
  }

  createPurchaseOrder(po: Partial<PurchaseOrderRecord>): Observable<PurchaseOrderRecord> {
    return this.http.post<PurchaseOrderRecord>(`${this.baseUrl}/purchase-orders`, po);
  }

  updatePurchaseOrder(id: string, po: Partial<PurchaseOrderRecord>): Observable<PurchaseOrderRecord> {
    return this.http.put<PurchaseOrderRecord>(`${this.baseUrl}/purchase-orders/${id}`, po);
  }

  updatePOStatus(id: string, status: string): Observable<PurchaseOrderRecord> {
    return this.http.patch<PurchaseOrderRecord>(`${this.baseUrl}/purchase-orders/${id}/status`, { status });
  }

  sendPurchaseOrder(id: string): Observable<PurchaseOrderRecord> {
    return this.http.put<PurchaseOrderRecord>(`${this.baseUrl}/purchase-orders/${id}/send`, {});
  }

  deletePurchaseOrder(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/purchase-orders/${id}`);
  }

  downloadPOPDF(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/purchase-orders/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  // Deliveries
  getDeliveries(params?: QueryParams): Observable<PaginatedResponse<MaterialDelivery>> {
    return this.http.get<PaginatedResponse<MaterialDelivery> | MaterialDelivery[]>(`${this.baseUrl}/deliveries`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  createDelivery(delivery: Partial<MaterialDelivery>): Observable<MaterialDelivery> {
    return this.http.post<MaterialDelivery>(`${this.baseUrl}/deliveries`, delivery);
  }

  updateDelivery(id: string, delivery: Partial<MaterialDelivery>): Observable<MaterialDelivery> {
    return this.http.put<MaterialDelivery>(`${this.baseUrl}/deliveries/${id}`, delivery);
  }


  // Inventory
  getInventory(params?: QueryParams): Observable<PaginatedResponse<ProcurementInventoryItem>> {
    return this.http.get<PaginatedResponse<ProcurementInventoryItem> | ProcurementInventoryItem[]>(`${this.baseUrl}/inventory`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  // Invoices
  getInvoices(params?: QueryParams): Observable<PaginatedResponse<Invoice>> {
    return this.http.get<PaginatedResponse<Invoice> | Invoice[]>(`${this.baseUrl}/invoices`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  createInvoice(invoice: Partial<Invoice>): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/invoices`, invoice);
  }

  uploadInvoiceAttachment(file: File): Observable<{ attachment_url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ attachment_url: string }>(`${this.baseUrl}/invoices/upload`, formData);
  }

  updateInvoice(id: string, invoice: Partial<Invoice>): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.baseUrl}/invoices/${id}`, invoice);
  }

  downloadInvoicePDF(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
  }

  invoiceAction(
    id: string,
    action: 'verify' | 'approve' | 'reject',
    payload: { comments?: string }
  ): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.baseUrl}/invoices/${id}/${action}`, payload);
  }

  deleteInvoice(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/invoices/${id}`);
  }

  // Payments
  getPayments(params?: QueryParams): Observable<PaginatedResponse<Payment>> {
    return this.http.get<PaginatedResponse<Payment> | Payment[]>(`${this.baseUrl}/payments`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  createPayment(payment: Partial<Payment>): Observable<Payment> {
    return this.http.post<Payment>(`${this.baseUrl}/payments`, payment);
  }

  updatePayment(id: string, payment: Partial<Payment>): Observable<Payment> {
    return this.http.put<Payment>(`${this.baseUrl}/payments/${id}`, payment);
  }

  quickPayInvoice(invoiceId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/invoices/${invoiceId}/quick-pay`, {});
  }

  getInvoicePaymentStatus(invoiceId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/invoices/${invoiceId}/status`);
  }

          // Materials master (driven by real inventory records in the DB)
  getMaterials(): Observable<MaterialItem[]> {
    return this.http.get<MaterialItem[]>(`${this.baseUrl}/materials`);
  }

  // Projects (database-driven dropdown)
  getProjects(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiBaseUrl}/projects`);
  }


  // Inventory transaction history
  getInventoryHistory(materialId?: string): Observable<any> {
    const params = new HttpParams();
    if (materialId) {
      return this.http.get<any>(`${this.baseUrl}/inventory/history`, { params: params.set('material_id', materialId) });
    }
    return this.http.get<any>(`${this.baseUrl}/inventory/history`);
  }

  // Vendor response to a procurement request
  vendorAcceptRequest(requestId: string): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.baseUrl}/material-requests/${requestId}/vendor-accept`, {});
  }

  vendorRejectRequest(requestId: string, comment: string): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.baseUrl}/material-requests/${requestId}/vendor-reject`, {
      action: 'reject',
      comment,
    });
  }

  // Vendor confirms a purchase order
  acceptPurchaseOrder(poId: string): Observable<PurchaseOrderRecord> {
    return this.http.post<PurchaseOrderRecord>(`${this.baseUrl}/vendor/purchase-orders/${poId}/accept`, {});
  }

  // Vendor material requests
  getVendorMaterialRequests(params?: QueryParams): Observable<PaginatedResponse<MaterialRequest>> {
    return this.http.get<PaginatedResponse<MaterialRequest> | MaterialRequest[]>(`${this.baseUrl}/vendor/material-requests`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  vendorAcceptMaterialRequest(requestId: string): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.baseUrl}/vendor/material-requests/${requestId}/accept`, {});
  }

  vendorRejectMaterialRequest(requestId: string, reason: string): Observable<MaterialRequest> {
    return this.http.post<MaterialRequest>(`${this.baseUrl}/vendor/material-requests/${requestId}/reject`, { reason });
  }

  vendorAcceptPO(poId: string): Observable<PurchaseOrderRecord> {
    return this.http.post<PurchaseOrderRecord>(`${this.baseUrl}/vendor/purchase-orders/${poId}/accept`, {});
  }

  vendorRejectPO(poId: string, reason: string): Observable<PurchaseOrderRecord> {
    return this.http.post<PurchaseOrderRecord>(`${this.baseUrl}/vendor/purchase-orders/${poId}/reject`, { reason });
  }

  // Vendor purchase orders
  getVendorPurchaseOrders(params?: QueryParams): Observable<PaginatedResponse<PurchaseOrderRecord>> {
    return this.http.get<PaginatedResponse<PurchaseOrderRecord> | PurchaseOrderRecord[]>(`${this.baseUrl}/vendor/purchase-orders`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  // Vendor deliveries
  getVendorDeliveries(params?: QueryParams): Observable<PaginatedResponse<MaterialDelivery>> {
    return this.http.get<PaginatedResponse<MaterialDelivery> | MaterialDelivery[]>(`${this.baseUrl}/vendor/deliveries`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  createVendorDelivery(delivery: {
    purchase_order_id: string;
    quantity: number;
    dispatch_date?: string;
    vehicle_number?: string;
    tracking_number?: string;
    remarks?: string;
    status?: string;
  }): Observable<MaterialDelivery> {
    return this.http.post<MaterialDelivery>(`${this.baseUrl}/vendor/deliveries`, delivery);
  }

  updateVendorDelivery(
    deliveryId: string,
    payload: { status: string; vehicle_number?: string; tracking_number?: string; remarks?: string }
  ): Observable<MaterialDelivery> {
    return this.http.put<MaterialDelivery>(`${this.baseUrl}/vendor/deliveries/${deliveryId}`, payload);
  }

  // Vendor invoices
  getVendorInvoices(params?: QueryParams): Observable<PaginatedResponse<Invoice>> {
    return this.http.get<PaginatedResponse<Invoice> | Invoice[]>(`${this.baseUrl}/vendor/invoices`, {
      params: this.buildParams(params),
    }).pipe(map((response) => this.normalizePage(response)));
  }

  createVendorInvoice(invoice: Partial<Invoice>): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.baseUrl}/vendor/invoices`, invoice);
  }

  // Vendor profile
  getVendorProfile(): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.baseUrl}/vendor/profile`);
  }

  updateVendorProfile(vendor: Partial<Vendor>): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.baseUrl}/vendor/profile`, vendor);
  }

  // Vendor dashboard
  getVendorDashboard(): Observable<VendorDashboardStats> {
    return this.http.get<VendorDashboardStats>(`${this.baseUrl}/vendor/dashboard`);
  }

  // Generate a purchase order from an accepted vendor request
  generatePOFromRequest(requestId: string, unitPrice: number, gst = 0): Observable<PurchaseOrderRecord> {
    return this.http.post<PurchaseOrderRecord>(`${this.baseUrl}/purchase-orders`, {
      request_id: requestId,
      unit_price: unitPrice,
      gst,
    });
  }
}

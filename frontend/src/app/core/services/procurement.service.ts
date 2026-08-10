import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Invoice,
  MaterialDelivery,
  MaterialRequest,
  PaginatedResponse,
  Payment,
  ProcurementDashboardStats,
  ProcurementInventoryItem,
  PurchaseOrderRecord,
  Vendor,
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

  // Dashboard
  getDashboardStats(): Observable<ProcurementDashboardStats> {
    return this.http.get<ProcurementDashboardStats>(`${this.baseUrl}/dashboard`);
  }

  // Vendors
  getVendors(params?: QueryParams): Observable<PaginatedResponse<Vendor>> {
    return this.http.get<PaginatedResponse<Vendor>>(`${this.baseUrl}/vendors`, {
      params: this.buildParams(params),
    });
  }

  getVendor(id: string): Observable<Vendor> {
    return this.http.get<Vendor>(`${this.baseUrl}/vendors/${id}`);
  }

  createVendor(vendor: Partial<Vendor>): Observable<Vendor> {
    return this.http.post<Vendor>(`${this.baseUrl}/vendors`, vendor);
  }

  updateVendor(id: string, vendor: Partial<Vendor>): Observable<Vendor> {
    return this.http.put<Vendor>(`${this.baseUrl}/vendors/${id}`, vendor);
  }

  deleteVendor(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/vendors/${id}`);
  }

  // Material Requests
  getMaterialRequests(params?: QueryParams): Observable<PaginatedResponse<MaterialRequest>> {
    return this.http.get<PaginatedResponse<MaterialRequest>>(`${this.baseUrl}/material-requests`, {
      params: this.buildParams(params),
    });
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

  deleteMaterialRequest(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/material-requests/${id}`);
  }

  // Purchase Orders
  getPurchaseOrders(params?: QueryParams): Observable<PaginatedResponse<PurchaseOrderRecord>> {
    return this.http.get<PaginatedResponse<PurchaseOrderRecord>>(`${this.baseUrl}/purchase-orders`, {
      params: this.buildParams(params),
    });
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
    return this.http.get<PaginatedResponse<MaterialDelivery>>(`${this.baseUrl}/deliveries`, {
      params: this.buildParams(params),
    });
  }

  createDelivery(delivery: Partial<MaterialDelivery>): Observable<MaterialDelivery> {
    return this.http.post<MaterialDelivery>(`${this.baseUrl}/deliveries`, delivery);
  }

  updateDelivery(id: string, delivery: Partial<MaterialDelivery>): Observable<MaterialDelivery> {
    return this.http.put<MaterialDelivery>(`${this.baseUrl}/deliveries/${id}`, delivery);
  }

  // Inventory
  getInventory(params?: QueryParams): Observable<PaginatedResponse<ProcurementInventoryItem>> {
    return this.http.get<PaginatedResponse<ProcurementInventoryItem>>(`${this.baseUrl}/inventory`, {
      params: this.buildParams(params),
    });
  }

  // Invoices
  getInvoices(params?: QueryParams): Observable<PaginatedResponse<Invoice>> {
    return this.http.get<PaginatedResponse<Invoice>>(`${this.baseUrl}/invoices`, {
      params: this.buildParams(params),
    });
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

  invoiceAction(
    id: string,
    action: 'verify' | 'approve' | 'reject',
    payload: { comments?: string }
  ): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.baseUrl}/invoices/${id}/${action}`, payload);
  }

  // Payments
  getPayments(params?: QueryParams): Observable<PaginatedResponse<Payment>> {
    return this.http.get<PaginatedResponse<Payment>>(`${this.baseUrl}/payments`, {
      params: this.buildParams(params),
    });
  }

  createPayment(payment: Partial<Payment>): Observable<Payment> {
    return this.http.post<Payment>(`${this.baseUrl}/payments`, payment);
  }

  updatePayment(id: string, payment: Partial<Payment>): Observable<Payment> {
    return this.http.put<Payment>(`${this.baseUrl}/payments/${id}`, payment);
  }
}

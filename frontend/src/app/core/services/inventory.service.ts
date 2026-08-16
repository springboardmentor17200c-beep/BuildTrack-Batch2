import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LiveInventoryItem {
  id?: string;
  _id?: string;
  material_name: string;
  itemName?: string;
  material?: string;
  category?: string;
  quantity: number;
  stock?: number;
  stock_quantity?: number;
  unit: string;
  unit_cost?: number;
  location?: string;
  status: string;
  reorder_level?: number;
  updated_at?: string;
  transactions?: any[];
}

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  getItems(): Observable<LiveInventoryItem[]> {
    return this.http.get<LiveInventoryItem[]>(`${this.baseUrl}/inventory/`);
  }

  createItem(item: Partial<LiveInventoryItem>): Observable<LiveInventoryItem> {
    return this.http.post<LiveInventoryItem>(`${this.baseUrl}/inventory/`, item);
  }

  updateItem(id: string, item: Partial<LiveInventoryItem>): Observable<LiveInventoryItem> {
    return this.http.put<LiveInventoryItem>(`${this.baseUrl}/inventory/${id}`, item);
  }

  deleteItem(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/inventory/${id}`);
  }

  getLowStockItems(): Observable<LiveInventoryItem[]> {
    return this.http.get<LiveInventoryItem[]>(`${this.baseUrl}/inventory/low-stock`);
  }
}

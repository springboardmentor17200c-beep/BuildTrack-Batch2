import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationItem } from '../models/models';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

export interface NotificationQueryParams {
  skip?: number;
  limit?: number;
  category?: string;
  is_read?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly baseUrl = `${environment.apiBaseUrl}/notifications`;

  readonly toasts = signal<Toast[]>([]);
  readonly unreadCount = signal<number>(0);
  readonly notifications = signal<NotificationItem[]>([]);
  private seq = 0;

  constructor(private readonly http: HttpClient) {}

  // Toast notification methods
  success(message: string): void {
    this.push(message, 'success');
  }

  error(message: string): void {
    this.push(message, 'error');
  }

  info(message: string): void {
    this.push(message, 'info');
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(message: string, type: ToastType): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { id, message, type }]);
    setTimeout(() => this.dismiss(id), 4500);
  }

  // Backend API methods
  getNotifications(params?: NotificationQueryParams): Observable<NotificationItem[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.skip !== undefined && params.skip !== null) {
        httpParams = httpParams.set('skip', params.skip.toString());
      }
      if (params.limit !== undefined && params.limit !== null) {
        httpParams = httpParams.set('limit', params.limit.toString());
      }
      if (params.category && params.category !== 'all') {
        httpParams = httpParams.set('category', params.category);
      }
      if (params.is_read !== undefined && params.is_read !== null) {
        httpParams = httpParams.set('is_read', params.is_read.toString());
      }
    }

    return this.http
      .get<NotificationItem[]>(this.baseUrl, { params: httpParams })
      .pipe(
        tap((items) => {
          this.notifications.set(items);
        })
      );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.baseUrl}/unread-count`).pipe(
      tap((res) => {
        this.unreadCount.set(res.count);
      })
    );
  }

  markAsRead(id: string): Observable<NotificationItem> {
    return this.http.patch<NotificationItem>(`${this.baseUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this.getUnreadCount().subscribe();
      })
    );
  }

  markAllAsRead(): Observable<{ message: string; count: number }> {
    return this.http.patch<{ message: string; count: number }>(`${this.baseUrl}/read-all`, {}).pipe(
      tap(() => {
        this.unreadCount.set(0);
        this.notifications.update((list) => list.map((item) => ({ ...item, is_read: true })));
      })
    );
  }

  deleteNotification(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.notifications.update((list) => list.filter((item) => (item._id || item.id) !== id));
        this.getUnreadCount().subscribe();
      })
    );
  }
}


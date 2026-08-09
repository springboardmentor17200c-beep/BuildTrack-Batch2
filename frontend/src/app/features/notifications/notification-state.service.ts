import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { NotificationApiService } from './notification-api.service';

@Injectable({
  providedIn: 'root',
})
export class NotificationStateService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  constructor(private notificationApi: NotificationApiService) {}

  setUnreadCount(count: number): void {
    this.unreadCountSubject.next(count);
  }

  refreshUnreadCount(): void {
    this.notificationApi.getUnreadNotifications().subscribe({
      next: (notifications: any[]) => {
        this.unreadCountSubject.next(Array.isArray(notifications) ? notifications.length : 0);
      },
      error: () => {
        this.unreadCountSubject.next(0);
      },
    });
  }
}

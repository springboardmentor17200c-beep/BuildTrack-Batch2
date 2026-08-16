import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationItem } from '../../core/models/models';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notification.component.html',
  styleUrl: './notification.component.scss',
})
export class NotificationComponent implements OnInit {
  selectedCategory = signal<string>('all');
  readStatusFilter = signal<'all' | 'unread' | 'read'>('all');
  notifications = signal<NotificationItem[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  categories = [
    { label: 'All', value: 'all', icon: 'fa-layer-group' },
    { label: 'Project Updates', value: 'project_update', icon: 'fa-building' },
    { label: 'Task Assignments', value: 'task_assignment', icon: 'fa-list-check' },
    { label: 'Procurement Alerts', value: 'procurement_alert', icon: 'fa-truck-field' },
    { label: 'Attendance Alerts', value: 'attendance_alert', icon: 'fa-user-clock' },
    { label: 'Deadlines', value: 'deadline', icon: 'fa-clock' },
    { label: 'System', value: 'system', icon: 'fa-shield-halved' },
  ];

  constructor(
    public readonly notificationService: NotificationService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.error.set(null);

    const isReadParam =
      this.readStatusFilter() === 'unread'
        ? false
        : this.readStatusFilter() === 'read'
        ? true
        : undefined;

    this.notificationService
      .getNotifications({
        category: this.selectedCategory(),
        is_read: isReadParam,
        limit: 50,
      })
      .subscribe({
        next: (data) => {
          this.notifications.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load notifications. Please try again.');
          this.loading.set(false);
        },
      });

    this.notificationService.getUnreadCount().subscribe();
  }

  setCategory(category: string): void {
    this.selectedCategory.set(category);
    this.loadNotifications();
  }

  setReadStatus(status: 'all' | 'unread' | 'read'): void {
    this.readStatusFilter.set(status);
    this.loadNotifications();
  }

  markAsRead(item: NotificationItem, event: MouseEvent): void {
    event.stopPropagation();
    const id = item._id || item.id;
    if (!id || item.is_read) return;

    this.notificationService.markAsRead(id).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((n) => ((n._id || n.id) === id ? { ...n, is_read: true } : n))
        );
      },
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((n) => ({ ...n, is_read: true })));
      },
    });
  }

  deleteNotification(item: NotificationItem, event: MouseEvent): void {
    event.stopPropagation();
    const id = item._id || item.id;
    if (!id) return;

    this.notificationService.deleteNotification(id).subscribe({
      next: () => {
        this.notifications.update((list) => list.filter((n) => (n._id || n.id) !== id));
      },
    });
  }

  onNotificationClick(item: NotificationItem): void {
    const id = item._id || item.id;
    if (id && !item.is_read) {
      this.notificationService.markAsRead(id).subscribe();
    }

    if (item.entity_type === 'project' && item.entity_id) {
      this.router.navigate(['/projects', item.entity_id]);
    } else if (item.entity_type === 'procurement') {
      this.router.navigate(['/procurement']);
    } else if (item.entity_type === 'attendance') {
      this.router.navigate(['/attendance']);
    } else if (item.entity_type === 'task' || item.category === 'task_assignment') {
      this.router.navigate(['/workers']);
    }
  }

  getCategoryIcon(category: string): string {
    const found = this.categories.find((c) => c.value === category);
    return found ? found.icon : 'fa-bell';
  }

  getCategoryLabel(category: string): string {
    const found = this.categories.find((c) => c.value === category);
    return found ? found.label : 'Notification';
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }
}


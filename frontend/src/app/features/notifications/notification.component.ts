import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationApiService } from './notification-api.service';
import { NotificationStateService } from './notification-state.service';


@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './notification.component.html',
  styleUrls: ['./notification.component.scss']
})
export class NotificationComponent implements OnInit {

  notifications: any[] = [];
  filteredNotifications: any[] = [];
  seenNotificationIds = new Set<string>();

  users: any[] = [];

  searchText = '';

  showModal = false;
  isSubmitting = false;

  notificationForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationApiService,
    public auth: AuthService,
    private notificationState: NotificationStateService,
  ) {}

  ngOnInit(): void {
    
    this.loadUsers();
    this.loadNotifications();
  

    this.notificationForm = this.fb.group({
      receiver_id: ['', Validators.required],
      title: ['', Validators.required],
      message: ['', Validators.required],
      notification_type: ['INFO', Validators.required],
      related_entity_type: [''],
      related_entity_id: ['']
    });

    this.loadUsers();
    this.loadNotifications();
  }

  loadUsers(): void {

    // Replace with Worker API later
    this.users = [
      { id: '1', name: 'Rahul' },
      { id: '2', name: 'Kiran' },
      { id: '3', name: 'Ajay' }
    ];

  }
 
  loadNotifications(): void {

    this.notificationService.getNotifications().subscribe({

      next: (data: any) => {
        this.notifications = data;
        this.filteredNotifications = [...this.notifications];
        this.notificationState.setUnreadCount(this.notifications.filter((item) => !item.is_read).length);
      },

      error: (err) => console.error(err)

    });

  }

  onSearch(event: Event): void {

    this.searchText = (event.target as HTMLInputElement).value;

    this.filterNotifications();

  }

  filterNotifications(): void {

    const text = this.searchText.toLowerCase();

    this.filteredNotifications = this.notifications.filter(n =>

      (n.title ?? '').toLowerCase().includes(text) ||

      (n.message ?? '').toLowerCase().includes(text)

    );

  }

  openModal(): void {
    this.showModal = true;
  }

  viewNotification(notification: any): void {
    const notificationId = this.getNotificationId(notification);

    if (!notificationId) {
      return;
    }

    this.seenNotificationIds.add(notificationId);

    if (!notification.is_read) {
      this.markRead(notification);
    }
  }

  closeModal(): void {
    if (this.isSubmitting) {
      return;
    }

    this.showModal = false;
    this.isSubmitting = false;

    this.notificationForm.reset({
      notification_type: 'INFO'
    });
  }

  submit(): void {
    if (this.notificationForm.invalid) {
      this.notificationForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;

    this.notificationService
      .createNotification(this.notificationForm.value)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.closeModal();
          this.loadNotifications();
          alert('Notification Sent Successfully');
        },
        error: (err) => {
          this.isSubmitting = false;
          console.error(err);
          alert('Failed to send notification');
        }
      });
  }

  markRead(notification: any): void {
    const notificationId = this.getNotificationId(notification);

    if (!notificationId) {
      console.error('Notification id is missing', notification);
      return;
    }

    this.notificationService.markAsRead(notificationId).subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error(err)
    });
  }

  markAllRead(): void {

    this.notificationService.markAllAsRead().subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error(err)
    });

  }

  deleteNotification(notification: any): void {
    if (!confirm('Delete this notification?')) {
      return;
    }

    const notificationId = this.getNotificationId(notification);

    if (!notificationId) {
      console.error('Notification id is missing', notification);
      return;
    }

    this.notificationService.deleteNotification(notificationId).subscribe({
      next: () => this.loadNotifications(),
      error: (err) => console.error(err)
    });
  }

  canCreateNotification(): boolean {
    return this.auth.hasRole(['Administrator', 'Project Manager']);
  }

  getNotificationId(notification: any): string | null {
    return notification?.id ?? notification?._id ?? null;
  }

}
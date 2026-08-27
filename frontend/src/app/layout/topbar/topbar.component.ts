import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificationItem } from '../../core/models/models';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { NotificationService } from '../../core/services/notification.service';

interface SearchResult {
  label: string;
  sub: string;
  icon: string;
  route: string[];
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent implements OnInit {
  @Input() title = 'Dashboard';
  @Input() sidebarCollapsed = false;
  @Output() menuClick = new EventEmitter<void>();

  query = signal('');
  showResults = signal(false);
  showNotificationsPanel = signal(false);
  showProfilePopup = signal(false);
  isUploadingAvatar = signal(false);
  uploadSuccessMessage = signal('');
  uploadErrorMessage = signal('');
  private profileCloseTimeout: any = null;

  results = computed<SearchResult[]>(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return [];

    const results: SearchResult[] = [];

    for (const p of this.data.projects) {
      if (p.name.toLowerCase().includes(term) || p.manager.toLowerCase().includes(term)) {
        results.push({ label: p.name, sub: `Project · ${p.manager}`, icon: 'fa-building', route: ['/projects', p.id] });
      }
    }
    for (const w of this.data.workers) {
      if (w.name.toLowerCase().includes(term) || w.role.toLowerCase().includes(term)) {
        results.push({ label: w.name, sub: `Worker · ${w.role}`, icon: 'fa-helmet-safety', route: ['/workers'] });
      }
    }
    for (const i of this.data.inventory) {
      if (i.itemName.toLowerCase().includes(term)) {
        results.push({ label: i.itemName, sub: `Inventory · ${i.category}`, icon: 'fa-boxes-stacked', route: ['/inventory'] });
      }
    }
    for (const r of this.data.resources) {
      if (r.name.toLowerCase().includes(term)) {
        results.push({ label: r.name, sub: `Resource · ${r.type}`, icon: 'fa-truck-monster', route: ['/resources'] });
      }
    }
    for (const o of this.data.purchaseOrders) {
      if (o.poNo.toLowerCase().includes(term) || o.supplier.toLowerCase().includes(term)) {
        results.push({ label: o.poNo, sub: `Purchase Order · ${o.supplier}`, icon: 'fa-cart-shopping', route: ['/procurement'] });
      }
    }

    return results.slice(0, 8);
  });

  constructor(
    public auth: AuthService,
    public data: MockDataService,
    public notificationService: NotificationService,
    private router: Router,
    private elementRef: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!this.elementRef.nativeElement.contains(target)) {
      this.showNotificationsPanel.set(false);
      this.showProfilePopup.set(false);
      this.showResults.set(false);
    }
  }

  onProfileMouseEnter(): void {
    if (this.profileCloseTimeout) {
      clearTimeout(this.profileCloseTimeout);
      this.profileCloseTimeout = null;
    }
    this.showProfilePopup.set(true);
  }

  onProfileMouseLeave(): void {
    this.profileCloseTimeout = setTimeout(() => {
      this.showProfilePopup.set(false);
    }, 250);
  }

  toggleProfilePopup(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showProfilePopup.update((v) => !v);
    if (this.showProfilePopup()) {
      this.showNotificationsPanel.set(false);
    }
  }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  getRoleBadgeColor(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
    if (r.includes('manager')) return 'linear-gradient(135deg, #10b981, #059669)';
    if (r.includes('engineer')) return 'linear-gradient(135deg, #f59e0b, #d97706)';
    if (r.includes('contractor')) return 'linear-gradient(135deg, #8b5cf6, #6d28d9)';
    if (r.includes('worker')) return 'linear-gradient(135deg, #ec4899, #be185d)';
    if (r.includes('client')) return 'linear-gradient(135deg, #06b6d4, #0891b2)';
    if (r.includes('vendor')) return 'linear-gradient(135deg, #f97316, #c2410c)';
    return 'linear-gradient(135deg, #64748b, #475569)';
  }

  getRoleClass(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'role-admin';
    if (r.includes('manager')) return 'role-manager';
    if (r.includes('engineer')) return 'role-engineer';
    if (r.includes('contractor')) return 'role-contractor';
    if (r.includes('worker')) return 'role-worker';
    if (r.includes('client')) return 'role-client';
    if (r.includes('vendor')) return 'role-vendor';
    return 'role-default';
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.uploadErrorMessage.set('Please select an image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.uploadErrorMessage.set('Image size should be less than 5MB.');
      return;
    }

    this.isUploadingAvatar.set(true);
    this.uploadErrorMessage.set('');
    this.uploadSuccessMessage.set('');

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      this.auth.updateProfile({ avatar_url: base64Data }).subscribe({
        next: () => {
          this.isUploadingAvatar.set(false);
          this.uploadSuccessMessage.set('Profile photo updated successfully!');
          setTimeout(() => this.uploadSuccessMessage.set(''), 4000);
        },
        error: (err) => {
          console.error('Failed to update avatar:', err);
          this.isUploadingAvatar.set(false);
          this.uploadErrorMessage.set('Failed to save profile picture. Please try again.');
          setTimeout(() => this.uploadErrorMessage.set(''), 4000);
        },
      });
    };
    reader.onerror = () => {
      this.isUploadingAvatar.set(false);
      this.uploadErrorMessage.set('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  }

  logout(): void {
    this.showProfilePopup.set(false);
    this.auth.logout();
  }

  ngOnInit(): void {
    if (this.auth.getToken()) {
      this.refreshNotifications();
      setInterval(() => {
        if (this.auth.getToken()) {
          this.refreshNotifications();
        }
      }, 30000);
    }
  }

  refreshNotifications(): void {
    if (!this.auth.getToken()) return;
    this.notificationService.getUnreadCount().subscribe({ error: () => {} });
    this.notificationService.getNotifications({ limit: 10 }).subscribe({ error: () => {} });
  }

  toggleNotifications(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showNotificationsPanel.update((v) => !v);
    if (this.showNotificationsPanel()) {
      this.refreshNotifications();
    }
  }

  markAsRead(item: NotificationItem, event: MouseEvent): void {
    event.stopPropagation();
    const id = item._id || item.id;
    if (id && !item.is_read) {
      this.notificationService.markAsRead(id).subscribe(() => {
        this.refreshNotifications();
      });
    }
  }

  markAllAsRead(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.markAllAsRead().subscribe(() => {
      this.refreshNotifications();
    });
  }

  viewAllNotifications(): void {
    this.showNotificationsPanel.set(false);
    this.router.navigate(['/notifications']);
  }

  onNotificationClick(item: NotificationItem): void {
    const id = item._id || item.id;
    if (id && !item.is_read) {
      this.notificationService.markAsRead(id).subscribe();
    }
    this.showNotificationsPanel.set(false);

    if (item.entity_type === 'project' && item.entity_id) {
      this.router.navigate(['/projects', item.entity_id]);
    } else if (item.entity_type === 'procurement') {
      this.router.navigate(['/procurement']);
    } else if (item.entity_type === 'attendance') {
      this.router.navigate(['/attendance']);
    } else if (item.entity_type === 'task' || item.category === 'task_assignment') {
      this.router.navigate(['/workers']);
    } else {
      this.router.navigate(['/notifications']);
    }
  }

  onFocus(): void {
    this.showResults.set(true);
  }

  onBlur(): void {
    setTimeout(() => this.showResults.set(false), 150);
  }

  goTo(result: SearchResult): void {
    this.router.navigate(result.route);
    this.query.set('');
    this.showResults.set(false);
  }

  openNotifications(): void {
    this.refreshNotifications();
    this.router.navigate(['/notifications']);
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    let str = String(dateStr).trim();
    if (!str.endsWith('Z') && !/[+-]\d{2}(:\d{2})?$/.test(str)) {
      str = str + 'Z';
    }
    const d = new Date(str);
    return Number.isNaN(d.getTime()) ? new Date(dateStr) : d;
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = this.parseDate(dateStr);
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


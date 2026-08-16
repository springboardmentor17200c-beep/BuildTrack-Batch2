import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
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
  @Output() menuClick = new EventEmitter<void>();

  query = signal('');
  showResults = signal(false);
  showNotificationsPanel = signal(false);

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
  ) {}

  ngOnInit(): void {
    if (this.auth.currentUser()) {
      this.refreshNotifications();
      setInterval(() => this.refreshNotifications(), 30000);
    }
  }

  refreshNotifications(): void {
    this.notificationService.getUnreadCount().subscribe();
    this.notificationService.getNotifications({ limit: 10 }).subscribe();
  }

  toggleNotifications(): void {
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
}


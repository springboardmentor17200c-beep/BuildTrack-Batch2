import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  'worker-dashboard': 'Worker Dashboard',
  'vendor-dashboard': 'Vendor Portal',
  'my-tasks': 'My Tasks',
  'my-attendance': 'My Attendance',
  'my-schedule': 'My Schedule',
  'my-projects': 'My Projects',
  projects: 'Projects',
  resources: 'Resources',
  inventory: 'Inventory',
  workers: 'Workers',
  attendance: 'Attendance',
  procurement: 'Procurement',
  reports: 'Reports & Analytics',
  analytics: 'Reports & Analytics',
  notifications: 'Notifications',
  settings: 'Settings',
};

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, TopbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  pageTitle = signal('Dashboard');
  sidebarMobileOpen = signal(false);
  sidebarCollapsed = signal(false); // Default OPEN (not shrunk)

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.pageTitle.set(this.resolveTitle(this.router.url));

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        map(() => this.resolveTitle(this.router.url)),
      )
      .subscribe((title) => {
        this.pageTitle.set(title);
        this.sidebarMobileOpen.set(false);
      });
  }

  private resolveTitle(url: string): string {
    const path = url.split('?')[0].replace(/^\/+/, '');
    if (path.includes('vendor-dashboard')) return 'Vendor Portal';
    if (path.includes('worker-dashboard')) return 'Worker Dashboard';
    if (path.includes('my-tasks')) return 'My Tasks';
    if (path.includes('my-attendance')) return 'My Attendance';
    if (path.includes('my-schedule')) return 'My Schedule';
    if (path.includes('my-projects')) return 'My Projects';
    const segment = path.split('/')[0] || 'dashboard';
    return TITLES[segment] ?? 'Dashboard';
  }

  toggleSidebar(): void {
    if (typeof window !== 'undefined' && window.innerWidth <= 900) {
      this.sidebarMobileOpen.update((v) => !v);
    } else {
      this.sidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileSidebar(): void {
    this.sidebarMobileOpen.set(false);
  }
}

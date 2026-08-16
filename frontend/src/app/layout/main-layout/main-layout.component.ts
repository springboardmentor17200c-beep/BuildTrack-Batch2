import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  resources: 'Resources',
  inventory: 'Inventory',
  workers: 'Workers',
  attendance: 'Attendance',
  procurement: 'Procurement',
  reports: 'Reports & Analytics',
  analytics: 'Reports & Analytics',
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
  sidebarOpen = signal(false);

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        map(() => {
          const path = this.router.url.split('?')[0];
          if (path.includes('vendor-dashboard')) return 'Vendor Portal';
          const segment = path.split('/')[1] || 'dashboard';
          return TITLES[segment] ?? 'BuildTrack';
        }),
      )
      .subscribe((title) => {
        this.pageTitle.set(title);
        this.sidebarOpen.set(false);
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}

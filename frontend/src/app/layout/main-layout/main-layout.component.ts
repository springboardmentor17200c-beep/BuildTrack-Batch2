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
        map(() => this.router.url.split('/')[1]?.split('?')[0] ?? 'dashboard'),
      )
      .subscribe((segment) => {
        this.pageTitle.set(TITLES[segment] ?? 'BuildTrack');
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

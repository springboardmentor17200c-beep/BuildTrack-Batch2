import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/models';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
}

const ALL_ROLES: UserRole[] = [
  'Administrator',
  'Project Manager',
  'Site Engineer',
  'Contractor',
  'Worker',
  'Client',
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() open = false;
  @Output() linkClick = new EventEmitter<void>();

  private allNavItems: NavItem[] = [
    { label: 'Dashboard', icon: 'fa-grid-2', route: '/dashboard', roles: ALL_ROLES },
    {
      label: 'Projects',
      icon: 'fa-building',
      route: '/projects',
      roles: ['Administrator', 'Project Manager', 'Site Engineer', 'Contractor', 'Client'],
    },
    {
      label: 'Milestones',
      icon: 'fa-list-check',
      route: '/projects/milestones',
      roles: ['Administrator', 'Project Manager', 'Site Engineer', 'Contractor', 'Client'],
    },
    {
      label: 'Resources',
      icon: 'fa-truck-monster',
      route: '/resources',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
    },
    {
      label: 'Equipment',
      icon: 'fa-truck',
      route: '/resources/equipment',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
    },
    {
      label: 'Inventory',
      icon: 'fa-boxes-stacked',
      route: '/inventory',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
    },
    {
      label: 'Stock Monitor',
      icon: 'fa-warehouse',
      route: '/inventory/stock-monitoring',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
    },
    {
      label: 'Workers',
      icon: 'fa-helmet-safety',
      route: '/workers',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
    },
    {
      label: 'Attendance',
      icon: 'fa-clock',
      route: '/attendance',
      roles: ['Administrator', 'Project Manager', 'Site Engineer', 'Worker'],
    },
    {
      label: 'Shifts',
      icon: 'fa-calendar-days',
      route: '/workers/shift-scheduling',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
    },
    {
      label: 'Procurement',
      icon: 'fa-cart-shopping',
      route: '/procurement',
      roles: ['Administrator', 'Project Manager'],
    },
    {
      label: 'Reports',
      icon: 'fa-chart-column',
      route: '/reports',
      roles: ['Administrator', 'Project Manager', 'Client'],
    },
    {
      label: 'Analytics',
      icon: 'fa-chart-pie',
      route: '/analytics/budget',
      roles: ['Administrator', 'Project Manager', 'Client'],
    },
  ];

  /** Only the nav items the current user's role is allowed to see. */
  navItems = computed(() => {
    const role = this.auth.currentUser()?.role;
    return this.allNavItems.filter((item) => !role || item.roles.includes(role));
  });

  /** Settings is Administrator-only. */
  canSeeSettings = computed(() => this.auth.hasRole(['Administrator']));

  constructor(public auth: AuthService) {}
}

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/models';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: UserRole[];
}

interface NavGroup extends NavItem {
  children?: NavItem[];
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

  private allNavItems: NavGroup[] = [
    { label: 'Dashboard', icon: 'fa-table-columns', route: '/dashboard', roles: ALL_ROLES },
    {
      label: 'Projects',
      icon: 'fa-building',
      route: '/projects',
      roles: ['Administrator', 'Project Manager', 'Site Engineer', 'Contractor', 'Client'],
      children: [
        {
          label: 'Milestones',
          icon: 'fa-list-check',
          route: '/projects/milestones',
          roles: ['Administrator', 'Project Manager', 'Site Engineer', 'Contractor', 'Client'],
        },
      ],
    },
    {
      label: 'Resources',
      icon: 'fa-truck-monster',
      route: '/resources',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
      children: [
        {
          label: 'Equipment',
          icon: 'fa-truck',
          route: '/resources/equipment',
          roles: ['Administrator', 'Project Manager', 'Site Engineer'],
        },
      ],
    },
    {
      label: 'Inventory',
      icon: 'fa-boxes-stacked',
      route: '/inventory',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
      children: [
        {
          label: 'Stock Monitor',
          icon: 'fa-warehouse',
          route: '/inventory/stock-monitoring',
          roles: ['Administrator', 'Project Manager', 'Site Engineer'],
        },
      ],
    },
    {
      label: 'Workers',
      icon: 'fa-helmet-safety',
      route: '/workers',
      roles: ['Administrator', 'Project Manager', 'Site Engineer'],
      children: [
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
      ],
    },
    {
      label: 'Procurement',
      icon: 'fa-cart-shopping',
      route: '/procurement',
      roles: ['Administrator', 'Project Manager'],
      children: [
        {
          label: 'Vendors',
          icon: 'fa-address-book',
          route: '/procurement/vendors',
          roles: ['Administrator', 'Project Manager'],
        },
        {
          label: 'Purchase Orders',
          icon: 'fa-file-invoice',
          route: '/procurement/purchase-orders',
          roles: ['Administrator', 'Project Manager'],
        },
        {
          label: 'Invoices',
          icon: 'fa-receipt',
          route: '/procurement/invoices',
          roles: ['Administrator', 'Project Manager'],
        },
        {
          label: 'Requests',
          icon: 'fa-file-circle-plus',
          route: '/procurement/request',
          roles: ['Administrator', 'Project Manager'],
        },
      ],
    },
    {
      label: 'Reports',
      icon: 'fa-chart-column',
      route: '/reports',
      roles: ['Administrator', 'Project Manager', 'Client'],
      children: [
        {
          label: 'Analytics',
          icon: 'fa-chart-pie',
          route: '/analytics/budget',
          roles: ['Administrator', 'Project Manager', 'Client'],
        },
      ],
    },
    {
      label: 'Notifications',
      icon: 'fa-bell',
      route: '/notifications',
      roles: ALL_ROLES,
    },
  ];

  
  navItems = computed(() => {
    const role = this.auth.currentUser()?.role;
    return this.allNavItems
      .filter((item) => !role || item.roles.includes(role))
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => !role || child.roles.includes(role)),
      }));
  });

  canSeeSettings = computed(() => this.auth.hasRole(['Administrator']));

  openGroups = signal<Set<string>>(new Set());

  constructor(public auth: AuthService) {}

  toggleGroup(label: string): void {
    this.openGroups.update((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  isGroupOpen(label: string): boolean {
    return this.openGroups().has(label);
  }
}

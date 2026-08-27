import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { Project, ProjectStatus } from '../../core/models/models';

interface StatCard {
  label: string;
  value: string;
  delta: string;
  trend: 'up' | 'down';
  icon: string;
  bg: string;
  color: string;
}

interface StatusSeries {
  label: string;
  color: string;
  className: string;
  points: string;
  count: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  constructor(
    public data: MockDataService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const role = this.auth.currentUser()?.role;

    if (role === 'Vendor') {
      this.router.navigate(['/procurement/vendor-dashboard']);
      return;
    }

    if (role === 'Worker') {
      this.router.navigate(['/worker-dashboard']);
      return;
    }

    this.data.refresh();
  }

  // ─── Visible Projects (Filtered for Client role) ───────────────────────────

  get visibleProjects(): Project[] {
    const user = this.auth.currentUser();
    if (user?.role === 'Client') {
      const email = (user.email || '').trim().toLowerCase();
      return this.data.projects.filter(
        (p) =>
          (p.clientEmail && p.clientEmail.trim().toLowerCase() === email) ||
          (p.client && p.client.trim().toLowerCase() === email),
      );
    }
    return this.data.projects;
  }

  // ─── Stat Cards ─────────────────────────────────────────────────────────────

  get stats(): StatCard[] {
    const projects = this.visibleProjects;
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
    const activeCount = this.countStatus('In Progress');
    const isClient = this.auth.currentUser()?.role === 'Client';

    if (isClient) {
      const avgProgress = projects.length > 0
        ? Math.round(projects.reduce((acc, p) => acc + (p.progress ?? 0), 0) / projects.length)
        : 0;

      return [
        {
          label: 'My Projects',
          value: String(projects.length),
          delta: `${projects.length} Assigned`,
          trend: 'up',
          icon: 'fa-building',
          bg: 'var(--blue-light)',
          color: 'var(--blue)',
        },
        {
          label: 'Active Projects',
          value: String(activeCount),
          delta: `${activeCount} in progress`,
          trend: 'up',
          icon: 'fa-diagram-project',
          bg: 'var(--green-bg)',
          color: 'var(--green)',
        },
        {
          label: 'Average Progress',
          value: `${avgProgress}%`,
          delta: 'Milestone completion',
          trend: 'up',
          icon: 'fa-list-check',
          bg: 'var(--purple-bg)',
          color: 'var(--purple)',
        },
        {
          label: 'Total Budget',
          value: totalBudget ? `Rs ${totalBudget.toLocaleString('en-IN')}` : 'Rs 0',
          delta: 'Allocated Project Budget',
          trend: 'up',
          icon: 'fa-indian-rupee-sign',
          bg: 'var(--amber-bg)',
          color: 'var(--amber)',
        },
      ];
    }

    return [
      {
        label: 'Total Projects',
        value: String(projects.length),
        delta: this.monthComparisonText(projects.length, Math.max(0, projects.length - 1)),
        trend: 'up',
        icon: 'fa-building',
        bg: 'var(--blue-light)',
        color: 'var(--blue)',
      },
      {
        label: 'Active Projects',
        value: String(activeCount),
        delta: this.monthComparisonText(activeCount, Math.max(0, activeCount - 1)),
        trend: 'up',
        icon: 'fa-diagram-project',
        bg: 'var(--green-bg)',
        color: 'var(--green)',
      },
      {
        label: 'Total Workers',
        value: String(this.data.workers.length),
        delta: `${this.totalMonthlyAttendancePct}% monthly attendance`,
        trend: 'up',
        icon: 'fa-helmet-safety',
        bg: 'var(--purple-bg)',
        color: 'var(--purple)',
      },
      {
        label: 'Total Budget',
        value: totalBudget ? `Rs ${totalBudget.toLocaleString('en-IN')}` : 'Rs 0',
        delta: totalBudget ? this.monthComparisonText(totalBudget, Math.round(totalBudget * 1.05)) : '0% vs last month',
        trend: totalBudget > 0 ? 'down' : 'up',
        icon: 'fa-indian-rupee-sign',
        bg: 'var(--amber-bg)',
        color: 'var(--amber)',
      },
    ];
  }

  get upcomingMilestones(): Array<{ project: string; title: string; date: string }> {
    const visibleNames = new Set(this.visibleProjects.map((p) => p.name));
    return this.data.upcomingMilestones.filter((m) => visibleNames.has(m.project));
  }

  get totalMonthlyAttendancePct(): number {
    const workers = this.data.workers;
    if (!workers || workers.length === 0) return 0;
    const sum = workers.reduce((acc, w) => acc + (w.attendancePct ?? 0), 0);
    return Math.round(sum / workers.length);
  }

  private monthComparisonText(current: number, previous: number): string {
    if (!current && !previous) return '0% vs last month';
    if (!previous) return '100% vs last month';
    const change = Math.round(((current - previous) / previous) * 100);
    return `${Math.abs(change)}% vs last month`;
  }

  // ─── Donut chart ─────────────────────────────────────────────────────────────

  get statusLegend() {
    const total = this.visibleProjects.length;
    return [
      { label: 'Completed',   color: '#16a34a', count: this.countStatus('Completed') },
      { label: 'In Progress', color: '#2563eb', count: this.countStatus('In Progress') },
      { label: 'On Hold',     color: '#d97706', count: this.countStatus('On Hold') },
      { label: 'Not Started', color: '#94a3b8', count: this.countStatus('Not Started') },
    ].map((item) => ({
      ...item,
      percent: total ? Math.round((item.count / total) * 100) : 0,
    }));
  }

  get donutStyle(): string {
    if (!this.visibleProjects.length) {
      return 'conic-gradient(#e2e8f0 0 100%)';
    }
    let start = 0;
    const slices = this.statusLegend.map((item) => {
      const end = start + item.percent;
      const slice = `${item.color} ${start}% ${end}%`;
      start = end;
      return slice;
    });
    return `conic-gradient(${slices.join(', ') || '#e2e8f0 0 100%'})`;
  }

  // ─── Line chart (dynamic monthly range, anchored to TODAY) ───────────────────

  private get rollingMonths(): Date[] {
    const now = new Date();
    const months: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    return months;
  }

  get statusTrend(): {
    labels: string[];
    series: StatusSeries[];
    max: number;
    currentMonth: string;
  } {
    const months = this.rollingMonths;
    const statuses: ProjectStatus[] = ['Completed', 'In Progress', 'On Hold', 'Not Started'];

    const countsByStatus = statuses.map((status) =>
      months.map((month) => {
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
        return this.visibleProjects.filter((p) => {
          const start = this.parseProjectDate(p.startDate);
          return start <= monthEnd && p.status === status;
        }).length;
      }),
    );

    const max = Math.max(...countsByStatus.flat(), 1);

    const colors: Record<ProjectStatus, string> = {
      'Completed':   '#16a34a',
      'In Progress': '#2563eb',
      'On Hold':     '#d97706',
      'Not Started': '#94a3b8',
    };
    const classes: Record<ProjectStatus, string> = {
      'Completed':   'completed',
      'In Progress': 'progress',
      'On Hold':     'hold',
      'Not Started': 'not-started',
    };

    return {
      labels: months.map((d) =>
        d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      ),
      currentMonth: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      series: statuses.map((status, index): StatusSeries => ({
        label: status,
        color: colors[status],
        className: classes[status],
        points: this.toPolyline(countsByStatus[index], max),
        count: this.countStatus(status),
      })),
      max,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private countStatus(status: ProjectStatus): number {
    return this.visibleProjects.filter((p) => p.status === status).length;
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'In Progress': return 'badge-blue';
      case 'On Hold':     return 'badge-amber';
      case 'Completed':   return 'badge-green';
      default:            return 'badge-gray';
    }
  }

  private parseProjectDate(value?: string): Date {
    if (!value) return new Date();

    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value);
    }

    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        const [a, b, c] = parts;
        if (c.length === 4) {
          const tryMDY = new Date(`${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`);
          if (!Number.isNaN(tryMDY.getTime())) return tryMDY;
        }
        const reversed = new Date(parts.reverse().join('-'));
        if (!Number.isNaN(reversed.getTime())) return reversed;
      }
    }

    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts.length === 3) {
        const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }

    const direct = new Date(value);
    return Number.isNaN(direct.getTime()) ? new Date() : direct;
  }

  private toPolyline(values: number[], max: number): string {
    const len = values.length;
    if (!len) return '';
    const step = len > 1 ? 450 / (len - 1) : 0;
    return values
      .map((v, i) => {
        const x = 20 + i * step;
        const y = 180 - (v / max) * 140;
        return `${x.toFixed(1)},${Math.max(30, Math.min(180, y)).toFixed(1)}`;
      })
      .join(' ');
  }
}
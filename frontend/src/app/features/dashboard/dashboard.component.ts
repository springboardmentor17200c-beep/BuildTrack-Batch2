import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { ProjectStatus } from '../../core/models/models';

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
  label: ProjectStatus;
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
export class DashboardComponent {
  constructor(public data: MockDataService) {}

  // ─── Stat cards ─────────────────────────────────────────────────────────────

  get stats(): StatCard[] {
    const totalBudget = this.data.projects.reduce((sum, p) => sum + (p.budget ?? 0), 0);
    return [
      {
        label: 'Total Projects',
        value: String(this.data.projects.length),
        delta: 'From backend',
        trend: 'up',
        icon: 'fa-building',
        bg: 'var(--blue-light)',
        color: 'var(--blue)',
      },
      {
        label: 'Active Projects',
        value: String(this.countStatus('In Progress')),
        delta: 'From backend',
        trend: 'up',
        icon: 'fa-diagram-project',
        bg: 'var(--green-bg)',
        color: 'var(--green)',
      },
      {
        label: 'Total Workers',
        value: String(this.data.workers.length),
        delta: 'From backend',
        trend: 'up',
        icon: 'fa-helmet-safety',
        bg: 'var(--purple-bg)',
        color: 'var(--purple)',
      },
      {
        label: 'Total Budget',
        value: totalBudget ? `Rs ${totalBudget.toLocaleString('en-IN')}` : 'Rs 0',
        delta: 'From backend',
        trend: totalBudget > 0 ? 'up' : 'down',
        icon: 'fa-indian-rupee-sign',
        bg: 'var(--amber-bg)',
        color: 'var(--amber)',
      },
    ];
  }

  // ─── Donut chart ─────────────────────────────────────────────────────────────

  get statusLegend() {
    const total = this.data.projects.length;
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
    if (!this.data.projects.length) {
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

  /**
   * Returns 6 monthly bucket dates always ending at the CURRENT month.
   * e.g. if today is July 2026  →  Feb 2026, Mar, Apr, May, Jun, Jul 2026
   * This is NEVER hardcoded — it moves forward as time passes.
   */
  private get rollingMonths(): Date[] {
    const now = new Date();
    const months: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    return months;
  }

  /**
   * For each monthly bucket, count how many projects are in each status
   * at the END of that month (i.e. started on or before that month-end).
   * This gives a running-total trend that stays meaningful at any project count.
   */
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
        return this.data.projects.filter((p) => {
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
    return this.data.projects.filter((p) => p.status === status).length;
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'In Progress': return 'badge-blue';
      case 'On Hold':     return 'badge-amber';
      case 'Completed':   return 'badge-green';
      default:            return 'badge-gray';
    }
  }

  /**
   * Converts project's display-format startDate back to a Date object.
   * Handles ISO strings ("2026-05-06"), locale strings with "/" and ".",
   * and common display formats ("6 May 2026").
   */
  private parseProjectDate(value?: string): Date {
    if (!value) return new Date();

    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      return new Date(value);
    }

    // Locale slash format — could be M/D/Y or D/M/Y.
    // We try YYYY by reversing, then fall back.
    if (value.includes('/')) {
      const parts = value.split('/');
      if (parts.length === 3) {
        // Try D/M/Y  →  YYYY-MM-DD
        const [a, b, c] = parts;
        // If last part looks like a 4-digit year
        if (c.length === 4) {
          // Assume M/D/Y (US locale) unless day > 12 (then it must be D/M)
          const tryMDY = new Date(`${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`);
          if (!Number.isNaN(tryMDY.getTime())) return tryMDY;
        }
        // Try reversed (D-M-Y → Y-M-D)
        const reversed = new Date(parts.reverse().join('-'));
        if (!Number.isNaN(reversed.getTime())) return reversed;
      }
    }

    // Dot-separated (D.M.YYYY common in some locales)
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts.length === 3) {
        const d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }

    // Direct parse as fallback
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

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { ProjectsService } from '../../core/services/projects.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit {
  public data = inject(MockDataService);
  private http = inject(HttpClient);
  private projectsService = inject(ProjectsService);

  // Today formatted as YYYY-MM-DD
  readonly todayStr = new Date().toISOString().split('T')[0];

  // Selected date signal (defaults to today)
  selectedDate = signal<string>(this.todayStr);

  // Overall mode signal
  isOverall = signal<boolean>(false);

  dbProjects = signal<any[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadLiveProjects();
  }

  loadLiveProjects(): void {
    this.projectsService.getProjects().subscribe({
      next: (res) => {
        const list = Array.isArray(res) ? res : res?.items || [];
        if (list.length > 0) {
          this.dbProjects.set(list);
        }
      },
      error: () => {
        // Fallback to mock data if backend not available
      },
    });
  }

  setOverallMode(): void {
    this.isOverall.set(true);
    this.selectedDate.set(this.todayStr);
  }

  // Set predefined date
  setDateOffset(daysAgo: number): void {
    this.isOverall.set(false);
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    this.selectedDate.set(d.toISOString().split('T')[0]);
  }

  onDateChange(newVal: string): void {
    this.isOverall.set(false);
    if (!newVal) {
      this.selectedDate.set(this.todayStr);
      return;
    }
    // Prevent selecting tomorrow or future date
    if (newVal > this.todayStr) {
      this.selectedDate.set(this.todayStr);
      return;
    }
    this.selectedDate.set(newVal);
  }

  get isToday(): boolean {
    return !this.isOverall() && this.selectedDate() === this.todayStr;
  }

  get daysInPast(): number {
    if (this.isOverall()) return 0;
    const today = new Date(this.todayStr).getTime();
    const sel = new Date(this.selectedDate()).getTime();
    return Math.max(0, Math.floor((today - sel) / (1000 * 60 * 60 * 24)));
  }

  get formattedDateDisplay(): string {
    if (this.isOverall()) return 'Overall (All Time)';
    const d = new Date(this.selectedDate() + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  normalizeStatus(rawStatus?: string): string {
    const st = String(rawStatus || '').trim().toLowerCase();
    if (st === 'completed') return 'Completed';
    if (st === 'active' || st === 'in_progress' || st === 'in progress') return 'In Progress';
    if (st === 'on_hold' || st === 'on hold') return 'On Hold';
    if (st === 'planning' || st === 'not started' || st === 'planned') return 'Planned';
    return 'In Progress';
  }

  getStatusClass(status: string): string {
    const st = this.normalizeStatus(status);
    if (st === 'Completed') return 'badge-green';
    if (st === 'In Progress') return 'badge-blue';
    if (st === 'On Hold') return 'badge-amber';
    return 'badge-gray';
  }

  // Active projects list combining DB data with fallback
  get baseProjects() {
    const list = this.dbProjects().length > 0 ? this.dbProjects() : this.data.projects;
    if (!list || list.length === 0) {
      return [
        { id: '1', name: 'Apex Commercial Complex', status: 'In Progress', progress: 72, budget: 12500000, startDate: '2026-01-10', manager: 'Ranish Vishwakarma' },
        { id: '2', name: 'Metro Line Station 4', status: 'In Progress', progress: 54, budget: 35000000, startDate: '2026-01-15', manager: 'Project Manager' },
        { id: '3', name: 'Green Valley Villas', status: 'Completed', progress: 100, budget: 8500000, startDate: '2025-11-01', manager: 'Ranish Vishwakarma' },
        { id: '4', name: 'Sunrise Tower Phase 2', status: 'In Progress', progress: 38, budget: 18000000, startDate: '2026-02-01', manager: 'Site Engineer' },
      ];
    }
    return list.map((p, idx) => {
      let rawProgress = p.progress ?? p.completion_percentage ?? p.progress_pct ?? 0;
      const budget = p.budget ?? p.total_budget ?? 0;
      const startDate = String(p.startDate || p.start_date || '2026-01-01').split('T')[0];
      const normStatus = this.normalizeStatus(p.status);

      if (normStatus === 'Completed') {
        rawProgress = 100;
      }

      return {
        id: String(p.id || p._id || Math.random()),
        name: p.name || p.title || 'Construction Project',
        status: normStatus,
        progress: typeof rawProgress === 'number' ? rawProgress : Number(rawProgress) || 0,
        budget: Number(budget) || 0,
        startDate: startDate,
        manager: p.manager || p.project_manager_name || 'Project Manager',
      };
    });
  }

  // Historical Snapshot Projects calculated for the selected date
  historicalProjects = computed(() => {
    const selDateStr = this.selectedDate();
    const daysAgo = this.daysInPast;
    const isOverall = this.isOverall();
    const isCurrent = this.isToday;

    return this.baseProjects.map((project) => {
      if (isOverall) {
        return {
          ...project,
          historicalProgress: project.progress,
          historicalStatus: project.status,
          isActiveAtDate: true,
        };
      }

      const projStart = (project.startDate || '2026-01-01').slice(0, 10);

      // If project's start date is strictly after the selected date
      if (projStart > selDateStr) {
        return {
          ...project,
          historicalProgress: 0,
          historicalStatus: 'Planned',
          isActiveAtDate: false,
        };
      }

      if (isCurrent) {
        return {
          ...project,
          historicalProgress: project.progress,
          historicalStatus: project.status,
          isActiveAtDate: true,
        };
      }

      // Past date: compute historical progress based on days elapsed
      const progressReduction = Math.round(daysAgo * 1.5);
      const histProgress = Math.max(0, Math.min(project.progress, project.progress - progressReduction));

      let histStatus = project.status;
      if (histProgress === 0) {
        histStatus = 'Planned';
      } else if (histProgress >= 100) {
        histStatus = 'Completed';
      } else if (project.status === 'Completed') {
        histStatus = 'In Progress'; // Was still in progress on that past date
      }

      return {
        ...project,
        historicalProgress: histProgress,
        historicalStatus: histStatus,
        isActiveAtDate: true,
      };
    });
  });

  get summary() {
    const list = this.historicalProjects();
    const total = list.length;
    const completed = list.filter((p) => p.historicalStatus === 'Completed').length;
    const inProgress = list.filter((p) => p.historicalStatus === 'In Progress').length;
    const onHoldOrPlanned = list.filter(
      (p) =>
        p.historicalStatus === 'On Hold' ||
        p.historicalStatus === 'Upcoming / Planned' ||
        p.historicalStatus === 'Not Started',
    ).length;

    return [
      { label: 'Total Projects (Till Date)', value: String(total) },
      { label: 'Completed (Till Date)', value: String(completed) },
      { label: 'In Progress (Till Date)', value: String(inProgress) },
      { label: 'On Hold / Planned', value: String(onHoldOrPlanned) },
    ];
  }

  get averageProgress(): number {
    const list = this.historicalProjects();
    if (!list.length) return 0;
    const sum = list.reduce((acc, p) => acc + p.historicalProgress, 0);
    return Math.round(sum / list.length);
  }

  get totalBudget(): number {
    return this.historicalProjects().reduce((sum, p) => sum + (p.budget ?? 0), 0);
  }

  get totalExpense(): number {
    const currentBase = this.data.purchaseOrders.reduce((sum, order) => sum + order.amount, 0);
    if (this.isToday) return currentBase;
    // Scale expense back for previous dates
    const factor = Math.max(0.15, 1 - this.daysInPast * 0.015);
    return Math.round(currentBase * factor);
  }

  get budgetBarWidth(): number {
    const max = Math.max(this.totalBudget, this.totalExpense, 1);
    return Math.round((this.totalBudget / max) * 100);
  }

  get expenseBarWidth(): number {
    const max = Math.max(this.totalBudget, this.totalExpense, 1);
    return Math.round((this.totalExpense / max) * 100);
  }

  get budgetWeeks() {
    const daysAgo = this.daysInPast;
    // Base weekly factors adjusted for historical period
    const shift = (daysAgo % 7) * 0.02;
    const budgetFactors = [0.7 - shift, 0.82 - shift, 0.76 - shift, 0.9 - shift, 0.78 - shift];
    const expenseFactors = [0.52 - shift, 0.61 - shift, 0.66 - shift, 0.57 - shift, 0.64 - shift];

    const budgetBase = this.totalBudget || 1;
    const expenseBase = this.totalExpense || 0;
    const max = Math.max(
      ...budgetFactors.map((f) => budgetBase * Math.max(0.2, f)),
      ...expenseFactors.map((f) => expenseBase * Math.max(0.15, f)),
      1,
    );

    return ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'].map((label, index) => ({
      label,
      budgetHeight: Math.round(((budgetBase * Math.max(0.2, budgetFactors[index])) / max) * 100),
      expenseHeight: Math.round(((expenseBase * Math.max(0.15, expenseFactors[index])) / max) * 100),
    }));
  }

  get progressRingStyle(): string {
    return `conic-gradient(var(--blue) 0 ${this.averageProgress}%, #edf2f8 ${this.averageProgress}% 100%)`;
  }

  downloadReport(): void {
    const rows = [
      ['BuildTrack Report & Analytics', `Till ${this.formattedDateDisplay} (${this.isToday ? 'Current Updated' : 'Previous Snapshot'})`],
      [],
      ['Metric', 'Value (Till ' + this.formattedDateDisplay + ')'],
      ...this.summary.map((item) => [item.label, item.value]),
      ['Average Progress (Till Date)', `${this.averageProgress}%`],
      ['Total Budget (Till Date)', `Rs ${this.totalBudget}`],
      ['Total Expense (Till Date)', `Rs ${this.totalExpense}`],
      [],
      ['Projects Breakdown (Till ' + this.formattedDateDisplay + ')'],
      ['Project Name', 'Status as of Date', 'Progress at Date', 'Budget', 'Start Date'],
      ...this.historicalProjects().map((p) => [
        p.name,
        p.historicalStatus,
        `${p.historicalProgress}%`,
        String(p.budget ?? 0),
        p.startDate,
      ]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `buildtrack-report-till-${this.selectedDate()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

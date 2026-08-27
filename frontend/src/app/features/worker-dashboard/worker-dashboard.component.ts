import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { WorkforceService } from '../../core/services/workforce.service';
import { TasksService } from '../../core/services/tasks.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-worker-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './worker-dashboard.component.html',
  styles: [`
    .page { padding: 24px 28px 40px; }

    .stat-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }

    .stat-card {
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 18px;
      background: #fff;
    }

    .stat-card p { margin: 0; color: var(--muted); font-size: 12.5px; font-weight: 700; }
    .stat-card strong { display: block; margin-top: 6px; font-size: 26px; }
    .stat-card .subtext { display: block; margin-top: 6px; font-size: 11.5px; color: var(--muted); }
    .stat-card.present strong { color: #16a34a; }
    .stat-card.absent strong { color: #dc2626; }

    .panel { border: 1px solid var(--border); border-radius: 14px; background: #fff; margin-bottom: 18px; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px 8px; }
    .panel-header h3 { margin: 0; font-size: 15px; }
    .panel-header a { font-size: 13px; color: var(--blue); text-decoration: none; }

    .task-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 18px;
      border-top: 1px solid var(--border);
      font-size: 13.5px;
    }
    .task-row:first-of-type { border-top: none; }
    .task-row .due { color: var(--muted); font-size: 12px; }
    .task-row .due.today { color: #dc2626; font-weight: 700; }

    .project-card { padding: 16px 18px 20px; }
    .project-card h4 { margin: 0 0 4px; font-size: 15px; }
    .progress-bar { height: 8px; border-radius: 999px; background: #eef1f6; overflow: hidden; margin-top: 10px; }
    .progress-bar span { display: block; height: 100%; background: var(--blue); }

    .notif-row {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      padding: 10px 18px;
      border-top: 1px solid var(--border);
      font-size: 13px;
    }
    .notif-row:first-of-type { border-top: none; }
    .notif-row i { color: var(--blue); margin-top: 2px; }

    .empty { padding: 18px; color: var(--muted); font-size: 13.5px; }
    .loading { padding: 30px; text-align: center; color: var(--muted); }
  `],
})
export class WorkerDashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly workforceService = inject(WorkforceService);
  private readonly tasksService = inject(TasksService);
  private readonly mockData = inject(MockDataService);
  readonly notificationService = inject(NotificationService);

  loading = signal(true);
  workerId = signal<string | null>(null);

  todaysAttendanceStatus = signal<'present' | 'absent' | 'leave' | 'not_marked'>('not_marked');
  monthlyAttendancePercentage = signal<number | null>(null);
  monthlyAttendanceDetails = signal<{ present: number; total: number }>({ present: 0, total: 0 });
  currentMonthName = computed(() => {
    return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  });

  rawTasks = signal<any[]>([]);

  currentProjectName = signal<string>('');
  currentProjectProgress = signal<number>(0);

  assignedCount = computed(() => this.rawTasks().filter((t) => t.status !== 'completed').length);
  completedCount = computed(() => this.rawTasks().filter((t) => t.status === 'completed').length);

  todaysTasks = computed(() => {
    const today = this.today();
    return this.rawTasks()
      .filter((t) => t.status !== 'completed')
      .map((t) => ({
        title: t.title,
        dueLabel: this.dueLabel(t.due_date, today),
        isToday: t.due_date ? String(t.due_date).slice(0, 10) === today : false,
      }))
      .slice(0, 5);
  });

  ngOnInit(): void {
    const workerId = this.auth.currentUser()?.workerId;
    this.workerId.set(workerId ?? null);

    if (!workerId) {
      this.loading.set(false);
      return;
    }

    this.mockData.loadProjects();
    this.notificationService.getNotifications({ limit: 5 }).subscribe();

    this.loadTodaysAttendance(workerId);
    this.loadTasks(workerId);
    this.loadCurrentProject(workerId);
  }

  private loadTodaysAttendance(workerId: string): void {
    const today = this.today();
    const currentMonthPrefix = today.slice(0, 7); // 'YYYY-MM'
    this.workforceService.getAttendance({ workerId }).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        const todaysRecord = list.find((r: any) => String(r.date || '').slice(0, 10) === today);
        this.todaysAttendanceStatus.set(todaysRecord?.status || 'not_marked');

        // Current month attendance calculation with daily deduplication
        const monthRecords = list.filter((r: any) => String(r.date || '').slice(0, 7) === currentMonthPrefix);
        const dayMap = new Map<string, string>();
        for (const r of monthRecords) {
          const d = String(r.date || '').slice(0, 10);
          if (d && r.status) {
            dayMap.set(d, String(r.status).toLowerCase());
          }
        }

        let present = 0;
        for (const st of dayMap.values()) {
          if (st === 'present') present++;
        }
        const total = dayMap.size;
        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
        this.monthlyAttendancePercentage.set(pct);
        this.monthlyAttendanceDetails.set({ present, total });
      },
      error: (error) => console.error('Failed to load attendance', error),
    });
  }

  private loadTasks(workerId: string): void {
    this.tasksService.getTasksForWorker(workerId).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.rawTasks.set(list);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load tasks', error);
        this.loading.set(false);
      },
    });
  }

  private loadCurrentProject(workerId: string): void {
    this.workforceService.getAllocations(undefined, workerId).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        const active = list.find((a: any) => (a.status || '').toUpperCase() === 'ACTIVE');
        if (!active) return;

        const project = this.mockData.projects.find((p) => p.id === active.project_id);
        if (!project) return;

        this.currentProjectName.set(project.name);

        const milestones = this.mockData.getMilestonesForProject(project.id);
        if (milestones.length) {
          const avg = Math.round(
            milestones.reduce((sum, m) => sum + m.progress, 0) / milestones.length,
          );
          this.currentProjectProgress.set(avg);
        } else {
          this.currentProjectProgress.set(project.progress ?? 0);
        }
      },
      error: (error) => console.error('Failed to load allocation', error),
    });
  }

  private dueLabel(dueDate: string | undefined, today: string): string {
    if (!dueDate) return 'No due date';
    const due = String(dueDate).slice(0, 10);
    if (due === today) return 'Due: Today';
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    if (due === tomorrow) return 'Due: Tomorrow';
    return `Due: ${due}`;
  }

  attendanceLabel(): string {
    switch (this.todaysAttendanceStatus()) {
      case 'present': return 'Present';
      case 'absent': return 'Absent';
      case 'leave': return 'On Leave';
      default: return 'Not marked yet';
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
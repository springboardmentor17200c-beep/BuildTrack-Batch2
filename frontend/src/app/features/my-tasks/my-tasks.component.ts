import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { TasksService } from '../../core/services/tasks.service';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-tasks.component.html',
  styles: [`
    .page { padding: 24px 28px 40px; }
    .panel { border: 1px solid var(--border); border-radius: 14px; background: #fff; }
    .task-list-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-top: 1px solid var(--border);
      cursor: pointer;
    }
    .task-list-row:first-of-type { border-top: none; }
    .task-list-row:hover { background: #f8fafc; }
    .task-list-row .project { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
    .empty { padding: 24px; text-align: center; color: var(--muted); }
    .loading { padding: 30px; text-align: center; color: var(--muted); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
    .modal-panel { background: #fff; border-radius: 14px; width: 420px; max-width: 92vw; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px 10px; }
    .modal-header h3 { margin: 0; font-size: 16px; }
    .modal-close { border: none; background: none; cursor: pointer; font-size: 16px; color: var(--muted); }
    .modal-body { padding: 4px 20px 20px; }
    .modal-body dt { font-size: 12px; color: var(--muted); font-weight: 700; margin-top: 14px; }
    .modal-body dd { margin: 4px 0 0; font-size: 14px; }
  `],
})
export class MyTasksComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly tasksService = inject(TasksService);
  private readonly mockData = inject(MockDataService);

  loading = signal(true);
  tasks = signal<any[]>([]);
  selectedTask = signal<any | null>(null);

  ngOnInit(): void {
    this.mockData.loadProjects();

    const workerId = this.auth.currentUser()?.workerId;
    if (!workerId) {
      this.loading.set(false);
      return;
    }

    this.tasksService.getTasksForWorker(workerId).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];
        this.tasks.set(
          list.map((t: any) => ({
            id: t._id || t.id,
            title: t.title,
            description: t.description || '',
            projectId: t.project_id,
            projectName: this.mockData.projects.find((p) => p.id === t.project_id)?.name || 'Unknown project',
            status: t.status === 'completed' ? 'Completed' : 'Pending',
            dueDate: t.due_date ? String(t.due_date).slice(0, 10) : '',
          })),
        );
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Failed to load my tasks', error);
        this.loading.set(false);
      },
    });
  }

  openDetails(task: any): void {
    this.selectedTask.set(task);
  }

  closeDetails(): void {
    this.selectedTask.set(null);
  }

  statusClass(status: string): string {
    return status === 'Completed' ? 'badge-green' : 'badge-amber';
  }
}
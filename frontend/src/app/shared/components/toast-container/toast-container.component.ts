import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite">
      @for (toast of notifications.toasts(); track toast.id) {
        <div class="toast" [class]="'toast--' + toast.type" (click)="notifications.dismiss(toast.id)">
          <i class="fa-solid" [ngClass]="iconFor(toast.type)"></i>
          <span>{{ toast.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: min(420px, calc(100vw - 2rem));
    }
    .toast {
      display: flex;
      align-items: flex-start;
      gap: 0.65rem;
      padding: 0.85rem 1rem;
      border-radius: 10px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
      background: #fff;
      border: 1px solid #e2e8f0;
      cursor: pointer;
      font-size: 0.9rem;
      animation: slideIn 0.25s ease;
    }
    .toast--success { border-left: 4px solid #16a34a; }
    .toast--error { border-left: 4px solid #dc2626; }
    .toast--info { border-left: 4px solid #2563eb; }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(12px); }
      to { opacity: 1; transform: translateX(0); }
    }
  `],
})
export class ToastContainerComponent {
  constructor(public notifications: NotificationService) {}

  iconFor(type: string): string {
    if (type === 'success') return 'fa-circle-check';
    if (type === 'error') return 'fa-circle-exclamation';
    return 'fa-circle-info';
  }
}

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirm.state(); as dialog) {
      <div class="confirm-backdrop" (click)="confirm.answer(false)">
        <div class="confirm-card" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <h3>{{ dialog.title }}</h3>
          <p>{{ dialog.message }}</p>
          <div class="confirm-actions">
            <button type="button" class="btn btn-outline" (click)="confirm.answer(false)">{{ dialog.cancelLabel }}</button>
            <button type="button" class="btn btn-danger" (click)="confirm.answer(true)">{{ dialog.confirmLabel }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
    }
    .confirm-card {
      background: #fff;
      border-radius: 12px;
      padding: 1.5rem;
      max-width: 420px;
      width: 100%;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.2);
    }
    .confirm-card h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
    .confirm-card p { margin: 0 0 1.25rem; color: var(--muted, #64748b); line-height: 1.5; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
    .btn-danger {
      background: #dc2626;
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      cursor: pointer;
    }
  `],
})
export class ConfirmDialogComponent {
  constructor(public confirm: ConfirmService) {}
}

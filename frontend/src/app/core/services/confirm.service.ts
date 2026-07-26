import { Injectable, signal } from '@angular/core';

export interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  confirm(message: string, title = 'Confirm action', confirmLabel = 'Delete', cancelLabel = 'Cancel'): Promise<boolean> {
    return new Promise((resolve) => {
      this.state.set({ title, message, confirmLabel, cancelLabel, resolve });
    });
  }

  answer(confirmed: boolean): void {
    const current = this.state();
    if (current) {
      current.resolve(confirmed);
      this.state.set(null);
    }
  }
}

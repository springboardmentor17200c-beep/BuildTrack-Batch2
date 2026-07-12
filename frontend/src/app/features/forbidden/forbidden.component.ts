import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="forbidden">
      <div class="forbidden__icon"><i class="fa-solid fa-lock"></i></div>
      <h1>Access restricted</h1>
      <p>
        Your role ({{ auth.currentUser()?.role || 'Unknown' }}) doesn't have permission to view
        this page. If you think this is a mistake, contact your project administrator.
      </p>
      <a routerLink="/dashboard" class="btn btn-primary">Back to Dashboard</a>
    </div>
  `,
  styles: [
    `
      .forbidden {
        min-height: calc(100vh - 70px);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 40px;
      }
      .forbidden__icon {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: #fee2e2;
        color: #dc2626;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
        margin-bottom: 20px;
      }
      h1 {
        font-size: 22px;
        font-weight: 800;
        margin: 0 0 10px;
      }
      p {
        max-width: 420px;
        color: var(--muted);
        font-size: 14px;
        line-height: 1.6;
        margin: 0 0 24px;
      }
    `,
  ],
})
export class ForbiddenComponent {
  auth = inject(AuthService);
}

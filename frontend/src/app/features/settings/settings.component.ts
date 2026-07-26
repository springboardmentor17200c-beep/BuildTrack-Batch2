import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <p class="crumb">Dashboard &nbsp;/&nbsp; Settings</p>
      <div class="page-header">
        <h1>Settings</h1>
      </div>

      <div class="panel" style="padding: 24px;">
        <p style="margin:0 0 6px; font-weight:700;">Signed in as</p>
        <p style="margin:0; color:var(--muted); font-size:14px;">
          {{ auth.currentUser()?.name }} — {{ auth.currentUser()?.email }} ({{ auth.currentUser()?.role }})
        </p>
        <p style="margin-top:18px; color:var(--muted); font-size:13px;">
          Organization settings, user management, and role assignment will live here once the
          backend user-management API is available.
        </p>
      </div>
    </div>
  `,
})
export class SettingsComponent {
  auth = inject(AuthService);
}

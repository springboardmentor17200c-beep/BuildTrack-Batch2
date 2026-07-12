import { Directive, Input, TemplateRef, ViewContainerRef, effect, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/models';

/**
 * Structural directive that renders its content only if the logged-in user's
 * role is in the given list.
 *
 * Usage:
 *   <button *appHasRole="['Administrator', 'Project Manager']">New Project</button>
 */
@Directive({
  selector: '[appHasRole]',
  standalone: true,
})
export class HasRoleDirective {
  private templateRef = inject(TemplateRef<unknown>);
  private viewContainer = inject(ViewContainerRef);
  private auth = inject(AuthService);

  private allowedRoles: UserRole[] = [];
  private hasView = false;

  constructor() {
    effect(() => {
      const role = this.auth.currentUser()?.role;
      const isAllowed = !!role && this.allowedRoles.includes(role);

      if (isAllowed && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!isAllowed && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }

  @Input() set appHasRole(roles: UserRole[]) {
    this.allowedRoles = roles ?? [];
  }
}

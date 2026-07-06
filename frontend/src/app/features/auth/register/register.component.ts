import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { USER_ROLES, UserRole } from "../../../core/models/auth.models";
import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "bt-register",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./register.component.html"
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly roles = USER_ROLES;
  readonly form = this.fb.nonNullable.group({
    fullName: ["", [Validators.required, Validators.minLength(3)]],
    email: ["", [Validators.required, Validators.email]],
    company: [""],
    role: [UserRole.ProjectManager, [Validators.required]],
    password: ["", [Validators.required, Validators.minLength(6)]]
  });

  errorMessage = "";
  isSubmitting = false;

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = "";
    this.isSubmitting = true;

    try {
      await this.auth.register(this.form.getRawValue());
      await this.router.navigateByUrl("/dashboard");
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Registration failed.";
    } finally {
      this.isSubmitting = false;
    }
  }
}

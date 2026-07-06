import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";

import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "bt-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./login.component.html"
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  errorMessage = "";
  isSubmitting = false;

  readonly form = this.fb.nonNullable.group({
    email: ["admin@buildtrack.local", [Validators.required, Validators.email]],
    password: ["password", [Validators.required, Validators.minLength(6)]]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = "";
    this.isSubmitting = true;

    try {
      await this.auth.login(this.form.getRawValue());
      await this.router.navigateByUrl("/dashboard");
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Login failed.";
    } finally {
      this.isSubmitting = false;
    }
  }
}

import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "bt-forgot-password",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./forgot-password.component.html"
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  errorMessage = "";
  successMessage = "";
  isSubmitting = false;

  readonly form = this.fb.nonNullable.group({
    email: ["", [Validators.required, Validators.email]]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = "";
    this.successMessage = "";
    this.isSubmitting = true;

    try {
      await this.auth.requestPasswordReset(this.form.getRawValue().email);
      this.successMessage = "Password reset instructions are ready to be sent when the backend email service is connected.";
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Password reset failed.";
    } finally {
      this.isSubmitting = false;
    }
  }
}

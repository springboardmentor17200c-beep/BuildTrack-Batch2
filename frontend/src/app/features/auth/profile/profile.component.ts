import { CommonModule } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";

import { AuthService } from "../../../core/services/auth.service";

@Component({
  selector: "bt-profile",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: "./profile.component.html"
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  public readonly auth = inject(AuthService);

  readonly user = computed(() => this.auth.currentUser());
  message = "";
  errorMessage = "";
  isSubmitting = false;

  readonly form = this.fb.nonNullable.group({
    fullName: [this.user()?.fullName ?? "", [Validators.required, Validators.minLength(3)]],
    phone: [this.user()?.phone ?? ""],
    company: [this.user()?.company ?? ""]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.message = "";
    this.errorMessage = "";
    this.isSubmitting = true;

    try {
      await this.auth.updateProfile(this.form.getRawValue());
      this.message = "Profile updated.";
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : "Profile update failed.";
    } finally {
      this.isSubmitting = false;
    }
  }
}

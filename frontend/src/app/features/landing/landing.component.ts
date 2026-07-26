import { Component, ChangeDetectionStrategy, signal } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-landing",
  standalone: true,
  imports: [RouterLink],
  templateUrl: "./landing.component.html",
  styleUrl: "./landing.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingComponent {
  protected readonly mobileMenuOpen = signal(false);

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen.update((open) => !open);
  }

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }
}
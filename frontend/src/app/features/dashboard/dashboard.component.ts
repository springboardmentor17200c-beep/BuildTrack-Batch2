import { CommonModule } from "@angular/common";
import { Component, computed } from "@angular/core";
import { RouterLink } from "@angular/router";

import { UserRole } from "../../core/models/auth.models";
import { AuthService } from "../../core/services/auth.service";

interface DashboardItem {
  label: string;
  value: string;
  note: string;
}

@Component({
  selector: "bt-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.component.html"
})
export class DashboardComponent {
  readonly user = computed(() => this.auth.currentUser());
  readonly cards = computed(() => this.cardsForRole(this.user()?.role));

  constructor(public readonly auth: AuthService) {}

  private cardsForRole(role?: UserRole): DashboardItem[] {
    switch (role) {
      case UserRole.Administrator:
        return [
          { label: "Active projects", value: "18", note: "Across metro, road, mall, and apartment works" },
          { label: "Users", value: "246", note: "Managers, engineers, contractors, workers, clients" },
          { label: "Reports due", value: "7", note: "Budget and site progress summaries" }
        ];
      case UserRole.ProjectManager:
        return [
          { label: "Assigned projects", value: "5", note: "Hyderabad Metro Station is in execution" },
          { label: "Budget used", value: "62%", note: "Current planned spend versus approved budget" },
          { label: "Milestones", value: "14/22", note: "Completed milestones this phase" }
        ];
      case UserRole.SiteEngineer:
        return [
          { label: "Daily updates", value: "3", note: "Progress logs pending photo upload" },
          { label: "Cement stock", value: "420 bags", note: "Inventory synced from store register" },
          { label: "Safety checks", value: "9", note: "Completed today" }
        ];
      case UserRole.Contractor:
        return [
          { label: "Assigned tasks", value: "11", note: "Concrete, shuttering, finishing, and steel work" },
          { label: "Workers present", value: "38", note: "Attendance marked for the current shift" },
          { label: "Task completion", value: "74%", note: "For assigned work package" }
        ];
      case UserRole.Worker:
        return [
          { label: "Attendance", value: "Present", note: "Marked for today's shift" },
          { label: "Assigned work", value: "Deck slab", note: "Report to the site engineer" },
          { label: "Shift", value: "8 AM - 5 PM", note: "Hyderabad Metro Station" }
        ];
      case UserRole.Client:
        return [
          { label: "Project status", value: "On track", note: "Current handover target is unchanged" },
          { label: "Progress", value: "68%", note: "Overall execution completion" },
          { label: "Completed milestones", value: "15", note: "Approved by project manager" }
        ];
      default:
        return [];
    }
  }
}

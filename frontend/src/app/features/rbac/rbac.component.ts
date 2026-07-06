import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "bt-rbac",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./rbac.component.html"
})
export class RbacComponent {}
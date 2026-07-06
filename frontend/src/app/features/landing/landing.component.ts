import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "bt-landing",
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: "./landing.component.html"
})
export class LandingComponent {}
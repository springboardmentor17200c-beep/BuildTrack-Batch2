import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MockDataService } from '../../core/services/mock-data.service';

interface SearchResult {
  label: string;
  sub: string;
  icon: string;
  route: string[];
}

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @Input() title = 'Dashboard';
  @Output() menuClick = new EventEmitter<void>();

  query = signal('');
  showResults = signal(false);

  results = computed<SearchResult[]>(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return [];

    const results: SearchResult[] = [];

    for (const p of this.data.projects) {
      if (p.name.toLowerCase().includes(term) || p.manager.toLowerCase().includes(term)) {
        results.push({ label: p.name, sub: `Project · ${p.manager}`, icon: 'fa-building', route: ['/projects', p.id] });
      }
    }
    for (const w of this.data.workers) {
      if (w.name.toLowerCase().includes(term) || w.role.toLowerCase().includes(term)) {
        results.push({ label: w.name, sub: `Worker · ${w.role}`, icon: 'fa-helmet-safety', route: ['/workers'] });
      }
    }
    for (const i of this.data.inventory) {
      if (i.itemName.toLowerCase().includes(term)) {
        results.push({ label: i.itemName, sub: `Inventory · ${i.category}`, icon: 'fa-boxes-stacked', route: ['/inventory'] });
      }
    }
    for (const r of this.data.resources) {
      if (r.name.toLowerCase().includes(term)) {
        results.push({ label: r.name, sub: `Resource · ${r.type}`, icon: 'fa-truck-monster', route: ['/resources'] });
      }
    }
    for (const o of this.data.purchaseOrders) {
      if (o.poNo.toLowerCase().includes(term) || o.supplier.toLowerCase().includes(term)) {
        results.push({ label: o.poNo, sub: `Purchase Order · ${o.supplier}`, icon: 'fa-cart-shopping', route: ['/procurement'] });
      }
    }

    return results.slice(0, 8);
  });

  constructor(
    public auth: AuthService,
    public data: MockDataService,
    private router: Router,
  ) {}

  onFocus(): void {
    this.showResults.set(true);
  }

  onBlur(): void {
    // Delay so a click on a result registers before the list disappears.
    setTimeout(() => this.showResults.set(false), 150);
  }

  goTo(result: SearchResult): void {
    this.router.navigate(result.route);
    this.query.set('');
    this.showResults.set(false);
  }
}

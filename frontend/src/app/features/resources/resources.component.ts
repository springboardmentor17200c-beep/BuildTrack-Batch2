import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { ResourceItem, ResourceStatus } from '../../core/models/models';

@Component({
  selector: 'app-resources',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './resources.component.html',
  styleUrl: './resources.component.scss',
})
export class ResourcesComponent {
  private fb = new FormBuilder();

  searchTerm = signal('');
  showFilter = signal(false);
  filterType = signal('ALL');
  filterStatus = signal('ALL');

  showAddModal = signal(false);
  editingResource = signal<ResourceItem | null>(null);

  toggleFilter(): void {
    this.showFilter.set(!this.showFilter());
  }

  onFilterTypeChange(event: Event): void {
    this.filterType.set((event.target as HTMLSelectElement).value || 'ALL');
    this.currentPage.set(1);
  }

  onFilterStatusChange(event: Event): void {
    this.filterStatus.set((event.target as HTMLSelectElement).value || 'ALL');
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.filterType.set('ALL');
    this.filterStatus.set('ALL');
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  get hasActiveFilters(): boolean {
    return this.filterType() !== 'ALL' || this.filterStatus() !== 'ALL';
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.filterType() !== 'ALL') count++;
    if (this.filterStatus() !== 'ALL') count++;
    return count;
  }

  get filteredResources() {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.filterType();
    const status = this.filterStatus();

    let list = this.data.resources;

    if (term) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term),
      );
    }

    if (type !== 'ALL') {
      list = list.filter((r) => r.type.toLowerCase() === type.toLowerCase());
    }

    if (status !== 'ALL') {
      list = list.filter((r) => r.status.toLowerCase() === status.toLowerCase());
    }

    return list;
  }

  readonly pageSize = 10;
  currentPage = signal(1);

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredResources.length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedResources(): ResourceItem[] {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.filteredResources.slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.filteredResources.length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.filteredResources.length);
  }

  form = this.fb.group({
    name: ['', Validators.required],
    type: ['Equipment' as ResourceItem['type'], Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit: ['Nos', Validators.required],
    status: ['Available' as ResourceStatus, Validators.required],
  });

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.currentPage.set(1);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Available':
        return 'badge-green';
      case 'In Use':
        return 'badge-blue';
      default:
        return 'badge-amber';
    }
  }

  openAdd(): void {
    this.editingResource.set(null);
    this.form.reset({ type: 'Equipment', quantity: 1, unit: 'Nos', status: 'Available' });
    this.showAddModal.set(true);
  }

  openEdit(resource: ResourceItem): void {
    this.editingResource.set(resource);
    this.form.reset({
      name: resource.name,
      type: resource.type,
      quantity: resource.quantity,
      unit: resource.unit,
      status: resource.status,
    });
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    this.showAddModal.set(false);
  }

  submitAdd(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload = {
      name: v.name!,
      type: v.type as any,
      quantity: v.quantity!,
      unit: v.unit!,
      status: v.status as ResourceStatus,
    };
    const editing = this.editingResource();
    if (editing) {
      this.data.updateResource({ ...editing, ...payload });
    } else {
      this.data.addResource(payload);
    }
    this.closeAdd();
  }

  deleteResource(resource: ResourceItem): void {
    if (confirm(`Delete ${resource.name}?`)) {
      this.data.deleteResource(resource);
    }
  }
}

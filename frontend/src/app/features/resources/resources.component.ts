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
  showAddModal = signal(false);
  editingResource = signal<ResourceItem | null>(null);

  get filteredResources() {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.data.resources;
    if (!term) return list;
    return list.filter(
      (r) => r.name.toLowerCase().includes(term) || r.type.toLowerCase().includes(term),
    );
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

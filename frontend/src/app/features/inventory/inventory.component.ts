import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { InventoryItem, StockStatus } from '../../core/models/models';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent {
  private fb = new FormBuilder();

  searchTerm = signal('');
  showAddModal = signal(false);
  editingItem = signal<InventoryItem | null>(null);

  get filteredInventory() {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.data.inventory;
    if (!term) return list;
    return list.filter(
      (i) => i.itemName.toLowerCase().includes(term) || i.category.toLowerCase().includes(term),
    );
  }

  form = this.fb.group({
    itemName: ['', Validators.required],
    category: ['Construction' as InventoryItem['category'], Validators.required],
    unit: ['', Validators.required],
    stock: [0, [Validators.required, Validators.min(0)]],
    status: ['In Stock' as StockStatus, Validators.required],
  });

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'In Stock':
        return 'badge-green';
      case 'Low Stock':
        return 'badge-amber';
      default:
        return 'badge-red';
    }
  }

  openAdd(): void {
    this.editingItem.set(null);
    this.form.reset({ category: 'Construction', unit: '', stock: 0, status: 'In Stock' });
    this.showAddModal.set(true);
  }

  openEdit(item: InventoryItem): void {
    this.editingItem.set(item);
    this.form.reset({
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      stock: item.stock,
      status: item.status,
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
      itemName: v.itemName!,
      category: v.category as any,
      unit: v.unit!,
      stock: v.stock!,
      status: v.status as StockStatus,
    };
    const editing = this.editingItem();
    if (editing) {
      this.data.updateInventoryItem({ ...editing, ...payload });
    } else {
      this.data.addInventoryItem(payload);
    }
    this.closeAdd();
  }

  deleteItem(item: InventoryItem): void {
    if (confirm(`Delete ${item.itemName}?`)) {
      this.data.deleteInventoryItem(item);
    }
  }
}

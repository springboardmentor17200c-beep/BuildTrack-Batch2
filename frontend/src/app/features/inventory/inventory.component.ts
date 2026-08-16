import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryService, LiveInventoryItem } from '../../core/services/inventory.service';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent implements OnInit {
  private fb = inject(FormBuilder);
  private invService = inject(InventoryService);

  searchTerm = signal('');
  showAddModal = signal(false);
  editingItem = signal<LiveInventoryItem | null>(null);
  items = signal<LiveInventoryItem[]>([]);
  loading = signal(false);

  filteredInventory = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.items();
    if (!term) return list;
    return list.filter(
      (i) =>
        (i.material_name || i.itemName || i.material || '').toLowerCase().includes(term) ||
        (i.category || '').toLowerCase().includes(term) ||
        (i.location || '').toLowerCase().includes(term)
    );
  });

  form = this.fb.group({
    material_name: ['', Validators.required],
    category: ['Construction', Validators.required],
    unit: ['Nos', Validators.required],
    quantity: [0, [Validators.required, Validators.min(0)]],
    unit_cost: [0, [Validators.min(0)]],
    location: ['Main Warehouse'],
    status: ['in_stock', Validators.required],
  });

  ngOnInit(): void {
    this.loadInventory();
  }

  loadInventory(): void {
    this.loading.set(true);
    this.invService.getItems().subscribe({
      next: (res) => {
        this.items.set(res || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  statusClass(status: string): string {
    const s = (status || '').toLowerCase().replace(/_/g, ' ');
    if (s.includes('in stock') || s === 'in stock') return 'badge-green';
    if (s.includes('low')) return 'badge-amber';
    return 'badge-red';
  }

  formatStatus(status: string): string {
    const s = (status || '').toLowerCase().replace(/_/g, ' ');
    if (s.includes('in stock') || s === 'in stock') return 'In Stock';
    if (s.includes('low')) return 'Low Stock';
    return 'Out of Stock';
  }

  openAdd(): void {
    this.editingItem.set(null);
    this.form.reset({
      material_name: '',
      category: 'Construction',
      unit: 'Nos',
      quantity: 0,
      unit_cost: 0,
      location: 'Main Warehouse',
      status: 'in_stock',
    });
    this.showAddModal.set(true);
  }

  openEdit(item: LiveInventoryItem): void {
    this.editingItem.set(item);
    this.form.reset({
      material_name: item.material_name || item.itemName || item.material || '',
      category: item.category || 'Construction',
      unit: item.unit || 'Nos',
      quantity: item.quantity !== undefined ? item.quantity : (item.stock || item.stock_quantity || 0),
      unit_cost: item.unit_cost || 0,
      location: item.location || 'Main Warehouse',
      status: (item.status || 'in_stock').toLowerCase(),
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
    const payload: Partial<LiveInventoryItem> = {
      material_name: v.material_name!,
      category: v.category!,
      unit: v.unit!,
      quantity: Number(v.quantity) || 0,
      unit_cost: Number(v.unit_cost) || 0,
      location: v.location || 'Main Warehouse',
      status: v.status || 'in_stock',
    };
    const editing = this.editingItem();
    const id = editing?._id || editing?.id;

    if (editing && id) {
      this.invService.updateItem(id, payload).subscribe({
        next: () => {
          this.loadInventory();
          this.closeAdd();
        },
      });
    } else {
      this.invService.createItem(payload).subscribe({
        next: () => {
          this.loadInventory();
          this.closeAdd();
        },
      });
    }
  }

  deleteItem(item: LiveInventoryItem): void {
    const id = item._id || item.id;
    const name = item.material_name || item.itemName || item.material || 'item';
    if (id && confirm(`Are you sure you want to delete "${name}" from inventory?`)) {
      this.invService.deleteItem(id).subscribe({
        next: () => this.loadInventory(),
      });
    }
  }
}

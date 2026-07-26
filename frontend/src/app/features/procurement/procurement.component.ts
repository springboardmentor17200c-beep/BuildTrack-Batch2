import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MockDataService } from '../../core/services/mock-data.service';
import { OrderStatus, PurchaseOrder } from '../../core/models/models';

@Component({
  selector: 'app-procurement',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './procurement.component.html',
  styleUrl: './procurement.component.scss',
})
export class ProcurementComponent {
  private fb = new FormBuilder();

  searchTerm = signal('');
  showAddModal = signal(false);
  editingOrder = signal<PurchaseOrder | null>(null);

  get filteredOrders() {
    const term = this.searchTerm().trim().toLowerCase();
    const list = this.data.purchaseOrders;
    if (!term) return list;
    return list.filter(
      (o) =>
        o.poNo.toLowerCase().includes(term) ||
        o.supplier.toLowerCase().includes(term) ||
        o.itemsSummary.toLowerCase().includes(term),
    );
  }

  form = this.fb.group({
    supplier: ['', Validators.required],
    itemsSummary: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(1)]],
    status: ['Pending' as OrderStatus, Validators.required],
    requestDate: ['', Validators.required],
  });

  constructor(public data: MockDataService) {}

  onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Approved':
        return 'badge-green';
      case 'Pending':
        return 'badge-amber';
      case 'Delivered':
        return 'badge-blue';
      default:
        return 'badge-red';
    }
  }

  openAdd(): void {
    this.editingOrder.set(null);
    this.form.reset({ status: 'Pending', amount: 0, requestDate: this.today() });
    this.showAddModal.set(true);
  }

  openEdit(order: PurchaseOrder): void {
    this.editingOrder.set(order);
    this.form.reset({
      supplier: order.supplier,
      itemsSummary: order.itemsSummary,
      amount: order.amount,
      status: order.status,
      requestDate: this.toInputDate(order.requestDate),
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
      supplier: v.supplier!,
      itemsSummary: v.itemsSummary!,
      amount: v.amount!,
      status: v.status as OrderStatus,
      requestDate: v.requestDate!,
    };
    const editing = this.editingOrder();
    if (editing) {
      this.data.updatePurchaseOrder({ ...editing, ...payload });
    } else {
      this.data.addPurchaseOrder(payload);
    }
    this.closeAdd();
  }

  deleteOrder(order: PurchaseOrder): void {
    if (confirm(`Delete ${order.poNo}?`)) {
      this.data.deletePurchaseOrder(order);
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private toInputDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 10);
  }
}

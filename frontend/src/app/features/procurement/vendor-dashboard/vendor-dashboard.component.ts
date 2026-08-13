import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ProcurementService } from '../../../core/services/procurement.service';
import { VendorDashboardStats } from '../../../core/models/models';

@Component({
  selector: 'app-vendor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: ``,
  styleUrls: ['./vendor-dashboard.component.scss'],
})
export class VendorDashboardComponent implements OnInit {
  private proc = inject(ProcurementService);
  private notify = inject(NotificationService);
  private auth = inject(AuthService);

  stats = signal<VendorDashboardStats | null>(null);
  loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  vendorName() {
    return this.auth.currentUser()?.name || 'Vendor';
  }

  pendingRequests() {
    return this.stats()?.requests || [];
  }

  load() {
    this.loading.set(true);
    this.proc.getVendorDashboard().subscribe({
      next: (res: VendorDashboardStats) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.notify.error('Failed to load vendor dashboard');
        this.loading.set(false);
      },
    });
  }

  accept(item: any) {
    this.proc.vendorAcceptRequest(item._id || item.id).subscribe({
      next: () => {
        this.notify.success('Request accepted');
        this.load();
      },
      error: (err: any) => this.notify.error(err?.error?.detail || 'Accept failed'),
    });
  }

  reject(item: any) {
    const reason = window.prompt('Enter rejection reason / comment (required):');
    if (!reason || !reason.trim()) {
      this.notify.error('A rejection reason is required');
      return;
    }
    this.proc.vendorRejectRequest(item._id || item.id, reason).subscribe({
      next: () => {
        this.notify.success('Request rejected');
        this.load();
      },
      error: (err: any) => this.notify.error(err?.error?.detail || 'Reject failed'),
    });
  }

  confirmPO(po: any) {
    this.proc.acceptPurchaseOrder(po._id || po.id).subscribe({
      next: () => {
        this.notify.success('Purchase order confirmed');
        this.load();
      },
      error: (err: any) => this.notify.error(err?.error?.detail || 'PO confirmation failed'),
    });
  }

  view(item: any) {
    this.notify.info(`Request ${item.request_id || item._id}: ${item.material_name}, Qty ${item.quantity}`);
  }

  viewPO(po: any) {
    this.notify.info(`PO ${po.po_number} - Total: ${po.total_cost}`);
  }

  statusBadgeClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'vendor_accepted' || s === 'accepted') return 'badge-green';
    if (s === 'vendor_rejected' || s === 'rejected') return 'badge-red';
    return 'badge-amber';
  }

  poStatusBadge(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'accepted' || s === 'delivered') return 'badge-green';
    if (s === 'sent') return 'badge-blue';
    return 'badge-amber';
  }
}

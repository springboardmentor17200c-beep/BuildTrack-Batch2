import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User, UserRole } from '../../core/models/models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  public auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);

  // Tabs: 'profile' | 'users'
  activeTab = signal<'profile' | 'users'>('profile');

  // Profile update state
  profileForm = this.fb.group({
    name: [this.auth.currentUser()?.name || '', Validators.required],
    email: [this.auth.currentUser()?.email || '', [Validators.required, Validators.email]],
    currentPassword: [''],
    newPassword: [''],
    confirmPassword: [''],
  });
  savingProfile = signal(false);
  profileSuccess = signal('');
  profileError = signal('');
  profileChanges = signal<string[]>([]);

  users = signal<User[]>([]);
  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  searchTerm = signal('');
  selectedRole = signal('ALL');
  selectedStatus = signal('ALL');

  // Modal states
  showEditModal = signal(false);
  showDeleteModal = signal(false);
  selectedUser = signal<User | null>(null);
  saving = signal(false);

  rolesList: UserRole[] = [
    'Administrator',
    'Project Manager',
    'Site Engineer',
    'Contractor',
    'Worker',
    'Client',
    'Vendor',
  ];

  editForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['Worker' as UserRole, Validators.required],
    status: ['Active', Validators.required],
  });

  // Pagination
  readonly pageSize = 10;
  currentPage = signal(1);

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.profileForm.patchValue({
        name: user.name,
        email: user.email,
      });
    }

    this.route.queryParams.subscribe((params) => {
      const tabParam = params['tab'];
      if (tabParam === 'users' && this.auth.hasRole(['Administrator'])) {
        this.activeTab.set('users');
      } else {
        this.activeTab.set('profile');
      }
    });

    if (this.auth.hasRole(['Administrator'])) {
      this.loadUsers();
    }
  }

  setTab(tab: 'profile' | 'users'): void {
    this.activeTab.set(tab);
    this.profileSuccess.set('');
    this.profileError.set('');
    this.errorMessage.set('');
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const { name, email, currentPassword, newPassword, confirmPassword } = this.profileForm.getRawValue();

    if (newPassword) {
      if (newPassword.length < 6) {
        this.profileError.set('New password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        this.profileError.set('New password and confirmation do not match.');
        return;
      }
    }

    this.savingProfile.set(true);
    this.profileError.set('');
    this.profileSuccess.set('');
    this.profileChanges.set([]);

    this.auth
      .updateProfile({
        name: name || undefined,
        email: email || undefined,
        current_password: currentPassword || undefined,
        new_password: newPassword || undefined,
      })
      .subscribe({
        next: (res) => {
          this.savingProfile.set(false);
          this.profileSuccess.set(
            'Settings updated successfully! Administrators have been notified of your profile changes.',
          );
          this.profileChanges.set(res.changes || []);
          this.profileForm.patchValue({
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
          // Update current user signals
          const updated = this.auth.currentUser();
          if (updated) {
            this.profileForm.patchValue({
              name: updated.name,
              email: updated.email,
            });
          }
        },
        error: (err) => {
          console.error('Failed to update profile settings', err);
          this.savingProfile.set(false);
          this.profileError.set(err?.error?.detail || 'Failed to update profile settings.');
        },
      });
  }

  loadUsers(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.auth.getUsers().subscribe({
      next: (list) => {
        this.users.set(list || []);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load users', err);
        this.errorMessage.set('Failed to load user accounts.');
        this.loading.set(false);
      },
    });
  }

  // Filtered list
  filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const roleFilter = this.selectedRole();
    const statusFilter = this.selectedStatus();

    let list = this.users();

    if (term) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term) ||
          (u.role && u.role.toLowerCase().includes(term)),
      );
    }

    if (roleFilter !== 'ALL') {
      list = list.filter((u) => u.role === roleFilter);
    }

    if (statusFilter !== 'ALL') {
      list = list.filter((u) => (u.status || 'Active') === statusFilter);
    }

    return list;
  });

  // Pagination getters
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize));
  }

  get pagesList(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  get paginatedUsers(): User[] {
    const page = Math.min(this.currentPage(), this.totalPages);
    const start = (page - 1) * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  }

  get startItemIndex(): number {
    if (this.filteredUsers().length === 0) return 0;
    const page = Math.min(this.currentPage(), this.totalPages);
    return (page - 1) * this.pageSize + 1;
  }

  get endItemIndex(): number {
    const page = Math.min(this.currentPage(), this.totalPages);
    return Math.min(page * this.pageSize, this.filteredUsers().length);
  }

  // Summary counts
  get totalCount(): number {
    return this.users().length;
  }

  get adminCount(): number {
    return this.users().filter((u) => u.role === 'Administrator').length;
  }

  get managerCount(): number {
    return this.users().filter((u) => u.role === 'Project Manager').length;
  }

  get contractorCount(): number {
    return this.users().filter((u) => u.role === 'Contractor').length;
  }

  get siteEngineerCount(): number {
    return this.users().filter((u) => u.role === 'Site Engineer').length;
  }

  get workerCount(): number {
    return this.users().filter((u) => u.role === 'Worker').length;
  }

  get clientCount(): number {
    return this.users().filter((u) => u.role === 'Client').length;
  }

  get suspendedCount(): number {
    return this.users().filter((u) => u.status === 'Suspended').length;
  }

  getUserInitials(name?: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  getRoleBadgeColor(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return '#3b82f6';
    if (r.includes('manager')) return '#10b981';
    if (r.includes('engineer')) return '#f59e0b';
    if (r.includes('contractor')) return '#8b5cf6';
    if (r.includes('worker')) return '#ec4899';
    if (r.includes('client')) return '#06b6d4';
    if (r.includes('vendor')) return '#f97316';
    return '#64748b';
  }

  getRoleClass(role?: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'badge-admin';
    if (r.includes('manager')) return 'badge-manager';
    if (r.includes('engineer')) return 'badge-engineer';
    if (r.includes('contractor')) return 'badge-contractor';
    if (r.includes('worker')) return 'badge-worker';
    if (r.includes('client')) return 'badge-client';
    if (r.includes('vendor')) return 'badge-vendor';
    return 'badge-default';
  }

  openEdit(user: User): void {
    this.selectedUser.set(user);
    this.editForm.reset({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'Active',
    });
    this.errorMessage.set('');
    this.showEditModal.set(true);
  }

  closeEdit(): void {
    if (this.saving()) return;
    this.showEditModal.set(false);
    this.selectedUser.set(null);
  }

  submitEdit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const user = this.selectedUser();
    if (!user) return;

    this.saving.set(true);
    this.errorMessage.set('');
    const formVal = this.editForm.getRawValue();

    this.auth
      .updateUser(user.id, {
        name: formVal.name || user.name,
        email: formVal.email || user.email,
        role: formVal.role || user.role,
        status: formVal.status || user.status,
      })
      .subscribe({
        next: (updatedUser) => {
          this.saving.set(false);
          this.users.update((list) =>
            list.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
          );
          this.showEditModal.set(false);
          this.showFlashMessage(`User account for ${updatedUser.email} updated successfully.`);
        },
        error: (err) => {
          console.error('Update user error', err);
          this.saving.set(false);
          this.errorMessage.set(err?.error?.detail || 'Failed to update user.');
        },
      });
  }

  toggleStatus(user: User): void {
    if (user.id === this.auth.currentUser()?.id) {
      alert('You cannot suspend your own logged-in administrator account.');
      return;
    }

    const newStatus = user.status === 'Suspended' ? 'active' : 'suspended';
    const actionName = newStatus === 'active' ? 'Reactivate' : 'Suspend';

    if (!confirm(`${actionName} user account for ${user.email}?`)) return;

    this.auth.setUserStatus(user.id, newStatus).subscribe({
      next: (updatedUser) => {
        this.users.update((list) =>
          list.map((u) => (u.id === updatedUser.id ? updatedUser : u)),
        );
        this.showFlashMessage(
          `Account for ${user.email} is now ${updatedUser.status}.`,
        );
      },
      error: (err) => {
        console.error('Failed to change status', err);
        alert(err?.error?.detail || 'Failed to change account status.');
      },
    });
  }

  openDelete(user: User): void {
    if (user.id === this.auth.currentUser()?.id) {
      alert('You cannot delete your own logged-in administrator account.');
      return;
    }
    this.selectedUser.set(user);
    this.showDeleteModal.set(true);
  }

  closeDelete(): void {
    if (this.saving()) return;
    this.showDeleteModal.set(false);
    this.selectedUser.set(null);
  }

  confirmDelete(): void {
    const user = this.selectedUser();
    if (!user) return;

    this.saving.set(true);
    this.auth.deleteUser(user.id, true).subscribe({
      next: () => {
        this.saving.set(false);
        this.users.update((list) => list.filter((u) => u.id !== user.id));
        this.showDeleteModal.set(false);
        this.selectedUser.set(null);
        this.showFlashMessage(
          `Account for ${user.email} removed and permanently blocked from future access.`,
        );
      },
      error: (err) => {
        console.error('Delete user error', err);
        this.saving.set(false);
        alert(err?.error?.detail || 'Failed to remove user account.');
      },
    });
  }

  private showFlashMessage(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(''), 5000);
  }
}

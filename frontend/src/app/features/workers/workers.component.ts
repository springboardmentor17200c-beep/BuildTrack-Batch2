import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import { WorkforceService } from '../../core/services/workforce.service';
import { ProjectsService } from '../../core/services/projects.service';

@Component({
  selector: 'app-workers',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule
  ],
  templateUrl: './workers.component.html',
  styleUrls: ['./workers.component.scss']
})
export class WorkersComponent implements OnInit {

  workers = signal<any[]>([]);
  projects = signal<any[]>([]);

  loading = signal(false);
  saving = signal(false);

  showAddModal = signal(false);
  editingWorker = signal<any | null>(null);

  errorMessage = signal('');
  searchTerm = signal('');

  form: FormGroup;

  categories = [
    'SKILLED_WORKER',
    'UNSKILLED_WORKER',
    'ENGINEER',
    'SUPERVISOR',
    'CONTRACTOR',
    'CONSULTANT'
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly workforceService: WorkforceService,
    private readonly projectsService: ProjectsService
  ) {
    this.form = this.fb.group({

      firstName: [
        '',
        Validators.required
      ],

      lastName: [
        '',
        Validators.required
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      phone: [
        '',
        Validators.required
      ],

      category: [
        'SKILLED_WORKER',
        Validators.required
      ],

      skillType: [
        '',
        Validators.required
      ],

      designation: [
        '',
        Validators.required
      ],

      experienceYears: [
        0,
        [
          Validators.required,
          Validators.min(0)
        ]
      ],

      employmentType: [
        'FULL_TIME',
        Validators.required
      ],

      joiningDate: [
        this.today(),
        Validators.required
      ],

      salaryType: [
        'MONTHLY',
        Validators.required
      ],

      hourlyRate: [
        0,
        Validators.min(0)
      ],

      salaryAmount: [
        0,
        Validators.min(0)
      ],

      projectId: [
        ''
      ],

      status: [
        'available',
        Validators.required
      ]
    });
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadWorkers();
  }

  private today(): string {
    return new Date()
      .toISOString()
      .substring(0, 10);
  }

  // =========================
  // PROJECTS
  // =========================

  private loadProjects(): void {
    this.projectsService.getProjects({ limit: 500 }).subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : response?.items || response?.data || [];

        this.projects.set(
          list.map((project: any) => ({
            ...project,
            id: project.id || project._id,
          }))
        );
      },
      error: (error: any) => {
        console.error('Load projects error:', error);
      },
    });
  }

  projectName(projectId: string): string {
    if (!projectId) {
      return 'Unassigned';
    }

    const project =
      this.projects().find(
        p => p.id === projectId
      );

    return project?.name || 'Unassigned';
  }

  // =========================
  // LOAD
  // =========================

  loadWorkers(): void {
    this.loading.set(true);
    this.errorMessage.set('');

    this.workforceService
      .getWorkers()
      .subscribe({

        next: (response: any) => {

          const list =
            Array.isArray(response)
              ? response
              : response?.items ||
                response?.data ||
                [];

          this.workers.set(
            list.map(
              (worker: any) =>
                this.fromBackend(worker)
            )
          );

          this.loading.set(false);
        },

        error: (error: any) => {

          console.error(
            'Load workers error:',
            error
          );

          this.errorMessage.set(
            this.formatError(error)
          );

          this.loading.set(false);
        }
      });
  }

  // =========================
  // BACKEND -> FRONTEND
  // =========================

  private fromBackend(worker: any): any {

    const firstName =
      worker.first_name || '';

    const lastName =
      worker.last_name || '';

    return {

      ...worker,

      id:
        worker._id ||
        worker.id,

      firstName,
      lastName,

      name:
        `${firstName} ${lastName}`
          .trim() ||
        worker.name ||
        'Worker',

      email:
        worker.email || '',

      phone:
        worker.phone || '',

      contact:
        worker.phone || '',

      category:
        worker.category ||
        'SKILLED_WORKER',

      skillType:
        worker.skill_type || '',

      designation:
        worker.designation || '',

      role:
        worker.designation || '',

      experienceYears:
        worker.experience_years ?? 0,

      employmentType:
        worker.employment_type ||
        'FULL_TIME',

      joiningDate:
        worker.joining_date || '',

      salaryType:
        worker.salary_type ||
        'MONTHLY',

      hourlyRate:
        worker.hourly_rate ?? 0,

      salaryAmount:
        worker.salary_amount ?? 0,

      assignedProjectId:
        worker.project_id || '',

      status:
        worker.status === 'available'
          ? 'Active'
          : 'Inactive',

      attendancePct:
        worker.attendance_pct ??
        worker.attendancePct ??
        0,

      avatarUrl:
        worker.avatar_url ||
        ''
    };
  }

  // =========================
  // SEARCH
  // =========================

  onSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchTerm.set(
      input.value
    );
  }

  get filteredWorkers(): any[] {

    const search =
      this.searchTerm()
        .trim()
        .toLowerCase();

    if (!search) {
      return this.workers();
    }

    return this.workers().filter(
      worker =>
        String(worker.name || '')
          .toLowerCase()
          .includes(search) ||

        String(worker.email || '')
          .toLowerCase()
          .includes(search) ||

        String(worker.phone || '')
          .toLowerCase()
          .includes(search) ||

        String(worker.category || '')
          .toLowerCase()
          .includes(search) ||

        String(worker.designation || '')
          .toLowerCase()
          .includes(search)
    );
  }

  // =========================
  // ADD
  // =========================

  openAdd(): void {

    this.editingWorker.set(null);

    this.form.reset({

      firstName: '',
      lastName: '',
      email: '',
      phone: '',

      category:
        'SKILLED_WORKER',

      skillType: '',
      designation: '',

      experienceYears: 0,

      employmentType:
        'FULL_TIME',

      joiningDate:
        this.today(),

      salaryType:
        'MONTHLY',

      hourlyRate: 0,
      salaryAmount: 0,

      projectId: '',

      status:
        'available'
    });

    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  // =========================
  // EDIT
  // =========================

  openEdit(worker: any): void {

    this.editingWorker.set(
      worker
    );

    this.form.patchValue({

      firstName:
        worker.firstName || '',

      lastName:
        worker.lastName || '',

      email:
        worker.email || '',

      phone:
        worker.phone || '',

      category:
        worker.category ||
        'SKILLED_WORKER',

      skillType:
        worker.skillType || '',

      designation:
        worker.designation ||
        '',

      experienceYears:
        worker.experienceYears ?? 0,

      employmentType:
        worker.employmentType ||
        'FULL_TIME',

      joiningDate:
        worker.joiningDate
          ? String(
              worker.joiningDate
            ).substring(0, 10)
          : this.today(),

      salaryType:
        worker.salaryType ||
        'MONTHLY',

      hourlyRate:
        worker.hourlyRate ?? 0,

      salaryAmount:
        worker.salaryAmount ?? 0,

      projectId:
        worker.assignedProjectId ||
        '',

      status:
        worker.status === 'Active'
          ? 'available'
          : 'unavailable'
    });

    this.errorMessage.set('');
    this.showAddModal.set(true);
  }

  // =========================
  // CLOSE
  // =========================

  closeAdd(): void {

    if (this.saving()) {
      return;
    }

    this.showAddModal.set(false);
    this.editingWorker.set(null);
  }

  // =========================
  // SUBMIT
  // =========================

  submitAdd(): void {

    this.errorMessage.set('');

    if (this.form.invalid) {

      this.form.markAllAsTouched();

      this.errorMessage.set(
        'Please fill all required fields.'
      );

      return;
    }

    this.saving.set(true);

    const value =
      this.form.getRawValue();

    /*
     * IMPORTANT:
     * These are FRONTEND names.
     * workforce.service.ts converts
     * them to first_name, last_name,
     * email, phone, etc.
     */

    const worker = {

      firstName:
        String(
          value.firstName || ''
        ).trim(),

      lastName:
        String(
          value.lastName || ''
        ).trim(),

      email:
        String(
          value.email || ''
        ).trim(),

      phone:
        String(
          value.phone || ''
        ).trim(),

      category:
        value.category,

      skillType:
        String(
          value.skillType || ''
        ).trim(),

      designation:
        String(
          value.designation || ''
        ).trim(),

      experienceYears:
        Number(
          value.experienceYears || 0
        ),

      employmentType:
        value.employmentType,

      joiningDate:
        value.joiningDate,

      salaryType:
        value.salaryType,

      hourlyRate:
        Number(
          value.hourlyRate || 0
        ),

      salaryAmount:
        Number(
          value.salaryAmount || 0
        ),

      projectId:
        value.projectId || '',

      status:
        value.status
    };

    console.log(
      'Angular worker object:',
      worker
    );

    const editing =
      this.editingWorker();

    // =========================
    // UPDATE
    // =========================

    if (editing?.id) {

      this.workforceService
        .updateWorker(
          editing.id,
          worker
        )
        .subscribe({

          next: (response) => {

            console.log(
              'Worker updated:',
              response
            );

            this.saving.set(false);
            this.closeAdd();
            this.loadWorkers();

            this.syncAllocationForWorker(
              editing.id,
              worker.projectId,
              worker.designation
            );
          },

          error: (error: any) => {

            console.error(
              'Worker update error:',
              error
            );

            this.errorMessage.set(
              this.formatError(error)
            );

            this.saving.set(false);
          }
        });

      return;
    }

    // =========================
    // CREATE
    // =========================

    this.workforceService
      .createWorker(worker)
      .subscribe({

        next: (response) => {

          console.log(
            'Worker created successfully:',
            response
          );

          const newWorkerId =
            response?.id ||
            response?._id;

          this.saving.set(false);
          this.closeAdd();
          this.loadWorkers();

          if (newWorkerId) {
            this.syncAllocationForWorker(
              newWorkerId,
              worker.projectId,
              worker.designation
            );
          }
        },

        error: (error: any) => {

          console.error(
            'Worker creation error:',
            error
          );

          console.error(
            'Backend error:',
            error?.error
          );

          this.errorMessage.set(
            this.formatError(error)
          );

          this.saving.set(false);
        }
      });
  }

  // =========================
  // ALLOCATION SYNC
  // =========================
  // Keeps worker.project_id (set above via updateWorker/createWorker)
  // in sync with an Allocation record, since the project details page
  // and the Allocation screen both read from /allocations, not from
  // the worker record directly.

  private syncAllocationForWorker(
    workerId: string,
    projectId: string,
    role: string
  ): void {

    this.workforceService
      .getAllocations(undefined, workerId)
      .subscribe({

        next: (response: any) => {

          const list =
            Array.isArray(response)
              ? response
              : response?.items ||
                response?.data ||
                [];

          const activeAllocations = list.filter(
            (a: any) =>
              String(a.status || '').toUpperCase() === 'ACTIVE'
          );

          const alreadyOnThisProject = activeAllocations.find(
            (a: any) => a.project_id === projectId
          );

          // Close out any active allocation that no longer applies
          // (project cleared, or worker moved to a different project).
          activeAllocations
            .filter((a: any) => a.project_id !== projectId)
            .forEach((a: any) => {
              this.workforceService
                .updateAllocation(a._id || a.id, { status: 'COMPLETED' })
                .subscribe({
                  error: (err: any) =>
                    console.error('Failed to close old allocation:', err),
                });
            });

          // Create a new allocation only if a project is selected and
          // the worker isn't already actively allocated to it.
          if (projectId && !alreadyOnThisProject) {
            this.workforceService
              .createAllocation({
                worker_id: workerId,
                project_id: projectId,
                role: role || undefined,
                start_date: new Date().toISOString(),
                status: 'ACTIVE',
              })
              .subscribe({
                error: (err: any) =>
                  console.error('Failed to create allocation:', err),
              });
          }
        },

        error: (error: any) => {
          console.error('Failed to load existing allocations for worker:', error);
        },
      });
  }

  // =========================
  // ERROR
  // =========================

  private formatError(
    error: any
  ): string {

    const detail =
      error?.error?.detail;

    if (Array.isArray(detail)) {

      return detail
        .map((item: any) => {

          const loc =
            Array.isArray(item?.loc)
              ? item.loc
              : [];

          const field =
            loc.length > 1
              ? loc[loc.length - 1]
              : '';

          const message =
            item?.msg ||
            'Validation error';

          return field
            ? `${field}: ${message}`
            : message;
        })
        .filter(Boolean)
        .join(' | ');
    }

    if (
      typeof detail === 'string'
    ) {
      return detail;
    }

    if (
      typeof error?.error?.message ===
      'string'
    ) {
      return error.error.message;
    }

    return 'Failed to save worker.';
  }

  // =========================
  // DELETE
  // =========================

  deleteWorker(worker: any): void {

    if (!worker?.id) {
      return;
    }

    if (
      !window.confirm(
        `Delete worker "${worker.name}"?`
      )
    ) {
      return;
    }

    this.workforceService
      .deleteWorker(worker.id)
      .subscribe({

        next: () => {

          this.workers.update(
            list =>
              list.filter(
                w =>
                  w.id !== worker.id
              )
          );
        },

        error: (error: any) => {

          console.error(
            'Delete worker error:',
            error
          );

          this.errorMessage.set(
            this.formatError(error)
          );
        }
      });
  }
}
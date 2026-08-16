import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class WorkforceService {
  private readonly http = inject(HttpClient);

  // environment.apiBaseUrl = /api/v1
  private readonly baseUrl =
    `${environment.apiBaseUrl}/workforce`;

  // =========================
  // WORKERS
  // =========================

  getWorkers(params?: {
    projectId?: string;
    category?: string;
    status?: string;
    search?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();

    if (params?.projectId) {
      httpParams = httpParams.set('project_id', params.projectId);
    }

    if (params?.category) {
      httpParams = httpParams.set('category', params.category);
    }

    // FIX: backend query param is `status_filter`, not `status`
    // (see list_workers_endpoint in app/modules/workforce/router.py)
    if (params?.status) {
      httpParams = httpParams.set('status_filter', params.status);
    }

    // NOTE: backend list_workers_endpoint has no `search` param.
    // Search is applied client-side in WorkersComponent.filteredWorkers,
    // so this is harmless to keep but does nothing server-side.
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }

    return this.http.get<any>(
      `${this.baseUrl}/workers`,
      { params: httpParams }
    );
  }

  getWorker(id: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/workers/${id}`
    );
  }

  getAvailableWorkers(): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/workers/available`
    );
  }

  createWorker(worker: any): Observable<any> {
    const payload = this.toBackendWorker(worker);

    return this.http.post<any>(
      `${this.baseUrl}/workers`,
      payload
    );
  }

  updateWorker(id: string, worker: any): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/workers/${id}`,
      this.toBackendWorker(worker)
    );
  }

  deleteWorker(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/workers/${id}`
    );
  }

  // =========================
  // ALLOCATION
  // =========================
  // FIX: the backend has NO plain `GET /workforce/allocations` list route.
  // Only these exist:
  //   GET /allocations/{allocation_id}
  //   GET /allocations/project/{project_id}
  //   GET /allocations/worker/{worker_id}
  // so this method now routes to the right path instead of sending
  // project_id/worker_id as query params against a route that 404s.

  getAllocations(
    projectId?: string,
    workerId?: string
  ): Observable<any> {
    if (projectId) {
      return this.http.get<any>(
        `${this.baseUrl}/allocations/project/${projectId}`
      );
    }

    if (workerId) {
      return this.http.get<any>(
        `${this.baseUrl}/allocations/worker/${workerId}`
      );
    }

    throw new Error(
      'getAllocations requires a projectId or workerId — ' +
      'there is no unfiltered allocations list endpoint on the backend.'
    );
  }

  getAllocation(id: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/allocations/${id}`
    );
  }

  createAllocation(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/allocations`,
      payload
    );
  }

  updateAllocation(
    id: string,
    payload: any
  ): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/allocations/${id}`,
      payload
    );
  }

  deleteAllocation(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/allocations/${id}`
    );
  }

  // =========================
  // ATTENDANCE
  // =========================
  // FIX: `GET /workforce/attendance` only accepts skip/limit on the backend —
  // worker_id/project_id/date/start_date/end_date are silently ignored there.
  // To actually filter, use:
  //   GET /attendance/worker/{worker_id}  (supports start_date/end_date)
  //   GET /attendance/project/{project_id}
  // Falls back to the plain list (unfiltered) when neither id is given.

  getAttendance(params?: {
    workerId?: string;
    projectId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<any> {
    if (params?.workerId) {
      let httpParams = new HttpParams();

      if (params?.startDate) {
        httpParams = httpParams.set('start_date', params.startDate);
      }

      if (params?.endDate) {
        httpParams = httpParams.set('end_date', params.endDate);
      }

      return this.http.get<any>(
        `${this.baseUrl}/attendance/worker/${params.workerId}`,
        { params: httpParams }
      );
    }

    if (params?.projectId) {
      return this.http.get<any>(
        `${this.baseUrl}/attendance/project/${params.projectId}`
      );
    }

    // Unfiltered list — date/startDate/endDate have no effect here,
    // filter client-side if needed.
    return this.http.get<any>(
      `${this.baseUrl}/attendance`
    );
  }

  createAttendance(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/attendance`,
      payload
    );
  }

  updateAttendance(
    id: string,
    payload: any
  ): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/attendance/${id}`,
      payload
    );
  }

  deleteAttendance(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/attendance/${id}`
    );
  }

  // =========================
  // SHIFTS
  // =========================

  getShifts(projectId?: string): Observable<any> {
    let params = new HttpParams();

    if (projectId) {
      params = params.set(
        'project_id',
        projectId
      );
    }

    return this.http.get<any>(
      `${this.baseUrl}/shifts`,
      { params }
    );
  }

  getShift(id: string): Observable<any> {
    return this.http.get<any>(
      `${this.baseUrl}/shifts/${id}`
    );
  }

  createShift(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/shifts`,
      payload
    );
  }

  updateShift(
    id: string,
    payload: any
  ): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/shifts/${id}`,
      payload
    );
  }

  deleteShift(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/shifts/${id}`
    );
  }

  // =========================
  // SHIFT ASSIGNMENTS
  // =========================
  // These match the backend correctly as-is: list_shift_assignments_endpoint
  // accepts worker_id / project_id as real query params.

  getShiftAssignments(params?: {
    workerId?: string;
    projectId?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();

    if (params?.workerId) {
      httpParams = httpParams.set(
        'worker_id',
        params.workerId
      );
    }

    if (params?.projectId) {
      httpParams = httpParams.set(
        'project_id',
        params.projectId
      );
    }

    return this.http.get<any>(
      `${this.baseUrl}/shift-assignments`,
      { params: httpParams }
    );
  }

  createShiftAssignment(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/shift-assignments`,
      payload
    );
  }

  deleteShiftAssignment(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/shift-assignments/${id}`
    );
  }

  // =========================
  // PAYROLL
  // =========================
  // Matches backend as-is: list_payroll_endpoint accepts project_id/worker_id
  // as real query params.

  getPayroll(params?: {
    workerId?: string;
    projectId?: string;
  }): Observable<any> {
    let httpParams = new HttpParams();

    if (params?.workerId) {
      httpParams = httpParams.set(
        'worker_id',
        params.workerId
      );
    }

    if (params?.projectId) {
      httpParams = httpParams.set(
        'project_id',
        params.projectId
      );
    }

    return this.http.get<any>(
      `${this.baseUrl}/payroll`,
      { params: httpParams }
    );
  }

  createPayroll(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.baseUrl}/payroll`,
      payload
    );
  }

  updatePayroll(
    id: string,
    payload: any
  ): Observable<any> {
    return this.http.put<any>(
      `${this.baseUrl}/payroll/${id}`,
      payload
    );
  }

  deletePayroll(id: string): Observable<any> {
    return this.http.delete<any>(
      `${this.baseUrl}/payroll/${id}`
    );
  }

  // =========================
  // DASHBOARD
  // =========================

  getDashboardSummary(
    projectId?: string
  ): Observable<any> {
    let params = new HttpParams();

    if (projectId) {
      params = params.set(
        'project_id',
        projectId
      );
    }

    return this.http.get<any>(
      `${this.baseUrl}/dashboard/summary`,
      { params }
    );
  }

  // =========================
  // FRONTEND -> BACKEND
  // =========================

  private toBackendWorker(worker: any): any {
    return {
      first_name:
        worker.firstName?.trim() || '',

      last_name:
        worker.lastName?.trim() || '',

      email:
        worker.email?.trim() || '',

      phone:
        worker.phone?.trim() || '',

      category:
        worker.category || 'SKILLED_WORKER',

      skill_type:
        worker.skillType?.trim() || '',

      designation:
        worker.designation?.trim() || '',

      experience_years:
        Number(worker.experienceYears || 0),

      employment_type:
        worker.employmentType || 'FULL_TIME',

      joining_date:
        worker.joiningDate
          ? new Date(
              worker.joiningDate
            ).toISOString()
          : new Date().toISOString(),

      salary_type:
        worker.salaryType || 'MONTHLY',

      hourly_rate:
        Number(worker.hourlyRate || 0),

      salary_amount:
        Number(worker.salaryAmount || 0),

      project_id:
        worker.projectId || '',

      status:
        worker.status || 'available'
    };
  }
}
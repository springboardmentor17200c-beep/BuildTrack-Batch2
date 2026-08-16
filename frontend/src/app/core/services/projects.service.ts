import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ProjectsService {
  private readonly http = inject(HttpClient);

  // environment.apiBaseUrl = /api/v1
  private readonly baseUrl = `${environment.apiBaseUrl}/projects`;

  getProjects(params?: { skip?: number; limit?: number }): Observable<any> {
    let httpParams = new HttpParams();

    if (params?.skip !== undefined) {
      httpParams = httpParams.set('skip', params.skip);
    }
    if (params?.limit !== undefined) {
      httpParams = httpParams.set('limit', params.limit);
    }

    return this.http.get<any>(`${this.baseUrl}/`, { params: httpParams });
  }

  getProject(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  getProjectsByManager(managerId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/manager/${managerId}`);
  }
}
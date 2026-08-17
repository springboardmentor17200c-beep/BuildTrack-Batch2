import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/tasks`;

  getTasksForProject(projectId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/project/${projectId}`);
  }

  getTasksForWorker(workerId: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/worker/${workerId}`);
  }

  getTask(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  createTask(payload: any): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/`, payload);
  }

  updateTask(id: string, payload: any): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, payload);
  }

  deleteTask(id: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`);
  }
}

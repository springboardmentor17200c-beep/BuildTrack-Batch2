import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {

  private apiUrl = `${environment.apiBaseUrl}/notifications`;

  constructor(private http: HttpClient) {}

  getNotifications(): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/all`);
  }

  getUnreadNotifications(): Observable<any> {
    return this.http.get(`${this.apiUrl}/user/unread`);
  }

  createNotification(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/`, data);
  }

  markAsRead(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/read`, {});
  }

  markAllAsRead(): Observable<any> {
    return this.http.post(`${this.apiUrl}/user/read-all`, {});
  }

  deleteNotification(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {

  private apiUrl = 'http://127.0.0.1:8000/api/v1/notifications';

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
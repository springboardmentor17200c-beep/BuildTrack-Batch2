import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, tap, delay, switchMap, map } from 'rxjs';
import { User, UserRole, UserStatus } from '../models/models';
import { environment } from '../../../environments/environment';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface SocialLoginPayload {
  provider: 'google' | 'microsoft';
  email: string;
  fullName: string;
  role: UserRole;
}

interface BackendUser {
  _id?: string;
  id?: string;
  email: string;
  full_name: string;
  role: string;
  status?: string;
}

interface BackendLoginResponse {
  access_token: string;
  token_type: string;
  user: BackendUser;
}

interface BackendRegisterResponse {
  message: string;
  user: BackendUser;
}

const TOKEN_KEY = 'buildtrack_token';
const USER_KEY = 'buildtrack_user';

/** Handles BuildTrack FastAPI auth and keeps the app's user shape stable. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiBase = environment.apiBaseUrl;
  private readonly useMockApi = false;

  currentUser = signal<User | null>(this.readStoredUser());

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  login(payload: LoginPayload): Observable<{ token: string; user: User }> {
    if (this.useMockApi) {
      const mockUser: User = {
        id: 'u1',
        name: 'Subhash Nath',
        email: payload.email,
        role: 'Worker',
      };
      return of({ token: 'mock-jwt-token', user: mockUser }).pipe(
        delay(600),
        tap((res) => this.persistSession(res.token, res.user)),
      );
    }
    return this.http
      .post<BackendLoginResponse>(`${this.apiBase}/auth/login`, {
        email: payload.email,
        password: payload.password,
      })
      .pipe(
        map((res) => ({
          token: res.access_token,
          user: this.toFrontendUser(res.user),
        })),
        tap((res) => this.persistSession(res.token, res.user)),
      );
  }

  register(payload: RegisterPayload): Observable<{ token: string; user: User }> {
    if (this.useMockApi) {
      const mockUser: User = {
        id: 'u2',
        name: payload.fullName,
        email: payload.email,
        role: 'Project Manager',
        avatarUrl: 'https://i.pravatar.cc/64?img=32',
      };
      return of({ token: 'mock-jwt-token', user: mockUser }).pipe(
        delay(600),
        tap((res) => this.persistSession(res.token, res.user)),
      );
    }
    return this.http
      .post<BackendRegisterResponse>(`${this.apiBase}/auth/register`, {
        full_name: payload.fullName,
        email: payload.email,
        password: payload.password,
        role: this.toBackendRole(payload.role),
        status: 'active',
      })
      .pipe(switchMap(() => this.login({ email: payload.email, password: payload.password })));
  }

  socialLogin(payload: SocialLoginPayload): Observable<{ token: string; user: User }> {
    return this.http
      .post<BackendLoginResponse>(`${this.apiBase}/auth/social-login`, {
        provider: payload.provider,
        email: payload.email,
        full_name: payload.fullName,
        role: this.toBackendRole(payload.role),
        status: 'active',
      })
      .pipe(
        map((res) => ({
          token: res.access_token,
          user: this.toFrontendUser(res.user),
        })),
        tap((res) => this.persistSession(res.token, res.user)),
      );
  }

  requestPasswordReset(email: string): Observable<{ message: string }> {
    if (this.useMockApi) {
      return of({ message: 'Reset link sent' }).pipe(delay(600));
    }
    // The current backend does not expose password reset yet.
    return of({ message: `Reset flow is not enabled yet for ${email}.` }).pipe(delay(300));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  /** True if the logged-in user's role is in the given list. */
  hasRole(roles: UserRole[]): boolean {
    const role = this.currentUser()?.role;
    return !!role && roles.includes(role);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private persistSession(token: string, user: User): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private toFrontendUser(user: BackendUser): User {
    return {
      id: user.id ?? user._id ?? user.email,
      name: user.full_name,
      email: user.email,
      role: this.toFrontendRole(user.role),
      status: this.toFrontendStatus(user.status),
    };
  }

  private toFrontendRole(role: string): UserRole {
    const normalized = role.toLowerCase().replace(/[_-]/g, ' ');
    const roleMap: Record<string, UserRole> = {
      admin: 'Administrator',
      administrator: 'Administrator',
      manager: 'Project Manager',
      'project manager': 'Project Manager',
      engineer: 'Site Engineer',
      'site engineer': 'Site Engineer',
      contractor: 'Contractor',
      worker: 'Worker',
      client: 'Client',
    };

    return roleMap[normalized] ?? 'Worker';
  }

  private toBackendRole(role: UserRole): string {
    const roleMap: Record<UserRole, string> = {
      Administrator: 'admin',
      'Project Manager': 'manager',
      'Site Engineer': 'engineer',
      Contractor: 'contractor',
      Worker: 'worker',
      Client: 'client',
    };

    return roleMap[role];
  }

  private toFrontendStatus(status?: string): UserStatus {
    const normalized = status?.toLowerCase();

    if (normalized === 'suspended') {
      return 'Suspended';
    }

    if (normalized === 'pending') {
      return 'Pending';
    }

    return 'Active';
  }

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }
}

import { Injectable, computed, signal } from "@angular/core";
import { Router } from "@angular/router";

import {
  AuthSession,
  LoginRequest,
  ProfileUpdateRequest,
  RegisterRequest,
  User,
  UserRole
} from "../models/auth.models";

const SESSION_KEY = "buildtrack.session";
const USERS_KEY = "buildtrack.users";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly sessionSignal = signal<AuthSession | null>(this.loadSession());

  readonly session = this.sessionSignal.asReadonly();
  readonly currentUser = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()?.accessToken));

  constructor(private readonly router: Router) {
    this.seedAdministrator();
  }

  get token(): string | null {
    return this.sessionSignal()?.accessToken ?? null;
  }

  login(request: LoginRequest): Promise<AuthSession> {
    const users = this.loadUsers();
    const user = users.find((item) => item.email.toLowerCase() === request.email.toLowerCase());

    if (!user || request.password.length < 6) {
      return Promise.reject(new Error("Use a registered email and a password with at least 6 characters."));
    }

    return Promise.resolve(this.startSession(user));
  }

  register(request: RegisterRequest): Promise<AuthSession> {
    const users = this.loadUsers();
    const exists = users.some((item) => item.email.toLowerCase() === request.email.toLowerCase());

    if (exists) {
      return Promise.reject(new Error("An account already exists for this email."));
    }

    const user: User = {
      id: crypto.randomUUID(),
      fullName: request.fullName,
      email: request.email,
      company: request.company,
      role: request.role,
      status: request.role === UserRole.Client ? "Pending" : "Active"
    };

    localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
    return Promise.resolve(this.startSession(user));
  }

  requestPasswordReset(email: string): Promise<void> {
    const users = this.loadUsers();
    const exists = users.some((item) => item.email.toLowerCase() === email.toLowerCase());

    if (!exists) {
      return Promise.reject(new Error("No BuildTrack account was found for this email."));
    }

    return Promise.resolve();
  }

  updateProfile(request: ProfileUpdateRequest): Promise<User> {
    const session = this.sessionSignal();

    if (!session) {
      return Promise.reject(new Error("Please sign in again to update your profile."));
    }

    const updatedUser: User = {
      ...session.user,
      ...request
    };
    const users = this.loadUsers().map((user) => (user.id === updatedUser.id ? updatedUser : user));

    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    this.persistSession({ ...session, user: updatedUser });
    return Promise.resolve(updatedUser);
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
    this.sessionSignal.set(null);
    this.router.navigateByUrl("/login");
  }

  private startSession(user: User): AuthSession {
    const session: AuthSession = {
      accessToken: this.createMockJwt(user),
      user
    };

    this.persistSession(session);
    return session;
  }

  private persistSession(session: AuthSession): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    this.sessionSignal.set(session);
  }

  private loadSession(): AuthSession | null {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  }

  private loadUsers(): User[] {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as User[]) : [];
  }

  private seedAdministrator(): void {
    const users = this.loadUsers();

    if (users.length > 0) {
      return;
    }

    const admin: User = {
      id: "admin-seed",
      fullName: "BuildTrack Administrator",
      email: "admin@buildtrack.local",
      company: "BuildTrack",
      role: UserRole.Administrator,
      status: "Active"
    };

    localStorage.setItem(USERS_KEY, JSON.stringify([admin]));
  }

  private createMockJwt(user: User): string {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payload = btoa(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 60 * 60
      })
    );

    return `${header}.${payload}.local-signature`;
  }
}

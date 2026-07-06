export enum UserRole {
  Administrator = "Administrator",
  ProjectManager = "Project Manager",
  SiteEngineer = "Site Engineer",
  Contractor = "Contractor",
  Worker = "Worker",
  Client = "Client"
}

export const USER_ROLES = Object.values(UserRole);

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  company?: string;
  role: UserRole;
  status: "Active" | "Pending" | "Suspended";
}

export interface AuthSession {
  accessToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  fullName: string;
  role: UserRole;
  company?: string;
}

export interface ProfileUpdateRequest {
  fullName: string;
  phone?: string;
  company?: string;
}

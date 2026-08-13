import { UserRole } from './enums';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CurrentUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
}

// Auto-generated TypeScript types from JetApi schemas
// Do not edit manually - regenerate with: python scripts/generate_types.py --typescript
// Generated at: 2026-04-16T16:27:50.227911

export interface UserBase {
  firstName: string;
  lastName: string;
  email: string;
}

export interface UserCreate {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface UserUpdate {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  is_active?: boolean | null;
  is_verified?: boolean | null;
}

export interface UserUpdateProfile {
  firstName?: string | null;
  lastName?: string | null;
}

export interface RoleOut {
  id: number;
  name: string;
  description?: string | null;
}

export interface UserOut {
  firstName: string;
  lastName: string;
  email: string;
  id: string;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login?: string | null;
}

export interface UserWithRoles {
  firstName: string;
  lastName: string;
  email: string;
  id: string;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login?: string | null;
  roles?: RoleOut[];
}

export interface UserDetail {
  firstName: string;
  lastName: string;
  email: string;
  id: string;
  is_active?: boolean;
  is_verified?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
  last_login?: string | null;
  roles?: RoleOut[];
  external_provider?: string | null;
}

export interface UserList {
  items: UserOut[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AssignRoleRequest {
  role_id: number;
}

export interface AssignRolesRequest {
  role_ids: number[];
}

export interface UserRolesResponse {
  user_id: string;
  roles: RoleOut[];
  message?: string;
}

export interface Token {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string;
  expires_in: number;
}

export interface TokenPayload {
  sub: string;
  exp: number;
  iat: number;
  jti: string;
  roles?: string[];
  perms?: string[];
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: UserOut;
  tokens: Token;
  message?: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  password_confirm: string;
}

export interface RegisterResponse {
  user: UserOut;
  tokens?: Token | null;
  message?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message?: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  password_confirm: string;
}

export interface ResetPasswordResponse {
  message?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

export interface ChangePasswordResponse {
  message?: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  message?: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  message?: string;
}

export interface CurrentUserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  permissions: string[];
  created_at: string;
  last_login?: string | null;
}

// API Response wrapper types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  detail: string;
  status_code: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}
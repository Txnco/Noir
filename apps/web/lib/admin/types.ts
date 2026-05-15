// Types for the platform super-admin dashboard.
// Mirror of apps/backend/app/schemas/admin.py.

export type PlatformRole = "super_admin" | "support" | "finance_admin" | "user";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminMetrics {
  users: number;
  super_admins: number;
  organizations: number;
  organizations_unverified: number;
  venues: number;
  events: number;
  events_published: number;
  occurrences: number;
}

export interface AdminMembership {
  org_id: string;
  org_name: string | null;
  role: string;
  is_active: boolean;
}

export interface AdminUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  city: string | null;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  platform_role: PlatformRole;
  is_ghost: boolean;
  created_at: string;
}

export interface AdminUserDetail extends AdminUser {
  memberships: AdminMembership[];
  last_login: string | null;
}

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  contact_email: string | null;
  can_organize: boolean;
  can_own_venues: boolean;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface AdminOrgMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_active: boolean;
}

export interface AdminVenue {
  id: string;
  org_id: string;
  org_name: string | null;
  name: string;
  slug: string;
  city: string;
  venue_type: string;
  visibility: string;
  total_capacity: number | null;
  is_active: boolean;
}

export interface AdminOrganizationDetail extends AdminOrganization {
  description: string | null;
  website: string | null;
  contact_phone: string | null;
  address: string | null;
  members: AdminOrgMember[];
  venues: AdminVenue[];
}

export interface AdminEvent {
  id: string;
  name: string;
  slug: string;
  status: string;
  is_free: boolean;
  organizer_org_id: string;
  organizer_org_name: string | null;
  occurrence_count: number;
  created_at: string;
}

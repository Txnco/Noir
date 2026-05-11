// Auto-generated TypeScript types from JetApi schemas
// Do not edit manually - regenerate with: python scripts/generate_types.py --typescript
// Generated at: 2026-05-11T12:08:44.622890

export interface ProfileUpdate {
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface ProfileOut {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  city?: string | null;
  phone?: string | null;
  claimed_at?: string | null;
  created_at: string;
}

export interface ProfileList {
  items: ProfileOut[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OrgMembershipOut {
  org_id: string;
  role: string;
  is_active: boolean;
}

export interface CurrentUserResponse {
  id: string;
  email?: string | null;
  email_verified: boolean;
  profile: ProfileOut;
  platform_role: string;
  memberships?: OrgMembershipOut[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserShort {
  id: string;
  email: string;
}

export interface Viewer {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in: number;
  refresh_token: string;
  user: UserShort;
}

export interface EventBase {
  name: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  min_age?: number;
  is_free?: boolean;
  status?: string;
}

export interface VenueBase {
  name: string;
  slug: string;
  city: string;
  address: string;
  venue_type: string;
  country?: string;
}

export interface OrganizationBase {
  name: string;
  slug: string;
  description?: string | null;
  contact_email?: string | null;
  website?: string | null;
}

export interface OrganizationCreate {
  name: string;
  slug: string;
  description?: string | null;
  contact_email?: string | null;
  website?: string | null;
}

export interface OrganizationUpdate {
  name?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
}

export interface VenueCreate {
  name: string;
  slug: string;
  city: string;
  address: string;
  venue_type: string;
  country?: string;
  org_id: string;
  description?: string | null;
  lat?: number | null;
  lng?: number | null;
  total_capacity?: number | null;
}

export interface VenueUpdate {
  name?: string | null;
  description?: string | null;
  address?: string | null;
  city?: string | null;
  total_capacity?: number | null;
  is_active?: boolean | null;
}

export interface EventCreate {
  name: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  min_age?: number;
  is_free?: boolean;
  status?: string;
  organizer_org_id: string;
}

export interface EventUpdate {
  name?: string | null;
  description?: string | null;
  cover_image_url?: string | null;
  min_age?: number | null;
  is_free?: boolean | null;
  status?: string | null;
}

export interface OrganizationOut {
  name: string;
  slug: string;
  description?: string | null;
  contact_email?: string | null;
  website?: string | null;
  id: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export interface VenueOut {
  name: string;
  slug: string;
  city: string;
  address: string;
  venue_type: string;
  country?: string;
  id: string;
  org_id: string;
  total_capacity?: number | null;
  photos?: string[];
  is_active: boolean;
}

export interface EventDiscoveryOut {
  name: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  min_age?: number;
  is_free?: boolean;
  status?: string;
  id: string;
  venue_name?: string | null;
  min_price?: number | null;
  occurrence_date?: string | null;
  tags?: string[];
  created_at: string;
}

export interface EventDetailOut {
  name: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  min_age?: number;
  is_free?: boolean;
  status?: string;
  id: string;
  venue_name?: string | null;
  min_price?: number | null;
  occurrence_date?: string | null;
  tags?: string[];
  created_at: string;
  organizer_org_id: string;
  updated_at: string;
}

export interface OrganizationDetail {
  name: string;
  slug: string;
  description?: string | null;
  contact_email?: string | null;
  website?: string | null;
  id: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  venues?: VenueOut[];
}

export interface EventOccurrenceOut {
  id: string;
  occurrence_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  sold_count: number;
  total_capacity: number;
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
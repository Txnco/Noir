import type { VenueBuilderJSON } from '../../types/venueBuilder';

export async function saveVenueJSON(
  venue_id: string,
  version: number,
  json: VenueBuilderJSON
): Promise<{ success: boolean; path: string }> {
  const res = await fetch('/api/venue-builder/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ venue_id, version, json }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Save failed');
  }
  return res.json();
}

export async function listSavedVenues(): Promise<string[]> {
  const res = await fetch('/api/venue-builder/list');
  if (!res.ok) return [];
  const data = await res.json();
  return data.venues ?? [];
}

export async function loadVenueJSON(
  venue_id: string,
  version?: number
): Promise<VenueBuilderJSON | null> {
  const params = new URLSearchParams({ venue_id });
  if (version !== undefined) params.set('version', String(version));
  const res = await fetch(`/api/venue-builder/load?${params}`);
  if (!res.ok) return null;
  return res.json();
}

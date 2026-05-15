import { BACKEND_API_URL } from "@/lib/auth/config";
import type { EventDiscoveryOut } from "@/lib/typescript/api-types";
import EventiPageClient from "./_components/EventiPageClient";

export default async function EventiPage() {
  let events: EventDiscoveryOut[] = [];
  try {
    const res = await fetch(`${BACKEND_API_URL}/noir/events`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      events = await res.json();
    }
  } catch {
    // fall through — EventiPageClient handles empty array gracefully
  }

  return <EventiPageClient events={events} />;
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { fetchTags } from "@/lib/auth/onboarding";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/prijava");
  if (user.profile.onboarding_completed) redirect("/eventi");

  const [genres, eventTypes] = await Promise.all([
    fetchTags("genre"),
    fetchTags("event_type"),
  ]);

  return (
    <OnboardingWizard
      firstName={user.profile.first_name ?? null}
      genres={genres.items}
      eventTypes={eventTypes.items}
    />
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import ProfileEditor from "./ProfileEditor";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/prijava");
  if (!user.profile.onboarding_completed) redirect("/onboarding");

  return (
    <ProfileEditor
      email={user.email ?? ""}
      profile={user.profile}
      platformRole={user.platform_role}
      memberships={user.memberships ?? []}
    />
  );
}

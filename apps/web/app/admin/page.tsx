import {
  Users,
  Building2,
  MapPin,
  CalendarDays,
  ShieldCheck,
  CalendarCheck,
  Clock3,
  BadgeCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { adminApi, AdminApiError } from "@/lib/admin/api";
import type { AdminMetrics } from "@/lib/admin/types";
import { AdminError, PageHeading } from "@/components/admin/StateViews";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-display mt-1 text-3xl font-semibold tabular-nums">
            {value.toLocaleString("hr-HR")}
          </p>
          {hint && (
            <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
          )}
        </div>
        <span className="bg-accent text-accent-foreground flex size-9 shrink-0 items-center justify-center rounded-md">
          <Icon className="size-4.5" />
        </span>
      </CardContent>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  let metrics: AdminMetrics | null = null;
  let error: string | null = null;

  try {
    metrics = await adminApi.get<AdminMetrics>("/admin/metrics");
  } catch (e) {
    error =
      e instanceof AdminApiError
        ? e.message
        : "Nije moguće dohvatiti podatke.";
  }

  return (
    <div>
      <PageHeading
        title="Pregled platforme"
        description="Stanje cijele Noir platforme na jednom mjestu."
      />

      {error && <AdminError message={error} />}

      {metrics && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Korisnici"
            value={metrics.users}
            hint={`${metrics.super_admins} super administratora`}
            icon={Users}
          />
          <StatCard
            label="Organizacije"
            value={metrics.organizations}
            hint={`${metrics.organizations_unverified} čeka verifikaciju`}
            icon={Building2}
          />
          <StatCard label="Prostori" value={metrics.venues} icon={MapPin} />
          <StatCard
            label="Eventi"
            value={metrics.events}
            hint={`${metrics.events_published} objavljeno`}
            icon={CalendarDays}
          />
          <StatCard
            label="Objavljeni eventi"
            value={metrics.events_published}
            icon={BadgeCheck}
          />
          <StatCard
            label="Izvedbe"
            value={metrics.occurrences}
            icon={CalendarCheck}
          />
          <StatCard
            label="Neverificirane org."
            value={metrics.organizations_unverified}
            icon={Clock3}
          />
          <StatCard
            label="Super administratori"
            value={metrics.super_admins}
            icon={ShieldCheck}
          />
        </div>
      )}
    </div>
  );
}

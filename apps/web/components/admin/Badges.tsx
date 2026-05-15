import { Badge } from "@/components/ui/badge";

const PLATFORM_ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  support: "Podrška",
  finance_admin: "Financije",
  user: "Korisnik",
};

const EVENT_STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Skica", variant: "outline" },
  pending_venue: { label: "Čeka prostor", variant: "secondary" },
  venue_confirmed: { label: "Prostor potvrđen", variant: "secondary" },
  published: { label: "Objavljen", variant: "default" },
  cancelled: { label: "Otkazan", variant: "destructive" },
  completed: { label: "Završen", variant: "outline" },
};

export function PlatformRoleBadge({ role }: { role: string }) {
  const isAdmin = role === "super_admin";
  return (
    <Badge variant={isAdmin ? "default" : "secondary"}>
      {PLATFORM_ROLE_LABEL[role] ?? role}
    </Badge>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const cfg = EVENT_STATUS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return (
    <Badge variant={verified ? "default" : "outline"}>
      {verified ? "Verificirana" : "Neverificirana"}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "destructive"}>
      {active ? "Aktivna" : "Neaktivna"}
    </Badge>
  );
}

export function YesNoBadge({ value }: { value: boolean }) {
  return (
    <Badge variant={value ? "secondary" : "outline"}>
      {value ? "Da" : "Ne"}
    </Badge>
  );
}

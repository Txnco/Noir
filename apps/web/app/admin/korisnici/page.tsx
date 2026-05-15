import { adminApi, AdminApiError } from "@/lib/admin/api";
import type { AdminUser, Page } from "@/lib/admin/types";
import { AdminError, AdminEmpty, PageHeading } from "@/components/admin/StateViews";
import { PlatformRoleBadge } from "@/components/admin/Badges";
import SearchInput from "@/components/admin/SearchInput";
import SelectFilter from "@/components/admin/SelectFilter";
import Pagination from "@/components/admin/Pagination";
import UserRoleMenu from "@/components/admin/UserRoleMenu";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super admin" },
  { value: "support", label: "Podrška" },
  { value: "finance_admin", label: "Financije" },
  { value: "user", label: "Korisnik" },
];

function fullName(u: AdminUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || "Bez imena";
}

function initials(u: AdminUser): string {
  const s = `${u.first_name?.[0] ?? ""}${u.last_name?.[0] ?? ""}`.trim();
  return (s || u.email?.[0] || "?").toUpperCase();
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; role?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  let data: Page<AdminUser> | null = null;
  let error: string | null = null;

  try {
    const query = adminApi.qs({
      page,
      page_size: 20,
      search: sp.search,
      role: sp.role,
    });
    data = await adminApi.get<Page<AdminUser>>(`/admin/users${query}`);
  } catch (e) {
    error =
      e instanceof AdminApiError ? e.message : "Nije moguće dohvatiti korisnike.";
  }

  return (
    <div>
      <PageHeading
        title="Korisnici"
        description="Svi registrirani korisnici platforme i njihove uloge."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Ime, email ili grad…" />
        <SelectFilter
          param="role"
          placeholder="Sve uloge"
          options={ROLE_OPTIONS}
        />
      </div>

      {error && <AdminError message={error} />}

      {data && (
        <>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Korisnik</TableHead>
                  <TableHead>Grad</TableHead>
                  <TableHead>Uloga</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Registriran</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <AdminEmpty message="Nema korisnika za zadane filtere." />
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                          {initials(u)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{fullName(u)}</p>
                          <p className="text-muted-foreground truncate text-xs">
                            {u.email ?? "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{u.city ?? "—"}</TableCell>
                    <TableCell>
                      <PlatformRoleBadge role={u.platform_role} />
                    </TableCell>
                    <TableCell>
                      {u.is_ghost ? (
                        <Badge variant="outline">Ghost</Badge>
                      ) : u.onboarding_completed ? (
                        <Badge variant="secondary">Aktivan</Badge>
                      ) : (
                        <Badge variant="outline">Bez onboardinga</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {new Date(u.created_at).toLocaleDateString("hr-HR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <UserRoleMenu
                        userId={u.id}
                        current={u.platform_role}
                        userLabel={fullName(u)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
          />
        </>
      )}
    </div>
  );
}

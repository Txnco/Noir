import { adminApi, AdminApiError } from "@/lib/admin/api";
import type { AdminOrganization, Page } from "@/lib/admin/types";
import { AdminError, AdminEmpty, PageHeading } from "@/components/admin/StateViews";
import { VerifiedBadge, ActiveBadge } from "@/components/admin/Badges";
import SearchInput from "@/components/admin/SearchInput";
import SelectFilter from "@/components/admin/SelectFilter";
import Pagination from "@/components/admin/Pagination";
import OrgActionsMenu from "@/components/admin/OrgActionsMenu";
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

const VERIFIED_OPTIONS = [
  { value: "true", label: "Verificirane" },
  { value: "false", label: "Neverificirane" },
];

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; verified?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  let data: Page<AdminOrganization> | null = null;
  let error: string | null = null;

  try {
    const query = adminApi.qs({
      page,
      page_size: 20,
      search: sp.search,
      verified: sp.verified,
    });
    data = await adminApi.get<Page<AdminOrganization>>(
      `/admin/organizations${query}`,
    );
  } catch (e) {
    error =
      e instanceof AdminApiError
        ? e.message
        : "Nije moguće dohvatiti organizacije.";
  }

  return (
    <div>
      <PageHeading
        title="Organizacije"
        description="Organizatori i vlasnici prostora — verifikacija i status."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Naziv, slug ili grad…" />
        <SelectFilter
          param="verified"
          placeholder="Sve organizacije"
          options={VERIFIED_OPTIONS}
        />
      </div>

      {error && <AdminError message={error} />}

      {data && (
        <>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organizacija</TableHead>
                  <TableHead>Grad</TableHead>
                  <TableHead>Sposobnosti</TableHead>
                  <TableHead>Verifikacija</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcije</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <AdminEmpty message="Nema organizacija za zadane filtere." />
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <p className="font-medium">{o.name}</p>
                      <p className="text-muted-foreground text-xs">/{o.slug}</p>
                    </TableCell>
                    <TableCell>{o.city ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {o.can_organize && (
                          <Badge variant="outline">Organizira</Badge>
                        )}
                        {o.can_own_venues && (
                          <Badge variant="outline">Prostori</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <VerifiedBadge verified={o.is_verified} />
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={o.is_active} />
                    </TableCell>
                    <TableCell className="text-right">
                      <OrgActionsMenu
                        orgId={o.id}
                        orgName={o.name}
                        isVerified={o.is_verified}
                        isActive={o.is_active}
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

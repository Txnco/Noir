import { adminApi, AdminApiError } from "@/lib/admin/api";
import type { AdminVenue, Page } from "@/lib/admin/types";
import { AdminError, AdminEmpty, PageHeading } from "@/components/admin/StateViews";
import { ActiveBadge } from "@/components/admin/Badges";
import SearchInput from "@/components/admin/SearchInput";
import Pagination from "@/components/admin/Pagination";
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

const VENUE_TYPE: Record<string, string> = {
  club: "Klub",
  bar: "Bar",
  concert_hall: "Koncertna dvorana",
  outdoor: "Otvoreni prostor",
  sports_arena: "Sportska arena",
  theater: "Kazalište",
  restaurant: "Restoran",
  rooftop: "Rooftop",
  other: "Ostalo",
};

const VISIBILITY: Record<string, string> = {
  public: "Javno",
  private: "Privatno",
  unlisted: "Neizlistano",
};

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  let data: Page<AdminVenue> | null = null;
  let error: string | null = null;

  try {
    const query = adminApi.qs({ page, page_size: 20, search: sp.search });
    data = await adminApi.get<Page<AdminVenue>>(`/admin/venues${query}`);
  } catch (e) {
    error =
      e instanceof AdminApiError ? e.message : "Nije moguće dohvatiti prostore.";
  }

  return (
    <div>
      <PageHeading
        title="Prostori"
        description="Svi prostori na platformi i njihovi vlasnici."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Naziv prostora ili grad…" />
      </div>

      {error && <AdminError message={error} />}

      {data && (
        <>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prostor</TableHead>
                  <TableHead>Organizacija</TableHead>
                  <TableHead>Grad</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Vidljivost</TableHead>
                  <TableHead className="text-right">Kapacitet</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <AdminEmpty message="Nema prostora za zadane filtere." />
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <p className="font-medium">{v.name}</p>
                      <p className="text-muted-foreground text-xs">/{v.slug}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {v.org_name ?? "—"}
                    </TableCell>
                    <TableCell>{v.city}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {VENUE_TYPE[v.venue_type] ?? v.venue_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {VISIBILITY[v.visibility] ?? v.visibility}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {v.total_capacity?.toLocaleString("hr-HR") ?? "—"}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={v.is_active} />
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

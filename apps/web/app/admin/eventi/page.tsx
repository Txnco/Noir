import { adminApi, AdminApiError } from "@/lib/admin/api";
import type { AdminEvent, Page } from "@/lib/admin/types";
import { AdminError, AdminEmpty, PageHeading } from "@/components/admin/StateViews";
import { EventStatusBadge } from "@/components/admin/Badges";
import SearchInput from "@/components/admin/SearchInput";
import SelectFilter from "@/components/admin/SelectFilter";
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

const STATUS_OPTIONS = [
  { value: "draft", label: "Skica" },
  { value: "pending_venue", label: "Čeka prostor" },
  { value: "venue_confirmed", label: "Prostor potvrđen" },
  { value: "published", label: "Objavljen" },
  { value: "cancelled", label: "Otkazan" },
  { value: "completed", label: "Završen" },
];

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  let data: Page<AdminEvent> | null = null;
  let error: string | null = null;

  try {
    const query = adminApi.qs({
      page,
      page_size: 20,
      search: sp.search,
      status: sp.status,
    });
    data = await adminApi.get<Page<AdminEvent>>(`/admin/events${query}`);
  } catch (e) {
    error =
      e instanceof AdminApiError ? e.message : "Nije moguće dohvatiti evente.";
  }

  return (
    <div>
      <PageHeading
        title="Eventi"
        description="Svi eventi na platformi, kroz sve organizacije i statuse."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Naziv eventa…" />
        <SelectFilter
          param="status"
          placeholder="Svi statusi"
          options={STATUS_OPTIONS}
        />
      </div>

      {error && <AdminError message={error} />}

      {data && (
        <>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Organizator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Naplata</TableHead>
                  <TableHead className="text-right">Izvedbe</TableHead>
                  <TableHead>Kreiran</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <AdminEmpty message="Nema eventa za zadane filtere." />
                    </TableCell>
                  </TableRow>
                )}
                {data.items.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-muted-foreground text-xs">/{e.slug}</p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.organizer_org_name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <EventStatusBadge status={e.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={e.is_free ? "outline" : "secondary"}>
                        {e.is_free ? "Besplatan" : "Naplata"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.occurrence_count}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {new Date(e.created_at).toLocaleDateString("hr-HR")}
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

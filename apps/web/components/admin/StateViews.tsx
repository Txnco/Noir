import type { ReactNode } from "react";
import { AlertTriangle, Inbox } from "lucide-react";

/** Full-width error panel for failed admin data loads. */
export function AdminError({ message }: { message: string }) {
  return (
    <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-3 rounded-lg border p-4 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">Greška pri učitavanju</p>
        <p className="text-destructive/80 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

/** Empty-state row for tables with no results. */
export function AdminEmpty({
  message = "Nema rezultata.",
  children,
}: {
  message?: string;
  children?: ReactNode;
}) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-14 text-center text-sm">
      <Inbox className="size-7 opacity-50" />
      <p>{message}</p>
      {children}
    </div>
  );
}

/** Section heading + optional description for admin pages. */
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

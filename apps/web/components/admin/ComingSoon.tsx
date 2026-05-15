import { Hammer } from "lucide-react";

import { PageHeading } from "@/components/admin/StateViews";
import { Card, CardContent } from "@/components/ui/card";

export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <PageHeading title={title} />
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="bg-accent text-accent-foreground flex size-12 items-center justify-center rounded-full">
            <Hammer className="size-5" />
          </span>
          <p className="font-display text-lg font-semibold">Uskoro dostupno</p>
          <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
        </CardContent>
      </Card>
    </div>
  );
}

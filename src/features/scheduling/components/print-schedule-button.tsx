"use client";

import { Button } from "@/components/ui/button";

export function PrintScheduleButton({
  label,
}: {
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => window.print()}
    >
      {label}
    </Button>
  );
}

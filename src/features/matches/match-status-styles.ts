/** Soft row background for public/admin match tables by status. */
export function matchStatusRowClass(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "border-amber-100 bg-amber-50 hover:bg-amber-100/70";
    case "COMPLETED":
      return "border-emerald-100/80 bg-emerald-50/70 hover:bg-emerald-50";
    case "WALKOVER":
      return "border-teal-100/80 bg-teal-50/70 hover:bg-teal-50";
    case "CANCELLED":
      return "border-rose-100 bg-rose-50/80 hover:bg-rose-50";
    case "SCHEDULED":
      return "border-sky-100/80 bg-sky-50/50 hover:bg-sky-50";
    case "PENDING":
      return "bg-slate-50/40 hover:bg-slate-50/80";
    default:
      return "";
  }
}

/** Emphasize status label text color to match the row tint. */
export function matchStatusTextClass(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "font-medium text-amber-800";
    case "COMPLETED":
      return "font-medium text-emerald-800";
    case "WALKOVER":
      return "font-medium text-teal-800";
    case "CANCELLED":
      return "font-medium text-rose-700";
    case "SCHEDULED":
      return "font-medium text-sky-800";
    case "PENDING":
      return "text-slate-600";
    default:
      return "";
  }
}

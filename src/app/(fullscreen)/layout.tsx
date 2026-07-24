import { requireAuthOrRedirect } from "@/lib/auth/require-auth";

/** Full-bleed ops surfaces (TV live board) without admin chrome. */
export default async function FullscreenOpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuthOrRedirect("/login");
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">{children}</div>
  );
}

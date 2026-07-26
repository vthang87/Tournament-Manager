import { notFound } from "next/navigation";
import { TournamentAccessService } from "@/application/services";
import { getDb } from "@/db/client";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tournamentId: string }>;
}) {
  const user = await requireAuthOrRedirect();
  const { tournamentId } = await params;
  try {
    await new TournamentAccessService(getDb()).resolve(
      { userId: user.id, role: user.role },
      tournamentId,
    );
  } catch {
    notFound();
  }
  return children;
}

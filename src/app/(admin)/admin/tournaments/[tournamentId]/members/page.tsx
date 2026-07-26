import { notFound } from "next/navigation";
import { ActionForm } from "@/components/shared/action-form";
import { AdminBreadcrumbs } from "@/components/shared/admin-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  TournamentMemberService,
  TournamentService,
} from "@/application/services";
import { getDb } from "@/db/client";
import {
  addTournamentMemberAction,
  removeTournamentMemberAction,
  updateTournamentMemberAction,
} from "@/features/tournament-members/actions";
import { requireAuthOrRedirect } from "@/lib/auth/require-auth";

const ROLES = ["ADMIN", "OPERATOR", "SCOREKEEPER", "VIEWER"] as const;

export const dynamic = "force-dynamic";

export default async function TournamentMembersPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  const user = await requireAuthOrRedirect();
  const actor = { userId: user.id, role: user.role };
  const db = getDb();
  let tournament;
  let members;
  try {
    [tournament, members] = await Promise.all([
      new TournamentService(db).getById(tournamentId),
      new TournamentMemberService(db).list(actor, tournamentId),
    ]);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <AdminBreadcrumbs
          tournament={{ id: tournamentId, name: tournament.name }}
          current="Cộng tác viên"
        />
        <h2 className="mt-2 text-2xl font-semibold">Cộng tác viên</h2>
        <p className="mt-1 text-sm text-slate-600">
          Chia sẻ riêng giải này với một tài khoản đã tồn tại.
        </p>
      </div>

      <ActionForm
        action={addTournamentMemberAction.bind(null, tournamentId)}
        submitLabel="Thêm cộng tác viên"
        className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 md:grid-cols-[1fr_180px_auto]"
      >
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" name="username" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role">Vai trò</Label>
          <Select id="role" name="role" defaultValue="OPERATOR">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </Select>
        </div>
      </ActionForm>

      <div className="space-y-3">
        {members.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Chưa có cộng tác viên.
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4"
            >
              <div>
                <p className="font-medium">{member.displayName}</p>
                <p className="text-sm text-slate-600">@{member.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <form
                  action={updateTournamentMemberAction.bind(
                    null,
                    tournamentId,
                    member.userId,
                  )}
                  className="flex items-center gap-2"
                >
                  <Select name="role" defaultValue={member.role}>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                  <Button type="submit" size="sm" variant="secondary">
                    Lưu
                  </Button>
                </form>
                <form
                  action={removeTournamentMemberAction.bind(
                    null,
                    tournamentId,
                    member.userId,
                  )}
                >
                  <Button type="submit" size="sm" variant="outline">
                    Xóa
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

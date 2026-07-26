"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  deleteCourtAction,
  updateCourtAction,
} from "@/features/courts/actions";
import { CourtPinControls } from "@/features/courts/court-pin-controls";

type Props = {
  tournamentId: string;
  tournamentSlug: string;
  canSetup: boolean;
  court: {
    id: string;
    name: string;
    code: string;
    active: boolean;
    hasAccessPin: boolean;
    accessPin: string | null;
    accessToken: string | null;
  };
};

export function EditableCourtRow({
  tournamentId,
  tournamentSlug,
  canSetup,
  court,
}: Props) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(court.name);
  const [code, setCode] = useState(court.code);
  const [active, setActive] = useState(court.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function cancelEditing() {
    setName(court.name);
    setCode(court.code);
    setActive(court.active);
    setError(null);
    setEditing(false);
  }

  function save() {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("code", code);
    if (active) {
      formData.set("active", "on");
    }

    setError(null);
    startTransition(async () => {
      const result = await updateCourtAction(
        tournamentId,
        court.id,
        formData,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCourtAction(tournamentId, court.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <TableRow>
      <TableCell className="w-44 align-top">
        {editing ? (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 min-w-36"
            aria-label={tc("name")}
            autoFocus
          />
        ) : (
          court.name
        )}
      </TableCell>
      <TableCell className="w-28 align-top">
        {editing ? (
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-8 min-w-20 font-mono"
            aria-label={tc("code")}
          />
        ) : (
          court.code
        )}
      </TableCell>
      <TableCell className="align-top">
        {editing ? (
          <select
            value={active ? "true" : "false"}
            onChange={(event) => setActive(event.target.value === "true")}
            className="h-8 min-w-24 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label={tc("active")}
          >
            <option value="true">{tc("yes")}</option>
            <option value="false">{tc("no")}</option>
          </select>
        ) : court.active ? (
          tc("yes")
        ) : (
          tc("no")
        )}
      </TableCell>
      <TableCell className="align-top">
        <CourtPinControls
          tournamentId={tournamentId}
          courtId={court.id}
          courtCode={court.code}
          tournamentSlug={tournamentSlug}
          hasAccessPin={court.hasAccessPin}
          accessPin={court.accessPin}
          accessToken={court.accessToken}
        />
      </TableCell>
      {canSetup ? (
        <TableCell className="w-36 align-top text-right">
          <div className="flex justify-end gap-2">
            {editing ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={save}
                >
                  {pending ? tc("saving") : tc("save")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={cancelEditing}
                >
                  {tc("cancel")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setEditing(true)}
                >
                  {tc("edit")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={remove}
                >
                  {tc("delete")}
                </Button>
              </>
            )}
          </div>
          {error ? (
            <p className="mt-2 max-w-52 text-left text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

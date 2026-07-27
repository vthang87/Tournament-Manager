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
    <TableRow className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm hover:bg-white sm:table-row sm:rounded-none sm:border-x-0 sm:border-t-0 sm:p-0 sm:shadow-none sm:hover:bg-slate-50/80">
      <TableCell className="block min-w-0 p-0 align-top sm:table-cell sm:w-44 sm:p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
          {tc("name")}
        </p>
        {editing ? (
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-8 min-w-0"
            aria-label={tc("name")}
            autoFocus
          />
        ) : (
          <span className="font-medium text-slate-900">{court.name}</span>
        )}
      </TableCell>
      <TableCell className="block p-0 align-top sm:table-cell sm:w-28 sm:p-3">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
          {tc("code")}
        </p>
        {editing ? (
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="h-8 w-20 min-w-0 font-mono"
            aria-label={tc("code")}
          />
        ) : (
          <span className="font-mono text-sm">{court.code}</span>
        )}
      </TableCell>
      <TableCell className="block p-0 text-right align-top sm:table-cell sm:p-3 sm:text-left">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:hidden">
          {tc("active")}
        </p>
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
      <TableCell className="col-span-3 block border-t border-slate-100 p-0 pt-3 align-top sm:table-cell sm:border-0 sm:p-3">
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
        <TableCell className="col-span-3 block p-0 align-top text-right sm:table-cell sm:w-36 sm:p-3">
          <div className="flex justify-start gap-2 sm:justify-end">
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

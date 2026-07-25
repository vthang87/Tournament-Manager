"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearCourtAccessPinAction,
  setCourtAccessPinAction,
} from "@/features/courts/actions";

/** Cryptographically random 4-digit PIN (1000–9999). */
function randomCourtPin(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(1000 + (buf[0]! % 9000));
}

function pinStorageKey(courtId: string) {
  return `tm.courtPin.${courtId}`;
}

function readStoredPin(courtId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(pinStorageKey(courtId));
    return stored && /^\d{4,6}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function CourtPinControls({
  tournamentId,
  courtId,
  courtCode,
  tournamentSlug,
  hasAccessPin,
}: {
  tournamentId: string;
  courtId: string;
  courtCode: string;
  tournamentSlug: string;
  hasAccessPin: boolean;
}) {
  const t = useTranslations("courts");
  const router = useRouter();
  const [pin, setPin] = useState(() => readStoredPin(courtId) ?? "");
  const [knownPin, setKnownPin] = useState<string | null>(() =>
    hasAccessPin ? readStoredPin(courtId) : null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState<"link" | "pin" | null>(null);
  const [showPin, setShowPin] = useState(() => Boolean(readStoredPin(courtId)));
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [absoluteUrl, setAbsoluteUrl] = useState("");

  const publicPath = `/r/${tournamentSlug}/c/${courtCode}`;
  const quickPin = hasAccessPin ? knownPin : null;

  function rememberPin(value: string) {
    setKnownPin(value);
    setPin(value);
    setShowPin(true);
    try {
      sessionStorage.setItem(pinStorageKey(courtId), value);
    } catch {
      // ignore
    }
  }

  function forgetPin() {
    setKnownPin(null);
    setPin("");
    setShowPin(false);
    try {
      sessionStorage.removeItem(pinStorageKey(courtId));
    } catch {
      // ignore
    }
  }

  async function openQr() {
    setError(null);
    const url = `${window.location.origin}${publicPath}`;
    setAbsoluteUrl(url);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 1,
        width: 280,
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
      setQrOpen(true);
    } catch {
      setError(t("qrFailed"));
    }
  }

  async function copyText(value: string, kind: "link" | "pin") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError(t("copyFailed"));
    }
  }

  return (
    <div className="space-y-2 text-left">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
          {publicPath}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            void copyText(`${window.location.origin}${publicPath}`, "link")
          }
        >
          {copied === "link" ? t("copied") : t("copyLink")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => void openQr()}>
          {t("showQr")}
        </Button>
        <span
          className={
            hasAccessPin
              ? "text-xs font-medium text-emerald-700"
              : "text-xs text-slate-500"
          }
        >
          {hasAccessPin ? t("pinEnabled") : t("pinDisabled")}
        </span>
      </div>

      {quickPin ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
          <span className="text-xs font-medium text-emerald-800">
            {t("quickPin")}
          </span>
          <code className="text-base font-semibold tabular-nums tracking-[0.2em] text-emerald-900">
            {quickPin}
          </code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7"
            onClick={() => void copyText(quickPin, "pin")}
          >
            {copied === "pin" ? t("copied") : t("copyPin")}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor={`pin-${courtId}`} className="text-xs">
            {t("pinLabel")}
          </Label>
          <Input
            id={`pin-${courtId}`}
            type={showPin ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            className="h-8 w-28 tabular-nums tracking-wider"
            value={pin}
            placeholder={t("pinPlaceholder")}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => {
            const next = randomCourtPin();
            setPin(next);
            setShowPin(true);
            setError(null);
            setMessage(t("pinGenerated", { pin: next }));
          }}
        >
          {t("randomPin")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={pending || pin.length < 4}
          onClick={() => {
            setError(null);
            setMessage(null);
            const fd = new FormData();
            fd.set("pin", pin);
            startTransition(async () => {
              const result = await setCourtAccessPinAction(
                tournamentId,
                courtId,
                fd,
              );
              if (!result.ok) {
                setError(result.error);
                return;
              }
              rememberPin(pin);
              setMessage(t("pinSavedWithValue", { pin }));
              router.refresh();
            });
          }}
        >
          {hasAccessPin ? t("resetPin") : t("setPin")}
        </Button>
        {hasAccessPin ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const result = await clearCourtAccessPinAction(
                  tournamentId,
                  courtId,
                );
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                forgetPin();
                setMessage(t("pinCleared"));
                router.refresh();
              });
            }}
          >
            {t("clearPin")}
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        title={t("qrTitle", { code: courtCode })}
        description={t("qrHint")}
      >
        <div className="flex flex-col items-center gap-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt={t("qrAlt", { code: courtCode })}
              className="rounded-md border border-slate-200 bg-white p-2"
              width={280}
              height={280}
            />
          ) : null}
          <code className="break-all text-center text-xs text-slate-600">
            {absoluteUrl || publicPath}
          </code>
          {quickPin ? (
            <div className="w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">
                {t("quickPin")}
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-[0.25em] text-emerald-950">
                {quickPin}
              </p>
            </div>
          ) : hasAccessPin ? (
            <p className="text-center text-xs text-slate-500">
              {t("pinHiddenHint")}
            </p>
          ) : (
            <p className="text-center text-xs text-amber-700">{t("pinDisabled")}</p>
          )}
          <div className="flex w-full flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() =>
                void copyText(
                  absoluteUrl || `${window.location.origin}${publicPath}`,
                  "link",
                )
              }
            >
              {copied === "link" ? t("copied") : t("copyLink")}
            </Button>
            {quickPin ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => void copyText(quickPin, "pin")}
              >
                {copied === "pin" ? t("copied") : t("copyPin")}
              </Button>
            ) : null}
            <Button
              type="button"
              className="flex-1"
              onClick={() => {
                window.open(publicPath, "_blank", "noopener,noreferrer");
              }}
            >
              {t("openLink")}
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setQrOpen(false)}
          >
            {t("closeQr")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

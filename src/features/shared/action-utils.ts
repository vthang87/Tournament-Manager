import { AppError } from "@/application/errors";
import type { ActorContext, UserRole } from "@/core/domain";
import { requireAuth } from "@/lib/auth/require-auth";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export async function withActor<T>(
  fn: (actor: ActorContext) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const user = await requireAuth();
    const actor: ActorContext = { userId: user.id, role: user.role };
    const data = await fn(actor);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AppError) {
      return { ok: false, error: err.message, code: err.code };
    }
    throw err;
  }
}

export function formString(
  formData: FormData,
  key: string,
): string {
  return String(formData.get(key) ?? "").trim();
}

export function formOptionalString(
  formData: FormData,
  key: string,
): string | null {
  const value = formString(formData, key);
  return value.length === 0 ? null : value;
}

export function formBool(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "on" || value === "true" || value === "1";
}

export function formInt(
  formData: FormData,
  key: string,
): number | null {
  const raw = formString(formData, key);
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function actorFromRole(role: UserRole, userId = "test-user"): ActorContext {
  return { userId, role };
}

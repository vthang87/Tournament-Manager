"use server";

import { revalidatePath } from "next/cache";
import { ProfileService } from "@/application/services";
import { getDb } from "@/db/client";
import {
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function formPassword(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

export async function updateProfileAction(
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor((actor) =>
    new ProfileService(getDb()).update(actor, {
      displayName: formString(formData, "displayName"),
    }),
  );
  if (result.ok) {
    revalidatePath("/admin", "layout");
    revalidatePath("/profile");
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function changePasswordAction(
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor((actor) =>
    new ProfileService(getDb()).changePassword(actor, {
      currentPassword: formPassword(formData, "currentPassword"),
      newPassword: formPassword(formData, "newPassword"),
      confirmPassword: formPassword(formData, "confirmPassword"),
    }),
  );
  return result.ok ? { ok: true, data: undefined } : result;
}

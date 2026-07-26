"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserManagementService } from "@/application/services";
import type { UserRole } from "@/core/domain";
import { getDb } from "@/db/client";
import {
  formBool,
  formString,
  withActor,
  type ActionResult,
} from "@/features/shared/action-utils";

function userRole(formData: FormData): UserRole {
  return formString(formData, "role") as UserRole;
}

export async function createUserAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const result = await withActor(async (actor) => {
    const user = await new UserManagementService(getDb()).create(actor, {
      username: formString(formData, "username"),
      displayName: formString(formData, "displayName"),
      password: formString(formData, "password"),
      role: userRole(formData),
      active: formBool(formData, "active"),
    });
    return { id: user.id };
  });
  if (result.ok) {
    revalidatePath("/admin/users");
    redirect(`/admin/users/${result.data.id}`);
  }
  return result;
}

export async function updateUserAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor((actor) =>
    new UserManagementService(getDb()).update(actor, userId, {
      username: formString(formData, "username"),
      displayName: formString(formData, "displayName"),
      role: userRole(formData),
      active: formBool(formData, "active"),
    }),
  );
  if (result.ok) {
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
  }
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function resetUserPasswordAction(
  userId: string,
  formData: FormData,
): Promise<ActionResult> {
  const result = await withActor((actor) =>
    new UserManagementService(getDb()).resetPassword(actor, userId, {
      password: formString(formData, "password"),
    }),
  );
  if (result.ok) {
    revalidatePath(`/admin/users/${userId}`);
  }
  return result;
}

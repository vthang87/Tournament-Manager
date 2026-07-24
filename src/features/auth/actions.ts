"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { createSession, destroySession } from "@/lib/auth/session";
import { authenticateCredentials } from "./authenticate";

export type LoginActionState = {
  error?: string;
} | null;

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username and password are required." };
  }

  const result = await authenticateCredentials(getDb(), username, password);
  if (!result.ok) {
    if (result.reason === "inactive") {
      return { error: "This account is inactive." };
    }
    return { error: "Invalid username or password." };
  }

  await createSession(result.user);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

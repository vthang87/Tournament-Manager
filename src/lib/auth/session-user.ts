import type { UserRole } from "@/core/domain";

/** Authenticated user payload stored in the session cookie (no secrets). */
export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
};

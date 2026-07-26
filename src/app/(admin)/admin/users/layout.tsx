import { requireRoleOrRedirect } from "@/lib/auth/require-auth";

export default async function UserManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(["SUPER_ADMIN"]);
  return children;
}

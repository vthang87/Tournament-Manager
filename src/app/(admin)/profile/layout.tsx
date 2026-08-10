import { AdminShell } from "@/components/shared/admin-shell";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}

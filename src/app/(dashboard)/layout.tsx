import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import DashboardShell from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Protected route group: server-side session check on every navigation.
  const hdrs = await headers();
  const user = await getSessionUser(new Request("http://local", { headers: { cookie: hdrs.get("cookie") ?? "" } }));
  if (!user) redirect("/login");

  return <DashboardShell user={user}>{children}</DashboardShell>;
}

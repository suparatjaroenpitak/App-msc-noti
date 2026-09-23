import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";

export default async function Home() {
  const hdrs = await headers();
  const user = await getSessionUser(new Request("http://local", { headers: { cookie: hdrs.get("cookie") ?? "" } }));
  redirect(user ? "/dashboard" : "/login");
}

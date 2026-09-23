"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell, BellRing, LayoutDashboard, ListOrdered, Settings, Volume2, Download, LogOut, Sun, Moon, LineChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api/client";
import { useTheme } from "@/components/theme-provider";
import { usePush } from "@/hooks/use-push";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: ListOrdered },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/notification-sounds", label: "Sounds", icon: Volume2 },
  { href: "/settings", index: true, label: "Settings", icon: Settings },
];

type ShellUser = { id: string; name: string; email: string };

export default function DashboardShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const push = usePush();
  const [installEvent, setInstallEvent] = useState<Event | null>(null);
  const [installable, setInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
      setInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const onInstall = async () => {
    if (installEvent) {
      (installEvent as Event & { prompt: () => Promise<void> }).prompt();
      setInstallable(false);
      return;
    }
    router.push("/install");
  };

  const onLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST", body: "{}" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-950">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-neutral-200 px-5 dark:border-neutral-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">S</div>
          <span className="font-semibold">Stock Alert</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
                isActive(item.href) && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          ))}
          <Link
            href="/install"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
              isActive("/install") && "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
            )}
          >
            <Download className="h-5 w-5 shrink-0" />
            Install App
          </Link>
        </nav>
        <div className="border-t border-neutral-200 p-3 dark:border-neutral-800">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-neutral-500">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-950 dark:hover:text-red-400"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-neutral-200 bg-white/90 px-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90 lg:pl-72">
        <div className="flex items-center gap-2 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">S</div>
          <span className="font-semibold">Stock Alert</span>
        </div>
        <div className="hidden items-center gap-2 text-sm text-neutral-500 lg:flex">
          <LineChart className="h-4 w-4" />
          <span>Stock & ETF price alerts — ไม่ใช่คำแนะนำการลงทุน</span>
        </div>
        <div className="flex items-center gap-1">
          {push.subscribed ? <span title="Push enabled" className="mr-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Push ON</span> : null}
          {installable ? (
            <button onClick={onInstall} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="Install app">
              <Download className="h-5 w-5" />
              <span className="sr-only">Install app</span>
            </button>
          ) : null}
          <button onClick={toggle} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" title="สลับธีม">
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="px-4 pb-28 pt-6 lg:pb-10 lg:pl-72">{children}</main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
        <div className="grid grid-cols-5">
          {NAV.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400",
                isActive(item.href) && "text-emerald-600 dark:text-emerald-400",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

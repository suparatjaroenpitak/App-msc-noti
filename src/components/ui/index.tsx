"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

export { ConfirmDialog } from "./confirm-dialog";
export { ToastProvider, useToast } from "./toast";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg" | "icon";

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50",
        {
          "bg-emerald-600 text-white hover:bg-emerald-700": variant === "primary",
          "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800": variant === "secondary",
          "bg-red-600 text-white hover:bg-red-700": variant === "danger",
          "hover:bg-neutral-100 dark:hover:bg-neutral-800": variant === "ghost",
          "h-9 px-3 text-sm": size === "sm",
          "h-10 px-4 text-sm": size === "md",
          "h-11 px-6": size === "lg",
          "h-9 w-9 p-0": size === "icon",
        },
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300", className)} {...props} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
      <div>
        <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("p-5", className)}>{children}</div>;
}

type BadgeTone = "green" | "red" | "gray" | "amber" | "blue";
export function Badge({ tone = "gray", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        {
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300": tone === "green",
          "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300": tone === "red",
          "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300": tone === "gray",
          "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300": tone === "amber",
          "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300": tone === "blue",
        },
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-800", className)} />;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-neutral-400 dark:text-neutral-600">{icon}</div> : null}
      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-neutral-500 dark:text-neutral-400">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn("h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-emerald-600", className)}
      role="status"
      aria-label="loading"
    />
  );
}

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50",
        checked ? "bg-emerald-600" : "bg-neutral-300 dark:bg-neutral-700",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

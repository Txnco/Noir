"use client";

import { useEffect, useState } from "react";

type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

type ToastInput = Omit<Toast, "id" | "duration"> & { duration?: number };

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let counter = 0;

export function toast(input: ToastInput) {
  const t: Toast = {
    id: ++counter,
    duration: input.duration ?? 4500,
    ...input,
  };
  listeners.forEach((fn) => fn(t));
  return t.id;
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, variant: "success" });
toast.error = (title: string, description?: string) =>
  toast({ title, description, variant: "error" });
toast.info = (title: string, description?: string) =>
  toast({ title, description, variant: "info" });

const icons: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8.5l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 4v5M8 11.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 7.5v4.5M8 4.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
};

const tones: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-red-200 bg-red-50 text-red-900",
  info: "border-border bg-surface-white text-neutral",
};

const accents: Record<ToastVariant, string> = {
  success: "text-emerald-600",
  error: "text-red-600",
  info: "text-accent",
};

export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const add: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, t.duration);
    };
    listeners.add(add);
    return () => {
      listeners.delete(add);
    };
  }, []);

  const dismiss = (id: number) =>
    setItems((prev) => prev.filter((x) => x.id !== id));

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:top-6"
    >
      {items.map((t) => (
        <div
          key={t.id}
          role={t.variant === "error" ? "alert" : "status"}
          className={`toast-in pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-primary/10 backdrop-blur ${tones[t.variant]}`}
        >
          <span className={`mt-0.5 shrink-0 ${accents[t.variant]}`}>{icons[t.variant]}</span>
          <div className="flex-1 text-sm">
            <p className="font-semibold leading-tight">{t.title}</p>
            {t.description && (
              <p className="mt-0.5 text-xs opacity-80">{t.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            aria-label="Zatvori obavijest"
            className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

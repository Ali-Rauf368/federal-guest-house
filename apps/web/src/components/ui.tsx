import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import type { GuestCategory, ReservationStatus, RoomCondition } from "../lib/api";
import { CATEGORY_LABEL } from "../lib/format";

export function Button({ variant = "primary", className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-brand text-brand-fg hover:brightness-110",
        variant === "soft" && "bg-brand-soft text-brand hover:brightness-95 dark:hover:brightness-125",
        variant === "ghost" && "text-fg-2 hover:bg-soft",
        variant === "danger" && "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40",
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-lg border border-edge bg-card shadow-sm", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Federal Guest House`;
  }, [title]);
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-fg-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const inputCls = "w-full rounded-md border border-edge bg-card px-3 py-2 text-sm outline-none placeholder:text-fg-3 focus:border-brand focus:ring-2 focus:ring-brand/20";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-fg-2">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-fg-3">{hint}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={clsx(inputCls, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={clsx(inputCls, p.className)} />;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-[8vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={clsx("w-full rounded-lg border border-edge bg-card p-6 shadow-2xl", wide ? "max-w-2xl" : "max-w-md")}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-fg-3 hover:bg-soft" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{message}</p>;
}

export const Loading = () => (
  <div role="status" aria-label="Loading" className="animate-pulse space-y-3 p-5">
    {[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-soft" style={{ width: `${90 - i * 12}%` }} />)}
  </div>
);
export const Empty = ({ children }: { children: ReactNode }) => <p className="py-10 text-center text-sm text-fg-3">{children}</p>;

const pill = "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold";
const amber = "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
const green = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
const sky = "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300";
const rose = "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300";
const muted = "bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400";

const statusStyle: Record<ReservationStatus, string> = {
  REQUESTED: amber,
  CONFIRMED: sky,
  CHECKED_IN: green,
  CHECKED_OUT: "bg-soft text-fg-2",
  CANCELLED: muted,
  REJECTED: rose,
  NO_SHOW: rose,
};
const statusLabel: Record<ReservationStatus, string> = {
  REQUESTED: "Awaiting approval",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "In house",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  NO_SHOW: "No-show",
};
export const StatusPill = ({ status }: { status: ReservationStatus }) => <span className={clsx(pill, statusStyle[status])}>{statusLabel[status]}</span>;

const conditionStyle: Record<RoomCondition, string> = { READY: green, DIRTY: amber, CLEANING: sky, OUT_OF_ORDER: rose };
export const CONDITION_LABEL: Record<RoomCondition, string> = { READY: "Ready", DIRTY: "Needs cleaning", CLEANING: "Being cleaned", OUT_OF_ORDER: "Out of order" };
export const ConditionPill = ({ condition }: { condition: RoomCondition }) => <span className={clsx(pill, conditionStyle[condition])}>{CONDITION_LABEL[condition]}</span>;

export const CategoryPill = ({ category }: { category: GuestCategory }) => (
  <span className={clsx(pill, category === "STATE_GUEST" ? "bg-brass/30 text-amber-900 dark:text-brass" : "bg-soft text-fg-2")}>{CATEGORY_LABEL[category]}</span>
);

export function ConfirmDialog({ title, body, label, danger, onClose, onConfirm }: { title: string; body: ReactNode; label: string; danger?: boolean; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="mb-5 text-sm text-fg-2">{body}</div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Go back</Button>
        <Button
          variant={danger ? "danger" : "primary"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onConfirm();
            onClose();
          }}
        >
          {label}
        </Button>
      </div>
    </Modal>
  );
}

export function Pager({ data, onPage }: { data: { total: number; page: number; pageSize: number }; onPage: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(data.total / data.pageSize));
  const first = (data.page - 1) * data.pageSize + 1;
  if (data.total === 0) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-2.5 text-sm text-fg-3">
      <span>{first}–{Math.min(data.total, data.page * data.pageSize)} of {data.total}</span>
      <span className="flex gap-1">
        <Button variant="ghost" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</Button>
        <Button variant="ghost" disabled={data.page >= last} onClick={() => onPage(data.page + 1)}>Next</Button>
      </span>
    </div>
  );
}

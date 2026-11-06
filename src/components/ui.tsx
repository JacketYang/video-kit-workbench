import type { ReactNode } from "react";
import { cn } from "../utils/cn";

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const dec = step < 1 ? (step < 0.1 ? 2 : 1) : 0;
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono text-amber-200">
          {value.toFixed(dec)}
          <span className="ml-0.5 text-slate-500">{unit ?? hint ?? ""}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="vk-range w-full"
      />
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs transition",
        checked ? "border-violet-400/50 bg-violet-500/15 text-violet-100" : "border-white/10 bg-white/5 text-slate-400",
      )}
    >
      <span>{label}</span>
      <span className={cn("relative h-4 w-7 rounded-full transition", checked ? "bg-violet-400" : "bg-slate-600")}>
        <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", checked ? "left-3.5" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-black/30 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded-md px-2 py-1.5 text-xs transition",
            o.value === value ? "bg-violet-500 text-white shadow" : "text-slate-400 hover:text-slate-200",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-white/10 bg-[#0f121a] px-3 py-2 text-sm text-slate-100 outline-none focus:border-violet-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-300">{label}</div>
      {children}
      {hint && <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{hint}</div>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#0f121a] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:border-violet-400";

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-white/5 pb-5 last:border-0">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Btn({
  children,
  onClick,
  variant = "ghost",
  disabled,
  className,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-900/40 hover:brightness-110",
        variant === "ghost" && "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
        variant === "danger" && "border border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/20",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Warn({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1 rounded-lg border border-amber-300/20 bg-amber-300/5 p-2.5 text-[11px] text-amber-200/90">
      {items.slice(0, 8).map((w, i) => (
        <li key={i}>⚠ {w}</li>
      ))}
    </ul>
  );
}

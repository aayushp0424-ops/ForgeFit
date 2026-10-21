import { useId, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { Dumbbell, type LucideIcon } from "lucide-react";

// Shared presentation primitives. They intentionally hold no tracking or storage state.
export const n = (x: number, digits = 0) =>
  x.toLocaleString("en-US", { maximumFractionDigits: digits });

export function Brand() {
  return <div className="brand"><span className="brand-mark"><Dumbbell size={23} strokeWidth={2.8} /></span><span><strong>FORGE<span className="brand-teal">FIT</span></strong><small>FUEL YOUR PROGRESS</small></span></div>;
}

export function Pill({ children, kind = "muted" }: { children: ReactNode; kind?: "muted" | "teal" | "orange" }) {
  return <span className={"pill pill-" + kind}>{children}</span>;
}

export function Ring({ value, total, title, subtitle, size = "large" }: { value: number; total: number; title: string; subtitle: string; size?: "large" | "small" }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return <div className={"ring ring-" + size} role="img" aria-label={title + " " + subtitle} style={{ background: "conic-gradient(var(--teal) " + pct + "%, var(--line) " + pct + "%)" }}>
    <div className="ring-inner"><strong>{title}</strong><span>{subtitle}</span></div>
  </div>;
}

export function ProgressTrack({ value, total, color = "var(--teal)", label, className = "" }: { value: number; total: number; color?: string; label: string; className?: string }) {
  const safeTotal = Number.isFinite(total) && total > 0 ? total : 1;
  const safeValue = Number.isFinite(value) ? Math.min(safeTotal, Math.max(0, value)) : 0;
  return <div className={"ff-progress " + className} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuenow={safeValue} aria-valuemax={safeTotal}>
    <span style={{ width: (safeValue / safeTotal * 100) + "%", background: color }} />
  </div>;
}

export function MetricBar({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) {
  return <div className="metric-bar">
    <div className="metric-top"><span>{label}</span><strong>{n(current)} <em>/ {n(goal)}g</em></strong></div>
    <ProgressTrack value={current} total={goal} color={color} label={label + " goal progress"} className="track" />
  </div>;
}

export function Empty({ icon: Icon, heading, text }: { icon: LucideIcon; heading: string; text: string }) {
  return <div className="empty"><span className="empty-icon"><Icon size={25} /></span><strong>{heading}</strong><p>{text}</p></div>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="section-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

export type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger";
  fullWidth?: boolean;
};

// Defaults to type="button" to prevent accidental form submission.
export function ActionButton({ variant = "primary", fullWidth = false, className = "", type = "button", children, ...rest }: ActionButtonProps) {
  return <button {...rest} type={type} className={["button", "button-" + variant, fullWidth ? "full" : "", className].filter(Boolean).join(" ")}>{children}</button>;
}

export function SurfaceCard({ children, className = "", ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={["panel", "ff-surface-card", className].filter(Boolean).join(" ")}>{children}</div>;
}

export function TextField({ label, hint, id, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <label className={["field", "ff-text-field", className].filter(Boolean).join(" ")} htmlFor={inputId}>
    <span>{label}</span>
    <input {...rest} id={inputId} aria-describedby={hint ? inputId + "-hint" : undefined} />
    {hint && <small id={inputId + "-hint"} className="ff-field-hint">{hint}</small>}
  </label>;
}

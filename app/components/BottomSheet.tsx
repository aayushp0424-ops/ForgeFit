"use client";

import { useEffect, useId, useRef, type ReactNode, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// Reusable modal bottom sheet for the Phase 2 quick-action navigation.
// The sheet is hidden entirely while closed; it never captures input when inactive.
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const gestureStart = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab" || !panel.current) return;
      const focusables = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
      if (!focusables.length) { event.preventDefault(); panel.current.focus(); return; }
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    gestureStart.current = event.touches[0]?.clientY ?? null;
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (gestureStart.current == null) return;
    const dy = (event.changedTouches[0]?.clientY ?? gestureStart.current) - gestureStart.current;
    gestureStart.current = null;
    if (dy > 100 && panel.current?.scrollTop === 0) onClose();
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="ff-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ff-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={panel} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="ff-sheet-handle" aria-hidden="true" />
        <div className="ff-sheet-heading"><h2 id={titleId}>{title}</h2><button type="button" className="ff-sheet-close" onClick={onClose} aria-label={"Close " + title}><X size={21} /></button></div>
        {children}
      </div>
    </div>,
    document.body
  );
}

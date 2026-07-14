"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type TipState = {
  text: string;
  left: number;
  top: number;
  placement: "top" | "bottom";
};

function isDisabled(el: HTMLElement) {
  return (
    el.matches(":disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.getAttribute("data-tooltip-off") !== null ||
    Boolean(el.closest("[data-tooltip-off]"))
  );
}

function resolveTipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null;
  const el = node.closest<HTMLElement>(
    "[data-tooltip], button[aria-label], a[aria-label], [role='button'][aria-label], button[title], a[title], [role='button'][title]",
  );
  return el;
}

function resolveTipText(el: HTMLElement): string {
  const data = el.getAttribute("data-tooltip")?.trim();
  if (data) return data;

  const label = el.getAttribute("aria-label")?.trim();
  const title = el.getAttribute("title")?.trim();
  const text = label || title || "";
  if (!text) return "";

  // Skip redundant tips when the control already shows the same words.
  const visible = (el.innerText || "").replace(/\s+/g, " ").trim();
  if (visible && (visible === text || visible.includes(text) || text.includes(visible))) {
    return "";
  }

  return text;
}

export function AppTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    let active: HTMLElement | null = null;
    let removeTitle: string | null = null;

    function hide() {
      if (active && removeTitle !== null) {
        active.setAttribute("title", removeTitle);
      }
      active = null;
      removeTitle = null;
      setTip(null);
    }

    function showFor(el: HTMLElement) {
      if (isDisabled(el)) {
        hide();
        return;
      }
      const text = resolveTipText(el);
      if (!text) {
        hide();
        return;
      }

      // Prefer custom tooltip over the delayed native title bubble.
      if (el.hasAttribute("title")) {
        removeTitle = el.getAttribute("title");
        el.removeAttribute("title");
      } else {
        removeTitle = null;
      }

      active = el;
      const rect = el.getBoundingClientRect();
      const placement = rect.top < 56 ? "bottom" : "top";
      const top =
        placement === "top" ? Math.max(8, rect.top - 8) : rect.bottom + 8;
      const left = Math.min(
        window.innerWidth - 16,
        Math.max(16, rect.left + rect.width / 2),
      );

      setTip({ text, left, top, placement });
    }

    function onPointerOver(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const el = resolveTipTarget(event.target);
      if (!el) return;
      if (el === active) return;
      showFor(el);
    }

    function onPointerOut(event: PointerEvent) {
      if (!active) return;
      const next = event.relatedTarget;
      if (next instanceof Node && active.contains(next)) return;
      const nextTarget = resolveTipTarget(next);
      if (nextTarget === active) return;
      hide();
    }

    function onFocusIn(event: FocusEvent) {
      const el = resolveTipTarget(event.target);
      if (!el) return;
      showFor(el);
    }

    function onFocusOut() {
      hide();
    }

    function onScroll() {
      hide();
    }

    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("focusout", onFocusOut, true);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("focusout", onFocusOut, true);
      window.removeEventListener("scroll", onScroll, true);
      hide();
    };
  }, []);

  if (!mounted || !tip) return null;

  return createPortal(
    <div
      role="tooltip"
      className="app-tooltip pointer-events-none fixed z-[1000] max-w-xs -translate-x-1/2 rounded-xl bg-foreground px-3 py-2 text-xs font-medium leading-snug text-background shadow-lg"
      style={{
        left: tip.left,
        top: tip.top,
        transform:
          tip.placement === "top"
            ? "translate(-50%, -100%)"
            : "translate(-50%, 0)",
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
}

"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

type Mode = "system" | "light" | "dark";
const ORDER: Mode[] = ["system", "light", "dark"];
const KEY = "bayan-theme";
const THEME_EVENT = "bayan-theme-change";

function apply(mode: Mode): void {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

function readStored(): Mode {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** Dark mode is a CSS-variable swap on <html data-theme>; system preference is the default. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** `showLabel` adds the mode name beside the icon (the menu panel); the header row shows the icon only. */
export function ThemeToggle({ showLabel = true }: { showLabel?: boolean }) {
  const t = useTranslations("shell");
  const mode = useSyncExternalStore<Mode>(subscribe, readStored, () => "system");

  function cycle(): void {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length] ?? "system";
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      /* storage can be blocked; the theme still applies for this visit */
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
  const label = t(`theme.${mode}`);
  return (
    <button type="button" className={`btn btn-ghost btn-sm${showLabel ? "" : " btn-icon"}`} onClick={cycle} aria-label={t("theme.label", { mode: label })}>
      <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
      {showLabel ? <span>{label}</span> : null}
    </button>
  );
}

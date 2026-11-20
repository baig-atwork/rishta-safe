"use client";

import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "@/i18n/navigation";
import { NavLinks, type NavItem } from "./MainNav";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Under 1024 px the role navigation and the theme toggle live behind one menu button (the overflow menu).
 * A disclosure, not a dialog: it does not trap focus; Escape and a route change close it and focus returns to the button.
 */
export function HeaderMenu({ items }: { items: NavItem[] }) {
  const t = useTranslations("shell");
  const id = useId();
  const pathname = usePathname();
  // The menu records the route it was opened on, so a navigation closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const Icon = open ? X : Menu;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? t("menu.close") : t("menu.open")}
        onClick={() => setOpen(!open)}
      >
        <Icon aria-hidden="true" size={18} strokeWidth={1.5} />
      </button>
      {open ? (
        <nav id={id} className="menu-panel" aria-label={t("menu.label")}>
          <div className="wrap">
            <NavLinks items={items} />
            <div className="theme-row">
              <ThemeToggle />
            </div>
          </div>
        </nav>
      ) : null}
    </>
  );
}

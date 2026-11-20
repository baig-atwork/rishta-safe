"use client";

import { ChevronDown, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from "react";
import { endSession, startSession } from "@/app/[locale]/actions";
import { usePathname } from "@/i18n/navigation";
import type { Role } from "@/lib/api/types";

/** The signed-in demo lens, taken from the session cookie (never the token). */
export interface LensPersona {
  id: string;
  /** The API's display_name; it already ends with "(synthetic)". */
  displayName: string;
  coupleId: string | null;
}

/** One seeded persona in the fallback list (token-free: the server action looks the token up itself). */
export interface LensOption {
  id: string;
  displayName: string;
  role: Role;
  coupleId: string | null;
}

export interface LensControlProps {
  persona?: LensPersona | null;
  /** Fallback list shown inside the dialog while `children` is empty, so a developer can always switch persona. */
  options?: LensOption[];
  /** SLOT: Lane C's compact CaseBench goes here. When present it replaces the fallback list. */
  children?: ReactNode;
}

/**
 * "Lens: {display_name} · {couple_id}" button that opens a modal dialog (native <dialog>, showModal: focus trap,
 * inert page and Escape come from the platform). The dialog holds the Case bench slot and "Leave this lens". It uses the
 * same session mechanism as before: the startSession and endSession server actions, which set or clear the httpOnly
 * cookie and redirect to the role's home. The dialog body exists only while open, so nothing in it is reachable or
 * queryable while closed.
 */
export function LensControl({ persona = null, options = [], children }: LensControlProps) {
  const t = useTranslations("shell.lens");
  const locale = useLocale();
  const pathname = usePathname();
  const titleId = useId();
  // The dialog records the route and lens it was opened for: a switch redirects, so the header (which persists)
  // closes it by that key changing, with no effect that sets state.
  const personaId = persona?.id ?? null;
  const key = `${pathname}|${personaId ?? ""}`;
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === key;
  const [pending, start] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    // Pointer press on the backdrop lands on the <dialog> itself, outside its box (its padding is inside the box).
    const dismissOnBackdrop = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) dialog.close();
    };
    dialog.addEventListener("click", dismissOnBackdrop);
    return () => dialog.removeEventListener("click", dismissOnBackdrop);
  }, [open]);

  const hasSlot = children !== undefined && children !== null && children !== false;
  const label = persona ? persona.displayName : t("none");

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="lens-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenFor(key)}
        data-testid="lens-control"
      >
        <span className="k">{t("label")}</span>
        <span className="sr-only">:</span>
        <span className="nm">{label}</span>
        {persona?.coupleId ? (
          <span className="case ltr">
            <bdi>{persona.coupleId}</bdi>
          </span>
        ) : null}
        <ChevronDown aria-hidden="true" size={14} strokeWidth={1.5} />
      </button>
      <dialog
        ref={dialogRef}
        className="dialog-popup"
        aria-labelledby={titleId}
        onClose={() => {
          setOpenFor(null);
          triggerRef.current?.focus();
        }}
      >
        {open ? (
          <div data-testid="lens-dialog">
            <div className="flex items-start justify-between gap-4">
              <h2 id={titleId} className="m-0">
                {t("dialogTitle")}
              </h2>
              <button type="button" className="btn btn-quiet btn-sm btn-icon" aria-label={t("close")} onClick={() => dialogRef.current?.close()}>
                <X aria-hidden="true" size={16} strokeWidth={1.5} />
              </button>
            </div>
            {hasSlot ? (
              <div className="mt-4">{children}</div>
            ) : (
              <div className="mt-4">
                <p className="m-0 text-fg-2 text-sm">{t("fallbackHint")}</p>
                <ul className="mt-3 grid list-none gap-1 p-0" data-testid="lens-fallback">
                  {options.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        className="btn btn-quiet w-full justify-between"
                        data-lens-persona={option.id}
                        aria-current={option.id === personaId ? "true" : undefined}
                        disabled={pending}
                        onClick={() => start(async () => startSession(option.id, locale))}
                      >
                        <span>
                          <span className="sr-only">{t("enter", { name: option.displayName })}</span>
                          <span aria-hidden="true">{option.displayName}</span>
                        </span>
                        {option.coupleId ? (
                          <span className="mono ltr fg3 whitespace-nowrap text-xs">
                            <bdi>{option.coupleId}</bdi>
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {persona ? (
              <div className="mt-5 border-t border-line pt-4">
                <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => start(async () => endSession(locale))}>
                  {t("signOut")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </>
  );
}

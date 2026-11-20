"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ConsentRecord } from "@/lib/api/types";

interface RevokeDialogProps {
  record: ConsentRecord;
  /** Already formatted for the sentence, e.g. the partner's name or "your counsellor". */
  recipientLabel: string;
  scopeLabel: string;
  onRevoked: (record: ConsentRecord) => void;
  /** Where focus lands once the revoked row has lost its button (the trigger no longer exists). */
  focusAfterRevoke: RefObject<HTMLElement | null>;
}

/**
 * Revoking is the one irreversible-looking action on the page, so it asks first. This is the platform's modal
 * `<dialog>` opened with showModal(): the focus trap, the inert page behind it and Escape come with it. The safe
 * choice ("Keep sharing") takes initial focus; dismissing in any way returns focus to the trigger, a completed
 * revoke to the ledger heading (the trigger is gone by then).
 */
export function RevokeDialog({ record, recipientLabel, scopeLabel, onRevoked, focusAfterRevoke }: RevokeDialogProps) {
  const t = useTranslations("sharing");
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const revokedRef = useRef(false);

  const mutation = useMutation<ConsentRecord, ApiError>({
    mutationFn: () => clientApi.revokeConsent(record.consent_id),
    onSuccess: (updated) => {
      revokedRef.current = true;
      dialogRef.current?.close();
      // The `close` event is asynchronous and this component is about to unmount (the row is no longer active),
      // so the hand-off of focus happens here, synchronously.
      focusAfterRevoke.current?.focus();
      setOpen(false);
      onRevoked(updated);
    },
  });

  // The dialog body only exists while open (fresh state every time); showModal() runs once it has rendered.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    keepRef.current?.focus();

    // A pointer press on the backdrop lands on the <dialog> element itself but outside its box (its padding is inside
    // the box). Pointer-only by nature: Escape and the Keep button are the keyboard routes.
    const dismissOnBackdrop = (event: MouseEvent) => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (!inside) dialog.close();
    };
    dialog.addEventListener("click", dismissOnBackdrop);
    return () => dialog.removeEventListener("click", dismissOnBackdrop);
  }, [open]);

  function openDialog() {
    mutation.reset();
    revokedRef.current = false;
    setOpen(true);
  }

  /** Fires for every way the dialog closes (Keep sharing, Escape, a click outside); a completed revoke handled its own focus. */
  function onClose() {
    setOpen(false);
    if (!revokedRef.current) triggerRef.current?.focus();
  }

  return (
    <>
      <button ref={triggerRef} type="button" className="btn btn-danger" aria-haspopup="dialog" onClick={openDialog}>
        {t("revoke.trigger")}
        <span className="sr-only"> {t("revoke.triggerContext", { recipient: recipientLabel, scope: scopeLabel })}</span>
      </button>
      <dialog ref={dialogRef} className="dialog-popup" aria-labelledby={titleId} aria-describedby={bodyId} onClose={onClose}>
        {open ? (
          <>
            <h2 id={titleId} className="m-0 text-xl font-medium">
              {t("revoke.title", { recipient: recipientLabel })}
            </h2>
            <p id={bodyId} className="mt-3 text-fg-2">
              {t("revoke.body", { scope: scopeLabel })}
            </p>
            <p className="mt-3 text-sm text-fg-3">{t("revoke.note")}</p>
            {mutation.error ? (
              <p role="alert" className="field-error">
                {mutation.error.problem.title}
                {mutation.error.correlationId ? (
                  <>
                    {" "}
                    <code className="ltr-run font-mono">{mutation.error.correlationId}</code>
                  </>
                ) : null}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button ref={keepRef} type="button" className="btn btn-secondary" onClick={() => dialogRef.current?.close()}>
                {t("revoke.keep")}
              </button>
              <button type="button" className="btn btn-danger" aria-busy={mutation.isPending} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                {t("revoke.confirm")}
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </>
  );
}

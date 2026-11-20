"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import type { ApiError } from "@/lib/api/transport";

export interface RntkConfirmProps {
  open: boolean;
  pending: boolean;
  error: ApiError | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * The confirm step before the right not to know is recorded: a native modal <dialog> (focus trap, inert page, Escape)
 * quoting Art. 9(2) and Art. 26(2). The safe choice ("Go back") takes initial focus. Used by the threshold and by the
 * sharing page status line.
 */
export function RntkConfirm({ open, pending, error, onConfirm, onClose }: RntkConfirmProps) {
  const t = useTranslations("result.threshold");
  const titleId = useId();
  const bodyId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      backRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog-popup" aria-labelledby={titleId} aria-describedby={bodyId} onClose={onClose}>
      {open ? (
        <>
          <h2 id={titleId} className="m-0 text-lg">
            {t("confirmTitle")}
          </h2>
          <p id={bodyId} className="mt-3 text-fg-2">
            {t("confirmBody")}
          </p>
          {error ? (
            <p role="alert" className="field-error">
              <bdi>{error.problem.title}</bdi>
              {error.correlationId ? (
                <>
                  {" "}
                  <code className="ltr-run font-mono">{error.correlationId}</code>
                </>
              ) : null}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <button ref={backRef} type="button" className="btn btn-secondary" onClick={onClose}>
              {t("confirmNo")}
            </button>
            <button type="button" className="btn btn-primary" aria-busy={pending} disabled={pending} onClick={onConfirm}>
              {t("confirmYes")}
            </button>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

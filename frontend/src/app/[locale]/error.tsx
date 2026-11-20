"use client";

import { useTranslations } from "next-intl";

/** Last-resort boundary for an unexpected render error: message, retry, and the digest support can look up. */
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("states");
  return (
    <section role="alert" className="panel panel-attention">
      <h1>{t("errorTitle")}</h1>
      <p className="measure mt-2 text-fg-2">{t("errorBody")}</p>
      {error.digest ? (
        <p className="mt-3 text-sm text-fg-3">
          <span className="font-semibold">{t("correlationId")}</span> <code className="ltr-run">{error.digest}</code>
        </p>
      ) : null}
      <button type="button" className="btn btn-secondary mt-4" onClick={() => reset()}>
        {t("retry")}
      </button>
    </section>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SkeletonRows } from "@/components/ui/states";
import type { ConsentRecord, Locale, Partner } from "@/lib/api/types";

/**
 * The ledger and the grant form (react-hook-form and zod) are only needed once someone opens the disclosure, so their
 * code loads then, not with the page: the first load of the sharing route stays small.
 */
const SharingPanel = dynamic(() => import("./SharingPanel").then((module) => module.SharingPanel), {
  loading: () => <SkeletonRows rows={4} />,
});

export interface LedgerDetailsProps {
  initialConsents: ConsentRecord[];
  viewerPersonId: string;
  partners: Partner[];
  coupleId: string;
  locale: Locale;
}

/** "Consent ledger (table)": purpose, expiry and every record stay available, inside a disclosure. */
export function LedgerDetails(props: LedgerDetailsProps) {
  const t = useTranslations("sharing");
  const [opened, setOpened] = useState(false);
  return (
    <details className="group border-t border-line pt-4" data-testid="ledger-details" onToggle={(event) => event.currentTarget.open && setOpened(true)}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold">
        <span>{t("ledgerToggle")}</span>
        <span aria-hidden="true" className="font-mono text-fg-2">
          <span className="group-open:hidden">+</span>
          <span className="hidden group-open:inline">−</span>
        </span>
      </summary>
      <p className="m-0 mt-1 text-sm text-fg-2">{t("ledgerHint")}</p>
      <div className="pt-6">{opened ? <SharingPanel {...props} /> : null}</div>
    </details>
  );
}

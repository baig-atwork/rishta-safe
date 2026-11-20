import type { CellFill } from "@/components/grid/Cell";
import type { ConsentRecord, ConsentScope } from "./api/types";
import { consentStatus } from "@/components/consent/consent-status";

/**
 * The visibility matrix (02-ux-concept 4.3): people across, information layers down. Only the partner column is the
 * viewer's to change; the other columns are fixed by law or by the disclosure policy and are data here, not controls.
 */

export const MATRIX_SCOPES: readonly ConsentScope[] = ["couple_result_only", "gene_names_only", "full_variant_detail"];

export interface SwitchState {
  on: boolean;
  /** The active records behind an "on" switch (normally one). Revoke revokes all of them. */
  records: ConsentRecord[];
}

/**
 * On when there is a consent with subject = me, recipient = my partner, the same scope, not revoked and not expired.
 * The purpose does not matter for what the partner can see, so any purpose counts. `nowMs` is passed in (pure).
 */
export function switchState(
  consents: readonly ConsentRecord[],
  meId: string,
  partnerId: string,
  scope: ConsentScope,
  nowMs: number,
): SwitchState {
  const records = consents.filter(
    (c) =>
      c.subject_person_id === meId &&
      c.recipient === partnerId &&
      c.scope === scope &&
      consentStatus(c, nowMs) === "active",
  );
  return { on: records.length > 0, records };
}

export type FixedKey = "care" | "db" | "employer" | "insurer";

export interface FixedColumn {
  key: FixedKey;
  fill: CellFill;
  /** What the cell says; `what` and `cite` are message keys under sharing.matrix. */
  what: "care" | "law" | "never";
  /** The statute or standard the column cites (articles from the disclosure policy and Decree-Law 49/2023). */
  cite: "care" | "art26" | "art19to21";
}

/**
 * The fixed columns. Care team: sees what the disclosure policy of the couple's emirate allows, for the couple's care
 * (consent_policies.yaml: assigned staff see the staff view; the emirate policy sets the gate). Database: receives by law
 * (Art. 26(2)). Employer and insurer: never (Art. 19 to 21). The same on every row: the law does not vary by layer.
 */
export const FIXED_COLUMNS: readonly FixedColumn[] = [
  { key: "care", fill: "solid", what: "care", cite: "care" },
  { key: "db", fill: "hatch", what: "law", cite: "art26" },
  { key: "employer", fill: "open", what: "never", cite: "art19to21" },
  { key: "insurer", fill: "open", what: "never", cite: "art19to21" },
];

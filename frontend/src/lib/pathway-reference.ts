import type { PathwayStateKey } from "./api/types";

/**
 * Static reference used by the "How it works" page until backend/src/bayan/data/pathway.yaml is published.
 * Times follow research note 02 (DoH Abu Dhabi V3, Sep 2024, App. 15 and 3.3.10; DHA Dubai V1) and are
 * parameters in the prototype, not promises. null means the standards give no single figure.
 * Phase 2: replace with the pathway view returned by the API.
 */
export interface PathwayReferenceState {
  key: PathwayStateKey;
  /** Expected duration in hours where the standards give one. */
  hours: number | null;
}

export const PATHWAY_REFERENCE: readonly PathwayReferenceState[] = [
  { key: "registration_consent", hours: null },
  { key: "physician_consult", hours: 0.25 },
  { key: "sample_collection", hours: 0.25 },
  { key: "lab_processing", hours: 336 },
  { key: "joint_report", hours: null },
  { key: "counselling", hours: null },
  { key: "declaration", hours: null },
  { key: "certificate", hours: null },
  { key: "judicial_handoff", hours: null },
];

export const PATHWAY_KEYS: readonly PathwayStateKey[] = PATHWAY_REFERENCE.map((s) => s.key);

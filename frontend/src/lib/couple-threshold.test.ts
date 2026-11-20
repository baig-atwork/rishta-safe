import { describe, expect, it } from "vitest";
import {
  THRESHOLD_CHOICES,
  clearChoice,
  entryState,
  persistChoice,
  readStoredChoice,
  thresholdKey,
  viewFor,
  type KeyValueStore,
  type ThresholdStores,
} from "./couple-threshold";

function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

describe("entryState: branching on withheld_reason_key", () => {
  it("shows the declared state for right_not_to_know", () => {
    expect(entryState({ category: null, withheld_reason_key: "right_not_to_know" })).toBe("declared");
  });
  it.each(["counselling_first", "awaiting_partner_consent"])("renders the server's withheld document for %s (no threshold)", (reason) => {
    expect(entryState({ category: null, withheld_reason_key: reason })).toBe("withheld");
  });
  it("treats a missing category as withheld even without a reason (never shows a threshold with nothing behind it)", () => {
    expect(entryState({ category: null, withheld_reason_key: null })).toBe("withheld");
  });
  it.each(["shared_result_found", "no_shared_change_found", "more_information_needed"] as const)("shows the threshold for %s", (category) => {
    expect(entryState({ category, withheld_reason_key: null })).toBe("threshold");
  });
});

describe("viewFor: the four options", () => {
  it("covers every choice and shows the result only for 'now'", () => {
    expect(THRESHOLD_CHOICES).toEqual(["now", "counsellor", "notyet", "rntk"]);
    expect(viewFor(null)).toBe("choose");
    expect(viewFor("now")).toBe("result");
    expect(viewFor("counsellor")).toBe("closed-counsellor");
    expect(viewFor("notyet")).toBe("closed-notyet");
    // The right not to know is the server's state: this screen goes back to "choose" until the refetch says declared.
    expect(viewFor("rntk")).toBe("choose");
  });
});

describe("storage per the spec", () => {
  const ids = ["persona-noura", "cpl-demo-02"] as const;

  it("keys per lens and case", () => {
    expect(thresholdKey(...ids)).toBe("bayan.threshold.persona-noura.cpl-demo-02");
  });

  it("remembers now and counsellor in localStorage, not-yet in sessionStorage only, rntk nowhere", () => {
    const stores: ThresholdStores = { local: memory(), session: memory() };
    persistChoice(stores, ...ids, "now");
    expect(readStoredChoice(stores, ...ids)).toBe("now");
    expect((stores.local as ReturnType<typeof memory>).data.size).toBe(1);

    persistChoice(stores, ...ids, "counsellor");
    expect(readStoredChoice(stores, ...ids)).toBe("counsellor");

    persistChoice(stores, ...ids, "notyet");
    expect(readStoredChoice(stores, ...ids)).toBe("notyet");
    expect((stores.local as ReturnType<typeof memory>).data.size).toBe(0);
    expect((stores.session as ReturnType<typeof memory>).data.size).toBe(1);

    persistChoice(stores, ...ids, "rntk");
    expect(readStoredChoice(stores, ...ids)).toBeNull();
  });

  it("a new session asks again after 'not yet' (session store gone)", () => {
    const local = memory();
    persistChoice({ local, session: memory() }, ...ids, "notyet");
    expect(readStoredChoice({ local, session: memory() }, ...ids)).toBeNull();
  });

  it("clears a stored choice so the threshold shows again", () => {
    const stores: ThresholdStores = { local: memory(), session: memory() };
    persistChoice(stores, ...ids, "now");
    clearChoice(stores, ...ids);
    expect(readStoredChoice(stores, ...ids)).toBeNull();
  });

  it("two lenses on one browser do not share a choice", () => {
    const stores: ThresholdStores = { local: memory(), session: memory() };
    persistChoice(stores, "persona-noura", "cpl-demo-02", "now");
    expect(readStoredChoice(stores, "persona-saif", "cpl-demo-02")).toBeNull();
  });

  it("survives blocked storage: reads as no choice, writes do not throw", () => {
    const blocked: ThresholdStores = { local: throwing, session: throwing };
    expect(readStoredChoice(blocked, ...ids)).toBeNull();
    expect(() => persistChoice(blocked, ...ids, "now")).not.toThrow();
    expect(() => clearChoice(blocked, ...ids)).not.toThrow();
    expect(readStoredChoice({ local: null, session: null }, ...ids)).toBeNull();
  });

  it("ignores a junk stored value", () => {
    const local = memory();
    local.setItem(thresholdKey(...ids), "rntk");
    expect(readStoredChoice({ local, session: null }, ...ids)).toBeNull();
  });
});

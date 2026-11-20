import { describe, expect, it } from "vitest";
import type { NextActionOption } from "./api/types";
import { actionLabel, describeNext, type NextTextTranslators } from "./couple-next-text";

const dict: Record<string, string> = {
  "next.generic": "Your next step",
  "next.attend_counselling": "Attend your counselling session",
  "owner.couple": "You",
  "owner.counsellor": "A counsellor",
  "who.counsellor": "the counsellor",
  owner: "Owner of this step: {owner}",
  "waiting.title": "Waiting for {who}",
  "event.declaration_signed": "Record the signed declaration",
  "nextBy.declaration_signed": "Next: {who} records the signed declaration.",
  nextByGeneric: "Next, for {who}: {action}.",
  nextNone: "Nothing to do right now",
  nextNoneBody: "There is no pending step.",
};
const make = () => {
  const t = Object.assign(
    (key: string, values?: Record<string, string | number>) =>
      (dict[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? "")),
    { has: (key: string) => key in dict },
  );
  return { pathway: t, couple: t } satisfies NextTextTranslators;
};
const option = (over: Partial<NextActionOption>): NextActionOption => ({
  key: "attend_counselling",
  label: null,
  event: "counselling_attended",
  owner: "couple",
  roles: ["couple_member"],
  branch: false,
  ...over,
});

describe("describeNext", () => {
  it("names the step the person may record and offers its event", () => {
    const next = describeNext({ primary: option({}), waitingOn: null, branches: [] }, "en", make());
    expect(next).toEqual({ kind: "action", heading: "Attend your counselling session", body: "Owner of this step: You", event: "counselling_attended" });
  });
  it("names the step from the event's message, in the page language, before the API's English label", () => {
    const next = describeNext({ primary: option({ event: "declaration_signed", label: "Record the signed declaration (API)" }), waitingOn: null, branches: [] }, "en", make());
    expect(next.heading).toBe("Record the signed declaration");
  });
  it("falls back to the API's own label when the event has no message, never hiding it", () => {
    expect(describeNext({ primary: option({ key: "unknown_step", event: "unknown_event", label: "From the API" }), waitingOn: null, branches: [] }, "en", make()).heading).toBe("From the API");
    expect(actionLabel(option({ key: "unknown_step", event: null, label: null }), make().pathway)).toBe("Your next step");
  });
  it("says whose turn it is when the person may record nothing", () => {
    const next = describeNext({ primary: null, waitingOn: option({ roles: ["counsellor"], owner: "counsellor" }), branches: [] }, "en", make());
    expect(next.kind).toBe("waiting");
    expect(next.heading).toBe("Waiting for the counsellor");
    expect(next.event).toBeNull();
  });
  it("writes the waiting sentence from the event's message: next, who, what", () => {
    const next = describeNext({ primary: null, waitingOn: option({ key: "declaration_signed", event: "declaration_signed", roles: ["counsellor"], owner: "counsellor" }), branches: [] }, "en", make());
    expect(next.body).toBe("Next: the counsellor records the signed declaration.");
  });
  it("uses the plain wrapper around the API text when the event has no sentence", () => {
    const next = describeNext({ primary: null, waitingOn: option({ key: "x", event: "unknown_event", label: "From the API", roles: ["counsellor"], owner: "counsellor" }), branches: [] }, "en", make());
    expect(next.body).toBe("Next, for the counsellor: From the API.");
  });
  it("is an honest empty state when nothing is pending", () => {
    expect(describeNext({ primary: null, waitingOn: null, branches: [] }, "en", make()).kind).toBe("none");
  });
});

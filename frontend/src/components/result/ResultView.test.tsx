import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/transport";
import type { Block, DisclosedResult, ExplainerDoc, Locale, Partner, ResultEnvelope } from "@/lib/api/types";
import { renderWithIntl } from "@/test/render";
import { ReadTogether, type NextPanelData } from "./ReadTogether";
import { ResultExperience } from "./ResultExperience";
import { WithheldResult } from "./ResultView";

const api = vi.hoisted(() => ({
  result: vi.fn(),
  options: vi.fn(),
  glossary: vi.fn(),
  declareRightNotToKnow: vi.fn(),
  withdrawRightNotToKnow: vi.fn(),
}));
vi.mock("@/lib/api/client", () => ({ clientApi: api }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const base = (kind: Block["kind"], text: string, extra: Partial<Block> = {}): Block => ({
  kind,
  text,
  items: [],
  icon_array: null,
  tone: "neutral",
  numbers: [],
  ...extra,
});

/** A document shaped like the engine's: headline, lead, one tally, then own / limits / privacy sections, a pointer and a boundary. */
const explainer = (locale: Locale, mark: string, over: Partial<ExplainerDoc> = {}): ExplainerDoc => ({
  locale,
  language_status: locale === "en" ? "reviewed" : "draft",
  blocks: [
    base("heading", `HEADLINE-${mark}`),
    base("paragraph", `LEAD-${mark}`),
    base("icon_array", `CAPTION-${mark}`, { icon_array: { total: 100, affected: 25, carrier: 50, neither: 25, caption: `CAPTION-${mark}` } }),
    base("heading", `OWN-HEADING-${mark}`),
    base("paragraph", `OWN-${mark}`),
    base("heading", `LIMITS-HEADING-${mark}`),
    base("paragraph", `LIMITS-${mark}`),
    base("heading", `PRIVACY-HEADING-${mark}`),
    base("paragraph", `PRIVACY-${mark}`),
    base("paragraph", `POINTER-${mark}`),
    base("disclaimer", `DISCLAIMER-${mark}`),
  ],
  glossary_keys: ["carrier"],
  numbers_used: [],
  template_ids: ["result.shared.heading", "own.heading", "limits.heading", "privacy.heading", "options.pointer", "boundary.education_decision_support"],
  check: null,
  ...over,
});

const disclosed = (over: Partial<DisclosedResult> = {}): DisclosedResult => ({
  couple_id: "c-01",
  viewer_role: "couple_member",
  viewer_person_id: "p-01a",
  policy: "abu_dhabi",
  category: "shared_result_found",
  withheld_reason_key: null,
  shared: [],
  own_findings: [],
  partner_finding_scope: "none",
  partner_findings: [],
  detection: [],
  relationship: "first_cousin",
  review_priority: null,
  staff_trace: [],
  boundary_notice_key: "boundary.education_decision_support",
  certificate_note_key: null,
  ruleset_version: "test",
  ...over,
});

const envelope = (locale: Locale, mark: string, over: Partial<ExplainerDoc> = {}): ResultEnvelope => ({ disclosed: disclosed(), explainer: explainer(locale, mark, over) });

const partners: Partner[] = [
  { person_id: "p-01a", display_name: "Layla Demo (synthetic)", sex: "female", language: "en" },
  { person_id: "p-01b", display_name: "Anwar Demo (synthetic)", sex: "male", language: "ar" },
];
const NEXT: NextPanelData = { heading: "NEXT-HEADING", body: "NEXT-BODY", advanceEvent: null };

function mockApi() {
  api.result.mockImplementation(async (_id: string, locale: Locale) => envelope(locale, locale.toUpperCase()));
  api.options.mockResolvedValue(explainer("en", "OPT", { blocks: [base("heading", "What you can do"), base("list", "", { items: ["OPTION-A"] })] }));
  api.glossary.mockResolvedValue([
    { key: "carrier", term: "TERM-CARRIER", definition: "d1" },
    { key: "panel", term: "TERM-PANEL", definition: "d2" },
  ]);
}

function renderReader(locale: Locale = "en", over: Partial<Parameters<typeof ReadTogether>[0]> = {}) {
  return renderWithIntl(
    <ReadTogether coupleId="c-01" locale={locale} partners={partners} viewerPersonId="p-01a" next={NEXT} onClose={vi.fn()} onChange={vi.fn()} {...over} />,
    locale,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  mockApi();
});

describe("ReadTogether: both languages, wording from the API only", () => {
  it("shows the page language and the other member's language side by side, each with its own lang, dir and stamp", async () => {
    renderReader("en");
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    expect(await screen.findByText("HEADLINE-AR")).toBeInTheDocument();
    const fold = screen.getByTestId("layer-1");
    expect(fold).toHaveAttribute("data-cat", "shared_result_found");
    expect(within(fold).getByText("LEAD-EN")).toHaveAttribute("lang", "en");
    expect(within(fold).getByText("LEAD-AR")).toHaveAttribute("lang", "ar");
    expect(within(fold).getByText("LEAD-AR")).toHaveAttribute("dir", "rtl");
    // the caption in both languages is in the first fold, and the tally is labelled by the page-language caption
    expect(within(fold).getByText("CAPTION-EN")).toBeInTheDocument();
    expect(within(fold).getByText("CAPTION-AR")).toBeInTheDocument();
    const grid = within(fold).getByTestId("tally-grid");
    expect(grid.getAttribute("aria-labelledby")).toBe(within(fold).getByText("CAPTION-EN").id);
    expect(grid.querySelectorAll(".cell")).toHaveLength(100);
    // one stamp per column: English reviewed, Arabic draft
    expect(within(fold).getAllByText(/^(reviewed|draft)$/)).toHaveLength(2);
    expect(api.result).toHaveBeenCalledWith("c-01", "en");
    expect(api.result).toHaveBeenCalledWith("c-01", "ar");
  });

  it("an Arabic page reads Arabic first and the other member's English second", async () => {
    renderReader("ar", { partners: [{ ...partners[0]!, language: "ar" }, { ...partners[1]!, language: "en" }] });
    expect(await screen.findByText("HEADLINE-AR")).toBeInTheDocument();
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    expect(api.result).toHaveBeenCalledWith("c-01", "ar");
    expect(api.result).toHaveBeenCalledWith("c-01", "en");
  });

  it("maps blocks to the four disclosures by section, pairing each language row by row", async () => {
    renderReader("en");
    await screen.findByText("HEADLINE-AR");
    const layer2 = screen.getByTestId("layer-2");
    expect(within(layer2).getByText("What this means, and what it does not")).toBeInTheDocument();
    for (const mark of ["OWN-EN", "OWN-AR", "LIMITS-EN", "LIMITS-AR", "PRIVACY-EN", "PRIVACY-AR"]) {
      expect(within(layer2).getByText(mark)).toBeInTheDocument();
    }
    // related couple: the limits disclosure is pinned open
    const limits = within(layer2).getByText("Limits of this test").closest("details") as HTMLDetailsElement;
    expect(limits.open).toBe(true);
    // the document's pointer to the next step and its boundary sit in the next-step panel
    const panel = screen.getByTestId("layer-3");
    expect(within(panel).getByText("NEXT-HEADING")).toBeInTheDocument();
    expect(within(panel).getByText("POINTER-EN")).toBeInTheDocument();
    expect(within(screen.getByTestId("boundary")).getByText("DISCLAIMER-EN")).toBeInTheDocument();
  });

  it("falls back to full, unpaired blocks and says so when the two documents do not line up (never guesses)", async () => {
    api.result.mockImplementation(async (_id: string, locale: Locale) =>
      locale === "en"
        ? envelope("en", "EN")
        : envelope("ar", "AR", { blocks: [...explainer("ar", "AR").blocks.slice(0, 4), base("callout", "EXTRA-AR"), ...explainer("ar", "AR").blocks.slice(4)] }),
    );
    renderReader("en");
    await screen.findByText("HEADLINE-AR");
    const layer2 = screen.getByTestId("layer-2");
    // own disclosure: en [paragraph], ar [callout, paragraph] share no kind at position 0
    expect(within(layer2).getByText("The two languages could not be lined up from here on; each is shown in full.")).toBeInTheDocument();
    expect(within(layer2).getByText("OWN-EN")).toBeInTheDocument();
    expect(within(layer2).getByText("OWN-AR")).toBeInTheDocument();
    expect(within(layer2).getByText("EXTRA-AR")).toBeInTheDocument();
  });

  it("remembers 'show one language' in localStorage and then stops loading the second language", async () => {
    const user = userEvent.setup();
    renderReader("en");
    await screen.findByText("HEADLINE-AR");
    await user.click(screen.getByRole("button", { name: "Show one language" }));
    expect(screen.queryByText("HEADLINE-AR")).toBeNull();
    expect(window.localStorage.getItem("bayan.together.single")).toBe("1");
    expect(screen.getByRole("button", { name: "Show both languages" })).toBeInTheDocument();
  });

  it("keeps the page-language column when the second language fails, with a retry", async () => {
    api.result.mockImplementation(async (_id: string, locale: Locale) => {
      if (locale === "ar") throw new ApiError({ type: "about:blank", title: "Unavailable", status: 503 });
      return envelope(locale, locale.toUpperCase());
    });
    renderReader("en");
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    expect(await screen.findByText(/Could not load العربية/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByText("LEAD-EN")).toBeInTheDocument();
  });

  it("offers 'Add a language' when both members use the page language", async () => {
    renderReader("en", { partners: [{ ...partners[0]!, language: "en" }, { ...partners[1]!, language: "en" }] });
    await screen.findByText("HEADLINE-EN");
    expect(screen.getByLabelText("Second language")).toBeInTheDocument();
    expect(api.result).toHaveBeenCalledTimes(1);
  });

  it("shows a skeleton of the layout while loading and an error with the correlation id when the read fails", async () => {
    api.result.mockImplementation(() => new Promise(() => undefined));
    const { unmount } = renderReader("en");
    expect(screen.getByTestId("result-skeleton")).toBeInTheDocument();
    unmount();
    api.result.mockRejectedValue(new ApiError({ type: "about:blank", title: "Result service down", status: 503, correlation_id: "corr-9" }));
    renderReader("en");
    expect(await screen.findByRole("alert")).toHaveTextContent("corr-9");
  });

  it("refuses to draw a tally whose numbers do not add up", async () => {
    const bad = explainer("en", "EN");
    bad.blocks[2] = base("icon_array", "x", { icon_array: { total: 100, affected: 25, carrier: 50, neither: 20, caption: "CAPTION-EN" } });
    api.result.mockResolvedValue({ disclosed: disclosed(), explainer: bad });
    renderReader("en", { partners: [{ ...partners[0]!, language: "en" }, { ...partners[1]!, language: "en" }] });
    await screen.findByText("HEADLINE-EN");
    expect(screen.queryByTestId("tally-grid")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent("do not add up");
  });

  it("lists only the glossary terms the document names", async () => {
    renderReader("en");
    await screen.findByText("HEADLINE-AR");
    await waitFor(() => expect(screen.getByText("TERM-CARRIER")).toBeInTheDocument());
    expect(screen.queryByText("TERM-PANEL")).toBeNull();
  });

  it("renders no raw message keys and none of the banned vocabulary in the interface wording", async () => {
    renderReader("en");
    await screen.findByText("HEADLINE-AR");
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\bresult\.[a-zA-Z]/);
    expect(text).not.toMatch(/\bcategory\.[a-z_]+/);
    for (const word of ["incompatible", "no risk", "high risk", "low risk", "fail"]) expect(text.toLowerCase()).not.toContain(word);
  });
});

describe("ResultExperience: the threshold in front of the result", () => {
  const props = {
    coupleId: "c-01",
    personaId: "persona-noura",
    viewerPersonId: "p-01a",
    locale: "en" as Locale,
    partners,
    entry: "threshold" as const,
    enterNow: false,
    counsellingStep: "Counselling (Coming up)",
    next: NEXT,
  };

  it("renders no result text, and fetches none, before a choice", async () => {
    renderWithIntl(<ResultExperience {...props} />);
    expect(await screen.findByTestId("threshold")).toBeInTheDocument();
    expect(screen.queryByTestId("layer-1")).toBeNull();
    expect(document.body.textContent).not.toContain("HEADLINE");
    expect(api.result).not.toHaveBeenCalled();
    // four options, nothing preselected, one Continue
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
  });

  it("asks for a choice instead of picking one for the person", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ResultExperience {...props} />);
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one option");
    expect(api.result).not.toHaveBeenCalled();
  });

  it("'Read it now' reveals the result and remembers the choice per lens", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ResultExperience {...props} />);
    await user.click(await screen.findByRole("radio", { name: /Read it now/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    expect(window.localStorage.getItem("bayan.threshold.persona-noura.c-01")).toBe("now");
  });

  it("a stored 'now' goes straight to the result on the next visit; another lens still sees the threshold", async () => {
    window.localStorage.setItem("bayan.threshold.persona-noura.c-01", "now");
    const { unmount } = renderWithIntl(<ResultExperience {...props} />);
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    unmount();
    renderWithIntl(<ResultExperience {...props} personaId="persona-saif" />);
    expect(await screen.findByTestId("threshold")).toBeInTheDocument();
  });

  it("'with a counsellor first' keeps it closed, shows the counselling step, and 'Open it now' opens it", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ResultExperience {...props} />);
    await user.click(await screen.findByRole("radio", { name: /counsellor first/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("closed-counsellor")).toHaveTextContent("Your counselling step: Counselling (Coming up).");
    expect(window.localStorage.getItem("bayan.threshold.persona-noura.c-01")).toBe("counsellor");
    expect(document.body.textContent).not.toContain("HEADLINE");
    await user.click(screen.getByRole("button", { name: "Open it now" }));
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
  });

  it("'Not yet' is kept for the session only and offers 'Open it'", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ResultExperience {...props} />);
    await user.click(await screen.findByRole("radio", { name: /Not yet/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByTestId("closed-notyet")).toBeInTheDocument();
    expect(window.localStorage.getItem("bayan.threshold.persona-noura.c-01")).toBeNull();
    expect(window.sessionStorage.getItem("bayan.threshold.persona-noura.c-01")).toBe("notyet");
    await user.click(screen.getByRole("button", { name: "Open it" }));
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
  });

  it("'I prefer not to know' confirms first, then issues exactly one PUT and shows the declared state", async () => {
    const user = userEvent.setup();
    api.declareRightNotToKnow.mockResolvedValue({ couple_id: "c-01", person_id: "p-01a", active: true, note: "n" });
    renderWithIntl(<ResultExperience {...props} />);
    await user.click(await screen.findByRole("radio", { name: /prefer not to know/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(api.declareRightNotToKnow).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Art. 9(2)");
    expect(dialog).toHaveTextContent("Art. 26(2)");
    await user.click(within(dialog).getByRole("button", { name: "Record my choice" }));
    expect(await screen.findByText("You chose not to know this result")).toBeInTheDocument();
    expect(api.declareRightNotToKnow).toHaveBeenCalledTimes(1);
    expect(api.result).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("a declared state offers withdraw: one DELETE, then the threshold again", async () => {
    const user = userEvent.setup();
    api.withdrawRightNotToKnow.mockResolvedValue({ couple_id: "c-01", person_id: "p-01a", active: false, note: "n" });
    renderWithIntl(<ResultExperience {...props} entry="declared" />);
    expect(await screen.findByRole("heading", { name: "You chose not to know this result" })).toBeInTheDocument();
    expect(screen.queryByTestId("threshold")).toBeNull();
    await user.click(screen.getByRole("button", { name: "I want to see my result" }));
    expect(await screen.findByTestId("threshold")).toBeInTheDocument();
    expect(api.withdrawRightNotToKnow).toHaveBeenCalledTimes(1);
  });

  it("?enter=now skips the choice for this visit and stores nothing", async () => {
    renderWithIntl(<ResultExperience {...props} enterNow />);
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    expect(window.localStorage.getItem("bayan.threshold.persona-noura.c-01")).toBeNull();
  });

  it("'Change how I meet it' forgets the stored choice and reopens the threshold", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("bayan.threshold.persona-noura.c-01", "now");
    renderWithIntl(<ResultExperience {...props} />);
    await screen.findByText("HEADLINE-EN");
    await user.click(await screen.findByRole("button", { name: "Change how I meet it" }));
    expect(await screen.findByTestId("threshold")).toBeInTheDocument();
    expect(window.localStorage.getItem("bayan.threshold.persona-noura.c-01")).toBeNull();
  });

  it("works with storage blocked: the choice applies for this visit", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderWithIntl(<ResultExperience {...props} />);
    await user.click(await screen.findByRole("radio", { name: /Read it now/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("HEADLINE-EN")).toBeInTheDocument();
    spy.mockRestore();
  });
});

describe("WithheldResult: the server held the result back", () => {
  it("shows the withheld notice, not a result, and a way to review sharing", () => {
    renderWithIntl(<WithheldResult envelope={{ disclosed: disclosed({ category: null, withheld_reason_key: "awaiting_partner_consent" }), explainer: null }} />);
    expect(screen.getByRole("heading", { name: "Your result is not shown yet" })).toBeInTheDocument();
    expect(screen.getByText(/Your partner has not yet agreed to share/)).toBeInTheDocument();
    expect(screen.queryByTestId("layer-1")).toBeNull();
    expect(screen.getByRole("link", { name: "Review sharing" })).toHaveAttribute("href", "/couple/sharing");
  });

  it("shows the counselling-first reason in Arabic with no raw keys", () => {
    renderWithIntl(<WithheldResult envelope={{ disclosed: disclosed({ category: null, withheld_reason_key: "counselling_first" }), explainer: null }} />, "ar");
    expect(document.body.textContent).not.toMatch(/\bresult\.[a-zA-Z]/);
    expect(document.documentElement.dir).toBe("rtl");
  });
});
